from datetime import timedelta

from django.utils import timezone

from .models import CustomerProjectAssociation, FollowUpTask, Project, ProjectType


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
    """Legacy entry point: stage changes no longer create or complete tasks.

    Historical records are retained. Deadlines and completion are explicit
    user actions, independent of a project's formal stage.
    """
    return


def sync_customer_primary_project(
    customer,
    project_type_id='preserve',
    *,
    project_name='preserve',
    previous_business_owner_id='preserve',
    previous_technical_owner_id='preserve',
):
    project = customer.projects.order_by('created_at', 'id').first()
    if project is None:
        project = Project(customer=customer)
    if project_type_id != 'preserve':
        project.project_type = (
            ProjectType.objects.filter(id=project_type_id).first()
            if project_type_id else None
        )
    # 项目名称是独立、稳定的业务标识。显式传入时才更新；兼容没有项目的
    # 历史客户时使用可追溯编号，不借用客户名称，也不覆盖已有项目名。
    if project_name != 'preserve':
        project.name = str(project_name).strip()[:150]
    elif project.pk is None:
        project.name = f'历史项目 #C{customer.id}'
    project.progress = customer.progress
    project.plan = customer.plan
    project.province = customer.province
    project.country = customer.country
    project.city = customer.city
    project.district = customer.district
    if project.pk is None or project.owners_inherit_customer:
        project.business_owner = customer.business_owner
        project.technical_owner = customer.technical_owner
    project.save()
    CustomerProjectAssociation.objects.get_or_create(
        customer=customer,
        project=project,
    )

    FollowUpTask.objects.filter(
        project=project, role=FollowUpTask.Role.BUSINESS,
    ).update(assignee=project.business_owner)
    FollowUpTask.objects.filter(
        project=project, role=FollowUpTask.Role.TECHNICAL,
    ).update(assignee=project.technical_owner)

    # 客户级负责人是新项目的默认值。已有项目若仍沿用客户原负责人则同步，
    # 已经在项目层明确改派的负责人保持独立，避免多项目互相覆盖。
    if previous_business_owner_id != 'preserve' or previous_technical_owner_id != 'preserve':
        inherited_projects = customer.projects.exclude(id=project.id).filter(
            owners_inherit_customer=True,
        )
        inherited_ids = list(inherited_projects.values_list('id', flat=True))
        inherited_projects.update(
            business_owner=customer.business_owner,
            technical_owner=customer.technical_owner,
        )
        FollowUpTask.objects.filter(
            project_id__in=inherited_ids,
            role=FollowUpTask.Role.BUSINESS,
        ).update(assignee=customer.business_owner)
        FollowUpTask.objects.filter(
            project_id__in=inherited_ids,
            role=FollowUpTask.Role.TECHNICAL,
        ).update(assignee=customer.technical_owner)
    return project
