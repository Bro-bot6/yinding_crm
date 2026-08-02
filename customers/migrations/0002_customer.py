import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


DEMO_CUSTOMERS = [
    ('浙江恒筑工程', '138****6672', '抖音', '短视频私信', '浙江省', '杭州市', 'A', '园区道路土凝岩施工方案', '方案确认', '王经理', '陈工', '#5b7cfa'),
    ('张先生', '186****3021', '视频号', '直播间咨询', '广东省', '佛山市', 'A', '厂区地坪改造方案', '商务洽谈', '李经理', '周工', '#8b5cf6'),
    ('山东路达建设', '159****4826', '抖音', '广告投放', '山东省', '济南市', 'B', '乡村道路硬化方案', '已成交', '王经理', '陈工', '#19a974'),
    ('刘工', '177****9530', '视频号', '自然搜索', '四川省', '成都市', 'B', '景区步道材料建议', '需求确认', '赵经理', '周工', '#f59e0b'),
    ('河南新材项目部', '132****4178', '抖音', '直播间咨询', '河南省', '郑州市', 'C', '待现场参数确认', '前期了解', '李经理', '待分配', '#0ea5e9'),
    ('湖北诚远施工', '180****8824', '朋友介绍', '介绍人：陈先生', '湖北省', '武汉市', 'A', '物流园重载道路方案', '报价中', '赵经理', '陈工', '#ec4899'),
    ('福建绿建工程', '135****7641', '抖音', '短视频私信', '福建省', '厦门市', 'B', '滨海步道施工方案', '现场勘察', '王经理', '周工', '#14b8a6'),
    ('杭州森远建材', '137****2189', '视频号', '直播间咨询', '浙江省', '杭州市', 'B', '仓储区地面加固方案', '已成交', '李经理', '陈工', '#6366f1'),
    ('宁波海创建设', '188****5503', '朋友介绍', '介绍人：赵总', '浙江省', '宁波市', 'A', '港区道路耐磨方案', '方案确认', '赵经理', '周工', '#2563eb'),
    ('绍兴陈先生', '150****3927', '抖音', '短视频私信', '浙江省', '绍兴市', 'C', '庭院地面材料建议', '前期了解', '王经理', '待分配', '#64748b'),
    ('佛山鼎创建材', '139****8046', '视频号', '自然搜索', '广东省', '佛山市', 'B', '厂房道路施工方案', '方案设计', '李经理', '周工', '#0891b2'),
    ('东莞黄工', '181****6340', '抖音', '直播间咨询', '广东省', '东莞市', 'C', '园区步道材料建议', '需求确认', '赵经理', '待分配', '#0d9488'),
    ('青岛海岳工程', '156****9175', '朋友介绍', '介绍人：孙经理', '山东省', '青岛市', 'A', '滨海道路土凝岩方案', '已成交', '王经理', '陈工', '#0284c7'),
    ('临沂周先生', '133****4612', '抖音', '广告投放', '山东省', '临沂市', 'C', '乡村庭院改造建议', '前期了解', '李经理', '待分配', '#475569'),
    ('江苏路联建设', '189****2058', '视频号', '直播间咨询', '江苏省', '南京市', 'B', '市政辅路施工方案', '方案设计', '赵经理', '陈工', '#7c3aed'),
    ('苏州吴经理', '151****7384', '抖音', '短视频私信', '江苏省', '苏州市', 'C', '厂区地坪需求评估', '需求确认', '王经理', '周工', '#9333ea'),
    ('洛阳厚土工程', '158****3691', '朋友介绍', '介绍人：王工', '河南省', '洛阳市', 'B', '景区道路硬化方案', '报价中', '李经理', '陈工', '#c2410c'),
    ('成都蜀创建材', '136****8420', '视频号', '自然搜索', '四川省', '成都市', 'A', '物流场地重载方案', '商务洽谈', '赵经理', '周工', '#ea580c'),
    ('合肥安创建设', '187****1265', '抖音', '广告投放', '安徽省', '合肥市', 'B', '园区道路改造方案', '方案确认', '王经理', '陈工', '#16a34a'),
    ('石家庄赵工', '152****5908', '视频号', '直播间咨询', '河北省', '石家庄市', 'C', '项目材料初步建议', '前期了解', '李经理', '待分配', '#65a30d'),
]


def seed_customers(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    for index, row in enumerate(DEMO_CUSTOMERS):
        name, phone, source, channel, province, city, grade, plan, progress, owner, tech, color = row
        referrer = channel.removeprefix('介绍人：') if source == '朋友介绍' else ''
        Customer.objects.create(
            name=name,
            phone=phone,
            source=source,
            channel=channel,
            referrer=referrer,
            province=province,
            city=city,
            grade=grade,
            plan=plan,
            progress=progress,
            business_owner_name=owner,
            technical_owner_name=tech,
            color=color,
            sort_order=index,
        )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Customer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='客户名称')),
                ('phone', models.CharField(blank=True, max_length=30, verbose_name='联系电话')),
                ('source', models.CharField(default='抖音', max_length=30, verbose_name='客资来源')),
                ('channel', models.CharField(blank=True, max_length=100, verbose_name='来源说明')),
                ('referrer', models.CharField(blank=True, max_length=100, verbose_name='介绍人')),
                ('province', models.CharField(blank=True, max_length=50, verbose_name='省')),
                ('city', models.CharField(blank=True, max_length=50, verbose_name='市')),
                ('district', models.CharField(blank=True, max_length=50, verbose_name='区县')),
                ('grade', models.CharField(default='B', max_length=1, verbose_name='客户等级')),
                ('description', models.TextField(blank=True, verbose_name='客户描述')),
                ('progress', models.CharField(default='新客资', max_length=30, verbose_name='项目进度')),
                ('plan', models.TextField(blank=True, verbose_name='施工方案')),
                ('business_owner_name', models.CharField(blank=True, max_length=100, verbose_name='商务负责人')),
                ('technical_owner_name', models.CharField(blank=True, max_length=100, verbose_name='技术负责人')),
                ('color', models.CharField(blank=True, max_length=20, verbose_name='标识颜色')),
                ('sort_order', models.PositiveIntegerField(default=0, verbose_name='排序')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('business_owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='business_customers', to=settings.AUTH_USER_MODEL, verbose_name='商务负责人账号')),
                ('technical_owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='technical_customers', to=settings.AUTH_USER_MODEL, verbose_name='技术负责人账号')),
            ],
            options={
                'verbose_name': '客资信息',
                'verbose_name_plural': '客资信息',
                'ordering': ('sort_order', 'id'),
            },
        ),
        migrations.RunPython(seed_customers, migrations.RunPython.noop),
    ]
