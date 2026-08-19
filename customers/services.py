from datetime import timedelta

from django.utils import timezone

from .models import FollowUpTask, Project, ProjectType


PROGRESS_STAGES = (
    '需求对接',
    '技术验证',
    '客户深度沟通',
    '方案与报价',
    '合同签订',
    '项目实施跟进',
    '售后维护与需求挖掘',
)

FOLLOW_UP_CUSTOMER_GRADES = ('A', 'B')

LEGACY_PROGRESS_MAPPING = {
    '新客资': '需求对接',
    '前期了解': '需求对接',
    '需求确认': '需求对接',
    '客户考察/来访完成': '客户深度沟通',
    '深度需求沟通完成': '客户深度沟通',
    '现场勘察': '客户深度沟通',
    '现场勘查完成': '客户深度沟通',
    '寄样与实验完成': '技术验证',
    '技术可行性确认': '技术验证',
    '方案设计': '技术验证',
    '方案确认': '方案与报价',
    '报价中': '方案与报价',
    '技术方案验证汇报通过': '方案与报价',
    '商务洽谈': '方案与报价',
    '商务报价与合同签订': '合同签订',
    '已成交': '合同签订',
    '技术交底完成': '项目实施跟进',
    '试验段施工完成': '项目实施跟进',
    'A段施工完成': '项目实施跟进',
    'B段施工完成': '项目实施跟进',
    '客户满意度回访完成': '售后维护与需求挖掘',
}

NEXT_TASKS = {
    '技术验证': ('组织技术评估、寄样测试并反馈实验结果', ('business', 'technical')),
    '客户深度沟通': ('邀约客户来访并完成深度沟通，必要时安排现场勘查', ('business',)),
    '方案与报价': ('完成技术方案、报价及商务谈判', ('business', 'technical')),
    '合同签订': ('推进合同评审、签署、用印及开票', ('business',)),
    '项目实施跟进': ('组织技术交底、试验段及现场施工指导', ('technical',)),
    '售后维护与需求挖掘': ('开展满意度回访，挖掘复购及转介绍机会', ('business',)),
}


def normalize_progress(progress):
    return LEGACY_PROGRESS_MAPPING.get(progress, progress)


def progress_index(progress):
    try:
        return PROGRESS_STAGES.index(normalize_progress(progress))
    except ValueError:
        return 0


def follow_up_task_matches_project_progress(task):
    """Keep system history aligned with the project's current milestone."""
    if task.is_manual:
        return True
    current_progress = normalize_progress(task.project.progress)
    target_progress = normalize_progress(task.target_progress)
    if current_progress not in PROGRESS_STAGES or target_progress not in PROGRESS_STAGES:
        return False
    try:
        current_index = PROGRESS_STAGES.index(current_progress)
        target_index = PROGRESS_STAGES.index(target_progress)
    except ValueError:
        return False
    return target_index <= min(current_index + 1, len(PROGRESS_STAGES) - 1)


def sync_project_followup_tasks(project):
    if project.customer.grade not in FOLLOW_UP_CUSTOMER_GRADES:
        return

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


def sync_customer_primary_project(customer, project_type_id='preserve'):
    project = customer.projects.order_by('created_at', 'id').first()
    if project is None:
        project = Project(customer=customer)
    if project_type_id != 'preserve':
        project.project_type = (
            ProjectType.objects.filter(id=project_type_id).first()
            if project_type_id else None
        )
    project.name = customer.plan or f'{customer.name}项目'
    project.progress = customer.progress
    project.plan = customer.plan
    project.province = customer.province
    project.city = customer.city
    project.district = customer.district
    project.business_owner = customer.business_owner
    project.technical_owner = customer.technical_owner
    project.save()

    # 客资页面维护的是客户级负责人，因此同一客户下的所有项目和任务
    # 都应使用这两位负责人。任务包含已完成和临时任务，避免历史记录
    # 继续显示“待分配”或旧负责人。
    customer.projects.update(
        business_owner=customer.business_owner,
        technical_owner=customer.technical_owner,
    )
    FollowUpTask.objects.filter(
        project__customer=customer,
        role=FollowUpTask.Role.BUSINESS,
    ).update(assignee=customer.business_owner)
    FollowUpTask.objects.filter(
        project__customer=customer,
        role=FollowUpTask.Role.TECHNICAL,
    ).update(assignee=customer.technical_owner)
    return project
