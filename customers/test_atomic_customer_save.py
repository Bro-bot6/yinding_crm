import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Customer, EmployeeProfile, Project, ProjectType


class AtomicCustomerSaveTests(TestCase):
    def setUp(self):
        self.client.force_login(get_user_model().objects.create_superuser(username='atomic-save-test'))
        self.customer = Customer.objects.create(name='原客户', phone='wx_test', grade='C')
        self.payload = dict(name='修改客户', phone='wx_test', grade='B', source='抖音',
                            province='河北省', city='衡水市', district='', progress='需求对接', plan='',
                            projectTypeId=ProjectType.objects.get(name='道路').id,
                            ownerId='', techId='', allowIncomplete=True)
        self.url = reverse('customer-detail', args=[self.customer.id])

    def save(self, **changes):
        return self.client.patch(self.url, json.dumps({**self.payload, **changes}), content_type='application/json')

    def test_type_without_project_name_is_not_silent_success(self):
        response = self.save(projectName='')
        self.assertEqual(response.status_code, 400)
        self.assertIn('项目名称', response.json()['error'])
        self.customer.refresh_from_db()
        self.assertEqual((self.customer.name, self.customer.grade), ('原客户', 'C'))
        self.assertFalse(self.customer.projects.exists())

    def test_promote_batch_customer_and_persist_type_on_reload(self):
        response = self.save(projectName='真实道路项目')
        self.assertEqual(response.status_code, 200, response.content)
        project = self.customer.projects.get()
        self.assertEqual(project.project_type_id, self.payload['projectTypeId'])
        data = self.client.get(self.url, {'projectId': project.id}).json()
        self.assertEqual(data['customer']['grade'], 'B')
        self.assertEqual(data['projects'][0]['projectType']['id'], self.payload['projectTypeId'])
        self.assertEqual(data['customer']['projectTypeId'], self.payload['projectTypeId'])

    def test_secondary_project_type_does_not_modify_primary(self):
        primary = Project.objects.create(customer=self.customer, name='主项目', province='浙江省', city='杭州市')
        secondary = Project.objects.create(customer=self.customer, name='第二项目')
        response = self.save(projectId=secondary.id, projectName='第二道路项目')
        self.assertEqual(response.status_code, 200, response.content)
        primary.refresh_from_db()
        secondary.refresh_from_db()
        self.assertEqual((primary.name, primary.project_type_id, primary.province), ('主项目', None, '浙江省'))
        self.assertEqual((secondary.name, secondary.project_type_id), ('第二道路项目', self.payload['projectTypeId']))
        self.assertEqual(response.json()['project']['id'], secondary.id)

    def test_failed_project_write_rolls_back_customer(self):
        self.client.raise_request_exception = False
        with patch('customers.views.sync_customer_primary_project', side_effect=RuntimeError('test failure')):
            response = self.save(projectName='不可部分保存')
        self.assertEqual(response.status_code, 500)
        self.customer.refresh_from_db()
        self.assertEqual((self.customer.name, self.customer.grade), ('原客户', 'C'))
        self.assertFalse(self.customer.projects.exists())

    def test_invalid_project_or_type_does_not_change_customer(self):
        for changes in ({'projectId': 999999}, {'projectTypeId': 999999}):
            self.assertEqual(self.save(projectName='道路', **changes).status_code, 400)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.name, '原客户')

    def test_base_only_d_grade_save_still_allowed(self):
        response = self.save(grade='D', projectTypeId='', projectName='')
        self.assertEqual(response.status_code, 200)
        data = self.client.get(self.url).json()
        self.assertEqual(data['customer']['grade'], 'D')
        self.assertTrue(data['customer']['updatedAt'])

    def test_explicit_owner_edit_updates_independent_primary_project(self):
        owner = get_user_model().objects.create_user(username='new-project-owner')
        EmployeeProfile.objects.create(user=owner, role=EmployeeProfile.Role.BUSINESS)
        project = Project.objects.create(customer=self.customer, name='独立负责人项目', owners_inherit_customer=False)
        response = self.save(projectId=project.id, projectName=project.name, ownerId=owner.id)
        self.assertEqual(response.status_code, 200, response.content)
        project.refresh_from_db()
        self.assertEqual(project.business_owner_id, owner.id)
        response = self.save(projectId=project.id, projectName=project.name, ownerId='')
        self.assertEqual(response.status_code, 200, response.content)
        project.refresh_from_db()
        self.assertIsNone(project.business_owner_id)

    def test_d_grade_preserves_existing_project_metadata(self):
        self.customer.progress = '方案与报价'
        self.customer.plan = '原方案'
        self.customer.save()
        project = Project.objects.create(customer=self.customer, name='原项目', progress='方案与报价', plan='原方案', project_type_id=self.payload['projectTypeId'])
        response = self.save(projectId=project.id, projectName=project.name, grade='D', projectTypeId='', plan='', progress='需求对接')
        self.assertEqual(response.status_code, 200, response.content)
        project.refresh_from_db()
        self.assertEqual((project.progress, project.plan, project.project_type_id), ('方案与报价', '原方案', self.payload['projectTypeId']))
