import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Customer, EmployeeProfile, FollowUpTask, Project, ProjectProgressUpdate, TomorrowItem


class PersonalWorkTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='personal-business')
        EmployeeProfile.objects.create(user=self.user, role='both')
        self.other = get_user_model().objects.create_user(username='personal-other')
        EmployeeProfile.objects.create(user=self.other, role='business')
        self.admin = get_user_model().objects.create_superuser(username='personal-admin', password='test-only')
        self.customer = Customer.objects.create(name='个人测试客户', phone='wx:test', grade='B', business_owner=self.user)
        self.project = Project.objects.create(customer=self.customer, name='负责项目', business_owner=self.user, technical_owner=self.user, owners_inherit_customer=False)
        self.sibling = Project.objects.create(customer=self.customer, name='同客户其他项目', business_owner=self.other, owners_inherit_customer=False)
        self.client.force_login(self.user)

    def send(self, url, data, method='post'):
        return getattr(self.client, method)(url, json.dumps(data), content_type='application/json')

    def event(self, **kwargs):
        return self.send('/api/calendar/', {'title': '来访准备', 'plannedDate': timezone.localdate().isoformat(), **kwargs})

    def test_project_scope_deduplicates_dual_role_and_excludes_sibling(self):
        data = self.client.get('/api/my-projects/').json()
        self.assertEqual([p['id'] for p in data['projects']], [self.project.id])
        self.assertEqual(data['ownActiveCount'], 1)
        self.assertEqual(data['ownActiveCustomerCount'], 1)
        self.assertFalse(data['canViewEmployees'])
        self.assertEqual(self.client.get('/api/my-projects/?employee=' + str(self.other.id)).status_code, 403)

    def test_inherited_owner_and_unassigned_projects(self):
        inherited = Project.objects.create(customer=self.customer, name='继承负责人')
        unassigned = Project.objects.create(customer=Customer.objects.create(name='未分配', grade='C'), name='未分配项目')
        ids = [p['id'] for p in self.client.get('/api/my-projects/').json()['projects']]
        self.assertIn(inherited.id, ids)
        self.assertNotIn(unassigned.id, ids)

    def test_admin_defaults_to_own_and_can_select_employee(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get('/api/my-projects/').json()['projects'], [])
        data = self.client.get('/api/my-projects/?employee=' + str(self.user.id)).json()
        self.assertEqual([p['id'] for p in data['projects']], [self.project.id])
        self.assertEqual(data['ownActiveCount'], 0)
        self.assertEqual(data['ownActiveCustomerCount'], 0)

    def test_navigation_customer_count_deduplicates_multiple_projects(self):
        Project.objects.create(customer=self.customer, name='同客户第二个负责项目', business_owner=self.user, owners_inherit_customer=False)
        data = self.client.get('/api/my-projects/').json()
        self.assertEqual(data['ownActiveCount'], 2)
        self.assertEqual(data['ownActiveCustomerCount'], 1)

    def test_grade_changes_and_real_followup_are_independent(self):
        at = timezone.now() - timedelta(days=2)
        record = ProjectProgressUpdate.objects.create(project=self.project, content='实际沟通', occurred_at=at, created_by=self.user)
        self.project.plan = '普通编辑不算跟进'
        self.project.is_active = False
        self.project.save()
        for grade in 'ABCD':
            self.customer.grade = grade
            self.customer.save()
            item = self.client.get('/api/my-projects/').json()['projects'][0]
            self.assertEqual(item['latestFollowupAt'], record.occurred_at.isoformat())
            self.assertEqual(item['latestFollowupContent'], '实际沟通')
            self.assertEqual(item['customer']['grade'], grade)
            self.assertFalse(item['isActive'])

    def test_no_automatic_tasks_or_deadlines_on_project_save(self):
        self.assertFalse(self.project.follow_up_tasks.exists())
        historic = FollowUpTask.objects.create(project=self.project, title='历史待办', target_progress='技术验证', role='business', assignee=self.user)
        self.project.progress = '合同签订'
        self.project.save()
        historic.refresh_from_db()
        self.assertEqual(historic.status, 'pending')
        self.assertIsNone(historic.due_at)
        self.assertEqual(self.project.follow_up_tasks.count(), 1)

    def test_historical_manual_items_remain_same_records(self):
        item = TomorrowItem.objects.create(user=self.user, title='原个人安排', note='原备注', planned_date=timezone.localdate(), is_completed=True, completed_at=timezone.now())
        data = self.client.get('/api/calendar/').json()
        old = next(e for e in data['items'] if e['id'] == item.id)
        self.assertEqual(old['title'], item.title)
        self.assertEqual(old['note'], item.note)
        self.assertEqual(old['plannedTime'], '')
        self.assertTrue(old['isCompleted'])

    def test_calendar_create_edit_reschedule_complete_cancel_delete(self):
        response = self.event(plannedTime='14:30', kind='appointment', projectId=self.project.id, reminderMinutes=30)
        self.assertEqual(response.status_code, 201)
        item = response.json()['item']
        url = '/api/calendar/' + str(item['id']) + '/'
        self.assertEqual(item['customerId'], self.customer.id)
        changed = self.send(url, {'title': '改期预约', 'plannedDate': '2026-12-31', 'plannedTime': ''}, 'patch')
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.json()['item']['plannedTime'], '')
        self.assertEqual(changed.json()['item']['plannedDate'], '2026-12-31')
        self.assertEqual(self.send(url, {'isCompleted': True}, 'patch').status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.progress, '需求对接')
        self.assertEqual(self.send(url, {'isCancelled': True, 'isCompleted': False}, 'patch').status_code, 200)
        self.assertTrue(TomorrowItem.objects.get(id=item['id']).is_cancelled)
        self.assertEqual(self.client.delete(url).status_code, 200)
        self.assertFalse(TomorrowItem.objects.filter(id=item['id']).exists())
        self.assertTrue(Project.objects.filter(id=self.project.id).exists())

    def test_calendar_is_private_even_for_admin_or_shared_project_owner(self):
        event = self.event(projectId=self.project.id).json()['item']
        for user in (self.other, self.admin):
            self.client.force_login(user)
            self.assertEqual(self.client.get('/api/calendar/').json()['items'], [])
            url = '/api/calendar/' + str(event['id']) + '/'
            self.assertEqual(self.send(url, {'title': '不允许'}, 'patch').status_code, 404)
            self.assertEqual(self.client.delete(url).status_code, 404)

    def test_calendar_validation_does_not_partially_save(self):
        item = self.event().json()['item']
        url = '/api/calendar/' + str(item['id']) + '/'
        for invalid in ({'plannedDate': 'wrong'}, {'plannedTime': '28:00'}, {'reminderMinutes': -1}, {'kind': 'system'}, {'isCompleted': 'false'}, {'isCompleted': True, 'isCancelled': True}, {'projectId': 'bad'}):
            response = self.send(url, {'title': '不应保存', **invalid}, 'patch')
            self.assertEqual(response.status_code, 400, response.content)
            self.assertEqual(TomorrowItem.objects.get(id=item['id']).title, '来访准备')
        self.assertEqual(self.client.get('/api/calendar/?start=2027-01-01&end=2026-01-01').status_code, 400)

    def test_calendar_project_customer_mismatch_rejected(self):
        another = Customer.objects.create(name='无关客户')
        self.assertEqual(self.event(projectId=self.project.id, customerId=another.id).status_code, 400)

    def test_today_badge_excludes_completed_cancelled_and_other_owners(self):
        self.event()
        self.event(isCompleted=True)
        self.event(isCancelled=True)
        TomorrowItem.objects.create(user=self.other, title='别人的日程', planned_date=timezone.localdate())
        self.assertEqual(self.client.get('/api/calendar/').json()['todayCount'], 1)

    def test_reminders_only_for_user_scheduled_time(self):
        now = timezone.now().replace(second=0, microsecond=0)
        local = timezone.localtime(now)
        response = self.event(plannedDate=local.date().isoformat(), plannedTime=local.strftime('%H:%M'), reminderMinutes=0)
        with patch('customers.personal.timezone.now', return_value=now):
            reminders = self.client.get('/api/calendar/').json()['reminders']
        self.assertEqual([e['id'] for e in reminders], [response.json()['item']['id']])

    def test_duplicates_report_existing_and_batch_without_mutation(self):
        before = Customer.objects.count()
        data = self.send('/api/customers/check-duplicates/', {'customers': [
            {'name': self.customer.name, 'phone': 'different'},
            {'name': '另一个', 'phone': self.customer.phone},
            {'name': '另一个', 'phone': 'new'},
        ]}).json()
        self.assertEqual(len(data['matches']), 3)
        self.assertEqual(data['matches'][2]['batchRows'], [2])
        self.assertEqual(Customer.objects.count(), before)
        own = self.send('/api/customers/check-duplicates/', {'customers': [{'id': self.customer.id, 'name': self.customer.name, 'phone': self.customer.phone}]}).json()
        self.assertEqual(own['matches'], [])
