from datetime import timedelta

from django.db import migrations
from django.utils import timezone


PROGRESS_STAGES = (
    '需求对接',
    '技术验证',
    '客户深度沟通',
    '方案与报价',
    '合同签订',
    '项目实施跟进',
    '售后维护与需求挖掘',
)

NEXT_TASKS = {
    '技术验证': ('组织技术评估、寄样测试并反馈实验结果', ('business', 'technical')),
    '客户深度沟通': ('邀约客户来访并完成深度沟通，必要时安排现场勘查', ('business',)),
    '方案与报价': ('完成技术方案、报价及商务谈判', ('business', 'technical')),
    '合同签订': ('推进合同评审、签署、用印及开票', ('business',)),
    '项目实施跟进': ('组织技术交底、试验段及现场施工指导', ('technical',)),
    '售后维护与需求挖掘': ('开展满意度回访，挖掘复购及转介绍机会', ('business',)),
}


def sync_core_progress_tasks(apps, schema_editor):
    Project = apps.get_model('customers', 'Project')
    FollowUpTask = apps.get_model('customers', 'FollowUpTask')
    now = timezone.now()

    for project in Project.objects.select_related('customer').iterator():
        if project.customer.grade not in ('A', 'B'):
            continue
        try:
            current_index = PROGRESS_STAGES.index(project.progress)
        except ValueError:
            continue

        for task in FollowUpTask.objects.filter(
            project=project,
            is_manual=False,
        ).exclude(status='completed'):
            try:
                task_index = PROGRESS_STAGES.index(task.target_progress)
            except ValueError:
                continue
            if task_index <= current_index:
                task.status = 'completed'
                task.completed_at = now
                if not task.result:
                    task.result = '项目进度迁移后由系统自动完成'
                task.save(update_fields=('status', 'completed_at', 'result', 'updated_at'))

        if current_index >= len(PROGRESS_STAGES) - 1:
            continue
        target_progress = PROGRESS_STAGES[current_index + 1]
        title, roles = NEXT_TASKS[target_progress]
        for role in roles:
            assignee_id = (
                project.business_owner_id
                if role == 'business'
                else project.technical_owner_id
            )
            task, created = FollowUpTask.objects.get_or_create(
                project=project,
                target_progress=target_progress,
                role=role,
                is_manual=False,
                defaults={
                    'title': title,
                    'assignee_id': assignee_id,
                    'due_at': now + timedelta(days=3),
                },
            )
            if created or task.status == 'completed':
                continue
            changed_fields = []
            if task.title != title:
                task.title = title
                changed_fields.append('title')
            if task.assignee_id != assignee_id:
                task.assignee_id = assignee_id
                changed_fields.append('assignee')
            if changed_fields:
                task.save(update_fields=(*changed_fields, 'updated_at'))


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0017_unify_customer_project_progress_stages'),
    ]

    operations = [
        migrations.RunPython(sync_core_progress_tasks, migrations.RunPython.noop),
    ]
