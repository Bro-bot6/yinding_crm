import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .admin import EmployeeUserCreationForm
from .models import Customer, EmployeeProfile, FollowUpTask, Project, TomorrowItem
from .services import PROGRESS_STAGES


class AvailableEmployeesApiTests(TestCase):
    def create_employee(self, username, role, is_active=True):
        user = get_user_model().objects.create_user(
            username=username,
            password='test-password',
            first_name=username.title(),
            is_active=is_active,
        )
        EmployeeProfile.objects.create(user=user, role=role)
        return user

    def test_returns_only_active_accounts_for_matching_roles(self):
        business = self.create_employee('business', EmployeeProfile.Role.BUSINESS)
        technical = self.create_employee('technical', EmployeeProfile.Role.TECHNICAL)
        both = self.create_employee('both', EmployeeProfile.Role.BOTH)
        self.create_employee('inactive', EmployeeProfile.Role.BOTH, is_active=False)
        get_user_model().objects.create_user(username='unconfigured', password='test-password')

        self.client.force_login(business)
        response = self.client.get(reverse('available-employees'))
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(
            {item['id'] for item in payload['business']},
            {business.id, both.id},
        )
        self.assertEqual(
            {item['id'] for item in payload['technical']},
            {technical.id, both.id},
        )

    def test_active_superuser_is_available_for_both_roles(self):
        superuser = get_user_model().objects.create_superuser(
            username='admin',
            password='test-password',
        )

        self.client.force_login(superuser)
        payload = self.client.get(reverse('available-employees')).json()

        self.assertIn(superuser.id, {item['id'] for item in payload['business']})
        self.assertIn(superuser.id, {item['id'] for item in payload['technical']})

    def test_anonymous_request_is_redirected_to_login(self):
        response = self.client.get(reverse('available-employees'))
        self.assertRedirects(
            response,
            f"{reverse('login')}?next={reverse('available-employees')}",
        )


class LoginAndAdminFormTests(TestCase):
    def test_system_management_link_is_only_visible_to_superusers(self):
        employee = get_user_model().objects.create_user(
            username='employee',
            password='123456',
        )
        EmployeeProfile.objects.create(
            user=employee,
            role=EmployeeProfile.Role.BUSINESS,
        )
        self.client.force_login(employee)
        response = self.client.get(reverse('home'))
        self.assertNotContains(response, 'href="/admin/"')

        administrator = get_user_model().objects.create_user(
            username='administrator',
            password='123456',
            is_staff=True,
        )
        EmployeeProfile.objects.create(
            user=administrator,
            role=EmployeeProfile.Role.BOTH,
        )
        self.client.force_login(administrator)
        response = self.client.get(reverse('home'))
        self.assertNotContains(response, 'href="/admin/"')

        superuser = get_user_model().objects.create_superuser(
            username='superuser',
            password='123456',
        )
        self.client.force_login(superuser)
        response = self.client.get(reverse('home'))
        self.assertContains(response, 'href="/admin/"')

    def test_home_requires_login_and_six_digit_numeric_password_can_login(self):
        user = get_user_model().objects.create_user(
            username='employee',
            password='123456',
        )
        response = self.client.get(reverse('home'))
        self.assertRedirects(response, f"{reverse('login')}?next={reverse('home')}")

        response = self.client.post(
            reverse('login'),
            {'username': user.username, 'password': '123456'},
        )
        self.assertRedirects(response, reverse('home'))

    def test_admin_add_user_form_only_contains_username_and_passwords(self):
        admin_user = get_user_model().objects.create_superuser(
            username='admin',
            password='123456',
        )
        self.client.force_login(admin_user)

        response = self.client.get(reverse('admin:auth_user_add'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="username"')
        self.assertContains(response, 'name="password1"')
        self.assertContains(response, 'name="password2"')
        self.assertContains(response, 'name="is_staff"')
        self.assertNotContains(response, 'name="usable_password"')
        self.assertNotContains(response, 'name="first_name"')
        self.assertNotContains(response, 'name="last_name"')
        self.assertNotContains(response, 'name="email"')

    def test_new_employee_is_staff_by_default_and_can_be_unchecked(self):
        form = EmployeeUserCreationForm(
            data={
                'username': 'default-staff',
                'password1': '123456',
                'password2': '123456',
                'is_staff': 'on',
            },
        )
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertTrue(user.is_staff)

        form = EmployeeUserCreationForm(
            data={
                'username': 'non-staff',
                'password1': '123456',
                'password2': '123456',
            },
        )
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertFalse(user.is_staff)

    def test_admin_change_page_hides_password_hash_and_only_shows_reset_action(self):
        admin_user = get_user_model().objects.create_superuser(
            username='admin',
            password='123456',
        )
        employee = get_user_model().objects.create_user(
            username='employee',
            password='654321',
            is_staff=True,
        )
        self.client.force_login(admin_user)

        response = self.client.get(
            reverse('admin:auth_user_change', args=(employee.pk,)),
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '密码已安全加密，原始密码无法查看')
        self.assertContains(response, '重置密码')
        self.assertContains(
            response,
            reverse('admin:auth_user_password_change', args=(employee.pk,)),
        )
        self.assertNotContains(response, 'pbkdf2_sha256')
        self.assertNotContains(response, '迭代次数')
        self.assertNotContains(response, '盐：')


class CustomerPersistenceApiTests(TestCase):
    def setUp(self):
        self.business = get_user_model().objects.create_user(
            username='business-owner',
            password='123456',
        )
        EmployeeProfile.objects.create(
            user=self.business,
            role=EmployeeProfile.Role.BUSINESS,
            nickname='商务甲',
        )
        self.technical = get_user_model().objects.create_user(
            username='technical-owner',
            password='123456',
        )
        EmployeeProfile.objects.create(
            user=self.technical,
            role=EmployeeProfile.Role.TECHNICAL,
            nickname='技术乙',
        )
        self.customer = Customer.objects.create(
            name='修改前名称',
            province='浙江省',
            city='杭州市',
            district='西湖区',
            business_owner=self.business,
            technical_owner=self.technical,
        )
        self.client.force_login(self.business)

    def test_customer_edit_is_persisted_and_returned_by_list_api(self):
        payload = {
            'name': '修改后名称',
            'phone': '13800000000',
            'source': '朋友介绍',
            'referrer': '王先生',
            'province': '广东省',
            'city': '佛山市',
            'district': '顺德区',
            'grade': 'A',
            'description': '数据库持久化测试',
            'progress': '技术方案验证汇报通过',
            'plan': '修改后的施工方案',
            'ownerId': self.business.id,
            'techId': self.technical.id,
        }
        response = self.client.patch(
            reverse('customer-detail', args=[self.customer.id]),
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.name, '修改后名称')
        self.assertEqual(self.customer.district, '顺德区')
        self.assertEqual(self.customer.referrer, '王先生')

        response = self.client.get(reverse('customers-collection'))
        payload = response.json()
        saved = next(
            item for item in payload['customers']
            if item['id'] == self.customer.id
        )
        self.assertEqual(saved['name'], '修改后名称')
        self.assertEqual(saved['description'], '数据库持久化测试')
        self.assertEqual(saved['owner'], '商务甲')
        self.assertEqual(saved['tech'], '技术乙')
        self.assertRegex(saved['createdDate'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertTrue(
            any(project['customer']['id'] == self.customer.id for project in payload['projects']),
        )

    def test_legacy_customer_can_be_edited_without_filling_unrelated_missing_fields(self):
        legacy = Customer.objects.create(
            name='旧客资',
            province='浙江省',
            city='杭州市',
            district='',
            business_owner_name='原商务负责人',
            technical_owner_name='原技术负责人',
        )
        payload = {
            'name': '旧客资已修改',
            'phone': '',
            'source': '抖音',
            'referrer': '',
            'province': '浙江省',
            'city': '杭州市',
            'district': '',
            'grade': 'B',
            'description': '只修改这段客户描述',
            'progress': '技术方案验证汇报通过',
            'plan': '原方案',
            'ownerId': '',
            'techId': '',
        }
        response = self.client.patch(
            reverse('customer-detail', args=[legacy.id]),
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        legacy.refresh_from_db()
        self.assertEqual(legacy.description, '只修改这段客户描述')
        self.assertEqual(legacy.district, '')
        self.assertEqual(legacy.business_owner_name, '原商务负责人')
        self.assertEqual(legacy.technical_owner_name, '原技术负责人')


class FollowUpTaskApiTests(TestCase):
    def setUp(self):
        self.business = get_user_model().objects.create_user(
            username='follow-business',
            password='123456',
        )
        EmployeeProfile.objects.create(
            user=self.business,
            role=EmployeeProfile.Role.BUSINESS,
        )
        self.technical = get_user_model().objects.create_user(
            username='follow-technical',
            password='123456',
        )
        EmployeeProfile.objects.create(
            user=self.technical,
            role=EmployeeProfile.Role.TECHNICAL,
        )
        self.other = get_user_model().objects.create_user(
            username='follow-other',
            password='123456',
        )
        EmployeeProfile.objects.create(
            user=self.other,
            role=EmployeeProfile.Role.BUSINESS,
        )
        self.admin = get_user_model().objects.create_superuser(
            username='follow-admin',
            password='123456',
        )
        self.customer = Customer.objects.create(
            name='自动跟进测试客户',
            progress=PROGRESS_STAGES[4],
            business_owner=self.business,
            technical_owner=self.technical,
        )
        self.project = Project.objects.create(
            customer=self.customer,
            name='自动跟进测试项目',
            progress=PROGRESS_STAGES[4],
            business_owner=self.business,
            technical_owner=self.technical,
        )

    def test_project_generates_next_milestone_task_for_the_correct_owner(self):
        task = self.project.follow_up_tasks.get(
            target_progress=PROGRESS_STAGES[5],
        )
        self.assertEqual(task.role, FollowUpTask.Role.TECHNICAL)
        self.assertEqual(task.assignee, self.technical)
        self.assertEqual(task.status, FollowUpTask.Status.PENDING)

    def test_employee_only_sees_tasks_assigned_to_their_account(self):
        self.client.force_login(self.technical)
        response = self.client.get(reverse('follow-up-tasks'))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['canViewAll'])
        self.assertTrue(payload['tasks'])
        self.assertEqual(
            {task['assignee']['id'] for task in payload['tasks']},
            {self.technical.id},
        )

        self.client.force_login(self.other)
        response = self.client.get(reverse('follow-up-tasks'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tasks'], [])

    def test_superuser_can_view_all_and_filter_by_employee(self):
        self.client.force_login(self.admin)
        response = self.client.get(reverse('follow-up-tasks'))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['canViewAll'])
        self.assertTrue(response.json()['tasks'])

        response = self.client.get(
            reverse('follow-up-tasks'),
            {'employee': self.other.id},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tasks'], [])

    def test_api_returns_only_one_current_status_card_per_project(self):
        current_task = self.project.follow_up_tasks.get(
            target_progress=PROGRESS_STAGES[5],
        )
        FollowUpTask.objects.create(
            project=self.project,
            title='历史阶段任务',
            target_progress=PROGRESS_STAGES[3],
            role=FollowUpTask.Role.BUSINESS,
            status=FollowUpTask.Status.COMPLETED,
            completed_at=timezone.now(),
            result='历史任务已完成',
        )

        self.client.force_login(self.admin)
        response = self.client.get(reverse('follow-up-tasks'))

        self.assertEqual(response.status_code, 200)
        project_tasks = [
            task for task in response.json()['tasks']
            if task['project']['id'] == self.project.id
        ]
        self.assertEqual(len(project_tasks), 1)
        self.assertEqual(project_tasks[0]['id'], current_task.id)
        returned_tasks = response.json()['tasks']
        self.assertEqual(
            len(returned_tasks),
            len({task['project']['id'] for task in returned_tasks}),
        )

    def test_unassigned_employee_cannot_modify_another_employees_task(self):
        task = self.project.follow_up_tasks.get(
            target_progress=PROGRESS_STAGES[5],
        )
        self.client.force_login(self.other)
        response = self.client.patch(
            reverse('follow-up-task-detail', args=[task.id]),
            data=json.dumps({'status': FollowUpTask.Status.WAITING}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_completion_requires_result_and_advances_project(self):
        task = self.project.follow_up_tasks.get(
            target_progress=PROGRESS_STAGES[5],
        )
        self.client.force_login(self.technical)
        url = reverse('follow-up-task-detail', args=[task.id])
        response = self.client.patch(
            url,
            data=json.dumps({'status': FollowUpTask.Status.COMPLETED}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

        response = self.client.patch(
            url,
            data=json.dumps({
                'status': FollowUpTask.Status.COMPLETED,
                'result': '已完成现场工作并上传记录',
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

        self.project.refresh_from_db()
        self.customer.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(task.status, FollowUpTask.Status.COMPLETED)
        self.assertEqual(self.project.progress, PROGRESS_STAGES[5])
        self.assertEqual(self.customer.progress, PROGRESS_STAGES[5])
        self.assertTrue(
            self.project.follow_up_tasks.filter(
                target_progress=PROGRESS_STAGES[6],
                assignee=self.technical,
                status=FollowUpTask.Status.PENDING,
            ).exists(),
        )

        detail_response = self.client.get(
            reverse('customer-detail', args=[self.customer.id]),
        )
        self.assertEqual(detail_response.status_code, 200)
        completed_record = next(
            item for item in detail_response.json()['followUps']
            if item['id'] == task.id
        )
        self.assertEqual(completed_record['result'], '已完成现场工作并上传记录')
        self.assertTrue(completed_record['completedLabel'])
        self.assertEqual(completed_record['fromProgress'], PROGRESS_STAGES[4])


class TomorrowItemApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='tomorrow-user',
            password='123456',
        )
        self.other = get_user_model().objects.create_user(
            username='tomorrow-other',
            password='123456',
        )
        self.client.force_login(self.user)

    def test_user_can_create_list_complete_and_delete_own_item(self):
        planned_date = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.client.post(
            reverse('tomorrow-items'),
            data=json.dumps({
                'title': '整理明日客户回访名单',
                'note': '优先处理A级客户',
                'plannedDate': planned_date,
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        item_id = response.json()['item']['id']

        response = self.client.get(
            reverse('tomorrow-items'),
            {'date': planned_date},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['items']), 1)
        self.assertEqual(response.json()['items'][0]['title'], '整理明日客户回访名单')

        response = self.client.patch(
            reverse('tomorrow-item-detail', args=[item_id]),
            data=json.dumps({'isCompleted': True}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['item']['isCompleted'])

        response = self.client.delete(
            reverse('tomorrow-item-detail', args=[item_id]),
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(TomorrowItem.objects.filter(id=item_id).exists())

    def test_items_are_private_to_the_logged_in_account(self):
        private_item = TomorrowItem.objects.create(
            user=self.other,
            title='其他员工的明日事项',
        )
        response = self.client.get(reverse('tomorrow-items'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['items'], [])

        response = self.client.patch(
            reverse('tomorrow-item-detail', args=[private_item.id]),
            data=json.dumps({'isCompleted': True}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)

    def test_item_title_is_required(self):
        response = self.client.post(
            reverse('tomorrow-items'),
            data=json.dumps({'title': ''}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
