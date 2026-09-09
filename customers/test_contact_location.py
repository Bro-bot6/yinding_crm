import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Customer, Project


class ContactAndOverseasLocationTests(TestCase):
    def setUp(self):
        self.client.force_login(get_user_model().objects.create_superuser(username='location-test'))
        self.payload = dict(name='海外测试客户', phone='+60 12-3456789', source='抖音', grade='C',
                            locationMode='overseas', country='Malaysia', province='', city='Kuala Lumpur',
                            district='', projectName='海外道路项目')

    def create(self, **changes):
        return self.client.post(reverse('customers-collection'),
                                json.dumps({**self.payload, **changes}), content_type='application/json')

    def test_foreign_create_edit_reload_and_domestic_history(self):
        domestic = Customer.objects.create(name='历史国内客户', phone='13800000000', province='河北省', city='衡水市')
        response = self.create()
        self.assertEqual(response.status_code, 201, response.content)
        customer = Customer.objects.get(id=response.json()['customer']['id'])
        project = customer.projects.get()
        self.assertEqual((project.country, project.city, project.province), ('Malaysia', 'Kuala Lumpur', ''))
        payload = {**self.payload, 'country': 'Singapore', 'city': 'Singapore', 'phone': '微信：overseas_01'}
        response = self.client.patch(reverse('customer-detail', args=[customer.id]), json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        detail = self.client.get(reverse('customer-detail', args=[customer.id]), {'projectId': project.id}).json()
        self.assertEqual(detail['customer']['phone'], payload['phone'])
        self.assertEqual(detail['projects'][0]['region'], 'Singapore · Singapore')
        domestic.refresh_from_db()
        self.assertEqual((domestic.country, domestic.province, domestic.city), ('', '河北省', '衡水市'))

    def test_secondary_project_location_does_not_overwrite_primary(self):
        self.create()
        customer = Customer.objects.get(name=self.payload['name'])
        primary = customer.projects.get()
        secondary = Project.objects.create(customer=customer, name='第二项目', province='河北省', city='衡水市')
        response = self.client.patch(reverse('project-detail', args=[secondary.id]), json.dumps({
            'country': 'Mongolia', 'city': 'Ulaanbaatar', 'province': '', 'district': '',
        }), content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        primary.refresh_from_db()
        self.assertEqual(primary.country, 'Malaysia')
        for project, country in [(primary, 'Malaysia'), (secondary, 'Mongolia')]:
            data = self.client.get(reverse('customer-detail', args=[customer.id]), {'projectId': project.id}).json()
            self.assertEqual(data['selectedProjectId'], project.id)
            self.assertEqual(next(p for p in data['projects'] if p['id'] == project.id)['country'], country)

    def test_country_and_city_required_contact_length_bounded(self):
        for changes in ({'country': ''}, {'city': ''}, {'phone': ''}, {'phone': 'x' * 101}):
            self.assertEqual(self.create(**changes).status_code, 400)
        self.assertFalse(Customer.objects.filter(name=self.payload['name']).exists())

    def test_wechat_status_create_edit_preserve_and_reload(self):
        response = self.create(wechatStatus='yes')
        self.assertEqual(response.status_code, 201)
        customer_id = response.json()['customer']['id']
        url = reverse('customer-detail', args=[customer_id])
        self.assertEqual(self.client.get(url).json()['customer']['wechatStatus'], 'yes')
        response = self.client.patch(url, json.dumps(self.payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['customer']['wechatStatus'], 'yes')
        response = self.client.patch(url, json.dumps({**self.payload, 'wechatStatus': 'no'}), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(url).json()['customer']['wechatStatus'], 'no')
        response = self.client.patch(url, json.dumps({**self.payload, 'wechatStatus': 'rejected'}), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(url).json()['customer']['wechatStatus'], 'rejected')
        self.assertEqual(self.create(wechatStatus='invalid').status_code, 400)
        self.assertEqual(Customer.objects.create(name='默认未添加').wechat_status, 'no')

    def test_batch_contacts_and_atomic_validation(self):
        values = ['wx_abc', 'QQ：123456', '+1 415 555 1234']
        response = self.client.post(reverse('customers-import'), json.dumps({
            'mode': 'leads', 'customers': [dict(name=f'批量{i}', phone=value) for i, value in enumerate(values)],
        }), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(list(Customer.objects.filter(name__startswith='批量').values_list('phone', flat=True)), values)
        self.assertFalse(Project.objects.filter(customer__name__startswith='批量').exists())
        response = self.client.post(reverse('customers-import'), json.dumps({
            'mode': 'leads', 'customers': [dict(name='不可部分保存', phone='wx_ok'), dict(name='空联系方式', phone='')],
        }), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Customer.objects.filter(name='不可部分保存').exists())

    def test_foreign_customers_not_counted_as_domestic_provinces(self):
        self.create()
        Customer.objects.create(name='国内', province='河北省', city='衡水市')
        from .views import filtered_map_customers
        from django.test import RequestFactory
        request = RequestFactory().get('/')
        request.user = get_user_model().objects.get(username='location-test')
        self.assertFalse(filtered_map_customers(request).exclude(country='').exists())
        self.assertTrue(filtered_map_customers(request).filter(name='国内').exists())
