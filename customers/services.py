from datetime import timedelta

from django.utils import timezone

from .models import FollowUpTask, Project


PROGRESS_STAGES = (
    '新客资',
    '客户考察/来访完成',
    '深度需求沟通完成',
    '寄样与实验完成',
    '技术可行性确认',
    '现场勘查完成',
    '技术方案验证汇报通过',
    '商务报价与合同签订',
    '技术交底完成',
    '试验段施工完成',
    'A段施工完成',
    'B段施工完成',
    '客户满意度回访完成',
)

NEXT_TASKS = {
    '客户考察/来访完成': ('安排客户考察或来访并记录结论', ('business',)),
    '深度需求沟通完成': ('完成深度需求沟通并整理关键参数', ('business',)),
    '寄样与实验完成': ('协调寄样与实验并记录实验结果', ('business', 'technical')),
    '技术可行性确认': ('完成技术可行性确认', ('technical',)),
    '现场勘查完成': ('完成项目现场勘查并整理现场条件', ('technical',)),
    '技术方案验证汇报通过': ('编制技术方案并完成验证汇报', ('technical',)),
    '商务报价与合同签订': ('完成商务报价并推进合同签订', ('business',)),
    '技术交底完成': ('完成项目技术交底', ('technical',)),
    '试验段施工完成': ('组织试验段施工并记录验证结果', ('technical',)),
    'A段施工完成': ('推进并完成 A 段施工', ('business', 'technical')),
    'B段施工完成': ('推进并完成 B 段施工', ('business', 'technical')),
    '客户满意度回访完成': ('完成客户满意度回访并记录反馈', ('business',)),
}


def progress_index(progress):
    try:
        return PROGRESS_STAGES.index(progress)
    except ValueError:
        return 0


def sync_project_followup_tasks(project):
    current_index = progress_index(project.progress)
    now = timezone.now()

    for task in project.follow_up_tasks.exclude(status=FollowUpTask.Status.COMPLETED):
        if progress_index(task.target_progress) <= current_index:
            task.status = FollowUpTask.Status.COMPLETED
            task.completed_at = now
            if not task.result:
                task.result = '项目进度更新后由系统自动完成'
            task.save(update_fields=('status', 'completed_at', 'result', 'updated_at'))

    if current_index >= len(PROGRESS_STAGES) - 1:
        return

    target_progress = PROGRESS_STAGES[current_index + 1]
    title, roles = NEXT_TASKS[target_progress]
    for role in roles:
        assignee = (
            project.business_owner
            if role == FollowUpTask.Role.BUSINESS
            else project.technical_owner
        )
        task, created = FollowUpTask.objects.get_or_create(
            project=project,
            target_progress=target_progress,
            role=role,
            defaults={
                'title': title,
                'assignee': assignee,
                'due_at': now + timedelta(days=3),
            },
        )
        if not created and task.status != FollowUpTask.Status.COMPLETED:
            changed_fields = []
            if task.title != title:
                task.title = title
                changed_fields.append('title')
            if task.assignee_id != getattr(assignee, 'id', None):
                task.assignee = assignee
                changed_fields.append('assignee')
            if changed_fields:
                task.save(update_fields=(*changed_fields, 'updated_at'))


def sync_customer_primary_project(customer):
    project = customer.projects.order_by('created_at', 'id').first()
    if project is None:
        project = Project(customer=customer)
    project.name = customer.plan or f'{customer.name}项目'
    project.progress = customer.progress
    project.plan = customer.plan
    project.province = customer.province
    project.city = customer.city
    project.district = customer.district
    project.business_owner = customer.business_owner
    project.technical_owner = customer.technical_owner
    project.save()
    return project
