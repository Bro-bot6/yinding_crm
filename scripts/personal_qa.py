"""Disposable, loopback-only visual QA instance; never uses the business DB."""
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
qa_data = root / 'private-qa-personal'
os.environ['DJANGO_DATA_DIR'] = str(qa_data)
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
os.environ['DJANGO_DEBUG'] = 'True'
os.environ['DJANGO_ALLOWED_HOSTS'] = '127.0.0.1,localhost'
import django
django.setup()
from django.conf import settings
assert Path(settings.DATABASES['default']['NAME']).resolve().parent == qa_data.resolve()
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from customers.models import Customer, EmployeeProfile, Project, ProjectProgressUpdate, TomorrowItem

if '--prepare' in sys.argv:
    call_command('migrate', interactive=False, verbosity=0)
    user, _ = get_user_model().objects.get_or_create(username='qa-personal')
    user.set_password('Local-QA-only-2026')
    user.save()
    EmployeeProfile.objects.update_or_create(user=user, defaults={'role': 'both', 'nickname': '测试员工'})
    qa_sources = ['抖音', '视频号', '服务号', '朋友介绍']
    qa_wechat_statuses = ['yes', 'no', 'rejected', 'yes']
    for i, grade in enumerate('ABCD'):
        customer, _ = Customer.objects.get_or_create(name='隔离测试客户' + grade, defaults={
            'phone': 'wx:qa_' + grade, 'grade': grade, 'source': qa_sources[i],
            'province': '河北省', 'city': '唐山市', 'description': '用于检查卡片布局与长描述展开，不是真实客户。' * 6,
            'business_owner': user, 'technical_owner': user,
        })
        customer.source = qa_sources[i]
        customer.wechat_status = qa_wechat_statuses[i]
        customer.referrer = '隔离介绍人' if customer.source == '朋友介绍' else ''
        customer.save(update_fields=('source', 'wechat_status', 'referrer'))
        project, _ = Project.objects.get_or_create(customer=customer, name='隔离测试项目' + grade, defaults={
            'business_owner': user, 'technical_owner': user, 'province': '河北省', 'city': '唐山市',
        })
        if grade in 'AB':
            ProjectProgressUpdate.objects.get_or_create(project=project, content='已确认客户需求，准备资料并安排下次沟通', defaults={'occurred_at': timezone.now() - timedelta(days=i), 'created_by': user})
    for i in range(5):
        TomorrowItem.objects.get_or_create(user=user, title='隔离日程' + str(i + 1), defaults={
            'planned_date': timezone.localdate(), 'planned_time': '14:00' if i % 2 else None,
            'kind': ['personal', 'appointment', 'project'][i % 3], 'note': '仅用于界面验证',
        })
    print('Isolated QA prepared at', qa_data)
else:
    call_command('runserver', '127.0.0.1:8001', use_reloader=False)
