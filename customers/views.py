import json
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from .models import Customer, EmployeeProfile, FollowUpTask, Project, TomorrowItem
from .services import PROGRESS_STAGES, sync_customer_primary_project


@require_GET
@login_required
def available_employees(request):
    users = (
        get_user_model()
        .objects.filter(is_active=True)
        .select_related('employee_profile')
        .order_by('first_name', 'username')
    )
    result = {'business': [], 'technical': []}
    for user in users:
        profile = getattr(user, 'employee_profile', None)
        if not user.is_superuser and profile is None:
            continue
        role = EmployeeProfile.Role.BOTH if user.is_superuser else profile.role
        display_name = (
            profile.nickname if profile and profile.nickname
            else user.get_full_name() or user.username
        )
        employee = {
            'id': user.id,
            'username': user.username,
            'display_name': display_name,
            'role': role,
        }
        if role in (EmployeeProfile.Role.BUSINESS, EmployeeProfile.Role.BOTH):
            result['business'].append(employee)
        if role in (EmployeeProfile.Role.TECHNICAL, EmployeeProfile.Role.BOTH):
            result['technical'].append(employee)
    return JsonResponse(result)


def employee_display_name(user, fallback='待分配'):
    if not user:
        return fallback
    profile = getattr(user, 'employee_profile', None)
    return (
        profile.nickname if profile and profile.nickname
        else user.get_full_name() or user.username
    )


def stage_percent(progress):
    return {
        '新客资': 5,
        '客户考察/来访完成': 13,
        '深度需求沟通完成': 21,
        '寄样与实验完成': 29,
        '技术可行性确认': 37,
        '现场勘查完成': 45,
        '技术方案验证汇报通过': 53,
        '商务报价与合同签订': 60,
        '技术交底完成': 68,
        '试验段施工完成': 76,
        'A段施工完成': 84,
        'B段施工完成': 92,
        '客户满意度回访完成': 100,
    }.get(progress, 5)


def serialize_customer(customer):
    created_at = timezone.localtime(customer.created_at)
    owner_name = employee_display_name(
        customer.business_owner,
        customer.business_owner_name or '待分配',
    )
    tech_name = employee_display_name(
        customer.technical_owner,
        customer.technical_owner_name or '待分配',
    )
    return {
        'id': customer.id,
        'name': customer.name,
        'phone': customer.phone,
        'source': customer.source,
        'channel': customer.channel,
        'referrer': customer.referrer,
        'province': customer.province,
        'city': customer.city,
        'district': customer.district,
        'region': ' · '.join(filter(None, (customer.province, customer.city))),
        'grade': customer.grade,
        'description': customer.description,
        'progress': customer.progress,
        'percent': stage_percent(customer.progress),
        'plan': customer.plan,
        'ownerId': customer.business_owner_id or '',
        'owner': owner_name,
        'techId': customer.technical_owner_id or '',
        'tech': tech_name,
        'createdAt': customer.created_at.isoformat(),
        'createdDate': created_at.strftime('%Y-%m-%d'),
        'created': created_at.strftime('%Y年%m月%d日'),
        'updated': customer.updated_at.strftime('%m月%d日 %H:%M'),
        'color': customer.color or '#5b7cfa',
    }


def parse_payload(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return None, JsonResponse({'error': '请求数据格式不正确'}, status=400)
    if not isinstance(payload, dict):
        return None, JsonResponse({'error': '请求数据格式不正确'}, status=400)
    return payload, None


def get_available_owner(user_id, allowed_roles):
    if not user_id:
        return None
    user = (
        get_user_model()
        .objects.filter(id=user_id, is_active=True)
        .select_related('employee_profile')
        .first()
    )
    if not user:
        return None
    if user.is_superuser:
        return user
    profile = getattr(user, 'employee_profile', None)
    if not profile or profile.role not in allowed_roles:
        return None
    return user


def update_customer_from_payload(customer, payload):
    required = {
        'name': '客户名称',
        'province': '省份',
        'city': '城市',
    }
    missing = [
        label for field, label in required.items()
        if not str(payload.get(field, '')).strip()
    ]
    if missing:
        return f"请填写：{'、'.join(missing)}"

    source = str(payload.get('source', '抖音')).strip()
    referrer = str(payload.get('referrer', '')).strip() if source == '朋友介绍' else ''
    if source == '朋友介绍' and not referrer:
        return '朋友介绍的客资必须填写介绍人'

    owner_id = payload.get('ownerId')
    technician_id = payload.get('techId')
    owner = None
    technician = None
    if owner_id:
        owner = get_available_owner(
            owner_id,
            (EmployeeProfile.Role.BUSINESS, EmployeeProfile.Role.BOTH),
        )
        if not owner:
            return '所选商务负责人账号不可用'
    if technician_id:
        technician = get_available_owner(
            technician_id,
            (EmployeeProfile.Role.TECHNICAL, EmployeeProfile.Role.BOTH),
        )
        if not technician:
            return '所选技术负责人账号不可用'

    customer.name = str(payload.get('name', '')).strip()
    customer.phone = str(payload.get('phone', '')).strip()
    customer.source = source
    customer.referrer = referrer
    customer.channel = f'介绍人：{referrer}' if referrer else '手动修改'
    customer.province = str(payload.get('province', '')).strip()
    customer.city = str(payload.get('city', '')).strip()
    customer.district = str(payload.get('district', '')).strip()
    grade = str(payload.get('grade', 'D')).strip().upper()
    customer.grade = grade if grade in ('A', 'B', 'C', 'D') else 'D'
    customer.description = str(payload.get('description', '')).strip()
    progress = str(payload.get('progress', '新客资')).strip()
    if progress not in PROGRESS_STAGES:
        return '请选择有效的项目进度'
    customer.progress = progress
    customer.plan = str(payload.get('plan', '')).strip() or '方案待完善'
    if owner:
        customer.business_owner = owner
        customer.business_owner_name = employee_display_name(owner)
    if technician:
        customer.technical_owner = technician
        customer.technical_owner_name = employee_display_name(technician)
    return ''


@login_required
@require_http_methods(['GET', 'POST'])
def customers_collection(request):
    if request.method == 'GET':
        customers = Customer.objects.select_related(
            'business_owner__employee_profile',
            'technical_owner__employee_profile',
        )
        projects = Project.objects.select_related(
            'customer',
            'business_owner__employee_profile',
            'technical_owner__employee_profile',
        )
        return JsonResponse({
            'customers': [serialize_customer(item) for item in customers],
            'projects': [serialize_project(item) for item in projects],
        })

    payload, error_response = parse_payload(request)
    if error_response:
        return error_response
    customer = Customer(sort_order=Customer.objects.count())
    validation_error = update_customer_from_payload(customer, payload)
    if validation_error:
        return JsonResponse({'error': validation_error}, status=400)
    customer.save()
    sync_customer_primary_project(customer)
    return JsonResponse({'customer': serialize_customer(customer)}, status=201)


@login_required
@require_http_methods(['GET', 'PATCH'])
def customer_detail(request, customer_id):
    customer = get_object_or_404(
        Customer.objects.select_related(
            'business_owner__employee_profile',
            'technical_owner__employee_profile',
        ),
        id=customer_id,
    )
    if request.method == 'GET':
        follow_ups = FollowUpTask.objects.filter(
            project__customer_id=customer.id,
        ).select_related(
            'assignee__employee_profile',
            'project__customer',
            'project__business_owner__employee_profile',
            'project__technical_owner__employee_profile',
        ).order_by('-completed_at', '-updated_at')
        return JsonResponse({
            'customer': serialize_customer(customer),
            'followUps': [serialize_follow_up_task(task) for task in follow_ups],
        })

    payload, error_response = parse_payload(request)
    if error_response:
        return error_response
    validation_error = update_customer_from_payload(customer, payload)
    if validation_error:
        return JsonResponse({'error': validation_error}, status=400)
    customer.save()
    sync_customer_primary_project(customer)
    customer = Customer.objects.select_related(
        'business_owner__employee_profile',
        'technical_owner__employee_profile',
    ).get(id=customer.id)
    return JsonResponse({'customer': serialize_customer(customer)})


def serialize_project(project):
    created_at = timezone.localtime(project.created_at)
    return {
        'id': project.id,
        'name': project.name,
        'progress': project.progress,
        'plan': project.plan,
        'region': ' · '.join(filter(None, (project.province, project.city, project.district))),
        'province': project.province,
        'city': project.city,
        'district': project.district,
        'customer': {
            'id': project.customer_id,
            'name': project.customer.name,
            'grade': project.customer.grade,
            'phone': project.customer.phone,
            'source': project.customer.source,
        },
        'businessOwner': {
            'id': project.business_owner_id or '',
            'name': employee_display_name(project.business_owner),
        },
        'technicalOwner': {
            'id': project.technical_owner_id or '',
            'name': employee_display_name(project.technical_owner),
        },
        'createdDate': created_at.strftime('%Y-%m-%d'),
        'created': created_at.strftime('%Y年%m月%d日'),
    }


def serialize_follow_up_task(task):
    now = timezone.now()
    try:
        target_index = PROGRESS_STAGES.index(task.target_progress)
    except ValueError:
        target_index = 0
    from_progress = PROGRESS_STAGES[max(0, target_index - 1)]
    is_overdue = (
        task.status != FollowUpTask.Status.COMPLETED
        and task.due_at is not None
        and task.due_at < now
    )
    return {
        'id': task.id,
        'title': task.title,
        'fromProgress': from_progress,
        'targetProgress': task.target_progress,
        'role': task.role,
        'roleLabel': task.get_role_display(),
        'status': task.status,
        'statusLabel': task.get_status_display(),
        'result': task.result,
        'completedAt': task.completed_at.isoformat() if task.completed_at else '',
        'completedLabel': (
            timezone.localtime(task.completed_at).strftime('%Y年%m月%d日 %H:%M')
            if task.completed_at else ''
        ),
        'updatedLabel': timezone.localtime(task.updated_at).strftime('%Y年%m月%d日 %H:%M'),
        'dueAt': task.due_at.isoformat() if task.due_at else '',
        'dueLabel': task.due_at.strftime('%m月%d日 %H:%M') if task.due_at else '未设置',
        'isOverdue': is_overdue,
        'assignee': {
            'id': task.assignee_id or '',
            'name': employee_display_name(task.assignee),
            'username': task.assignee.username if task.assignee else '',
        },
        'project': serialize_project(task.project),
    }


def collapse_tasks_by_project(tasks, now):
    """Return one current status card per project while preserving task history in the database."""
    grouped = {}
    for task in tasks:
        grouped.setdefault(task.project_id, []).append(task)

    collapsed = []
    for project_tasks in grouped.values():
        active_tasks = [
            task for task in project_tasks
            if task.status != FollowUpTask.Status.COMPLETED
        ]
        if active_tasks:
            active_tasks.sort(key=lambda task: (
                0 if task.due_at and task.due_at < now else 1,
                0 if task.status == FollowUpTask.Status.PENDING else 1,
                task.due_at or now + timedelta(days=36500),
                -task.updated_at.timestamp(),
            ))
            collapsed.append(active_tasks[0])
            continue

        collapsed.append(max(
            project_tasks,
            key=lambda task: task.completed_at or task.updated_at,
        ))

    return sorted(
        collapsed,
        key=lambda task: (
            task.status == FollowUpTask.Status.COMPLETED,
            task.due_at or now + timedelta(days=36500),
            -task.updated_at.timestamp(),
        ),
    )


@login_required
@require_GET
def follow_up_tasks(request):
    tasks = FollowUpTask.objects.select_related(
        'assignee__employee_profile',
        'project__customer',
        'project__business_owner__employee_profile',
        'project__technical_owner__employee_profile',
    )
    can_view_all = request.user.is_superuser
    if can_view_all:
        employee_id = request.GET.get('employee')
        if employee_id and employee_id.isdigit():
            tasks = tasks.filter(assignee_id=int(employee_id))
    else:
        tasks = tasks.filter(assignee=request.user)

    now = timezone.now()
    task_list = collapse_tasks_by_project(list(tasks), now)

    status = request.GET.get('status')
    if status == 'overdue':
        task_list = [
            task for task in task_list
            if task.status != FollowUpTask.Status.COMPLETED
            and task.due_at
            and task.due_at < now
        ]
    elif status in FollowUpTask.Status.values:
        task_list = [task for task in task_list if task.status == status]

    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    summary = {
        'total': len(task_list),
        'pending': sum(
            1 for task in task_list
            if task.status == FollowUpTask.Status.PENDING
            and not (task.due_at and task.due_at < now)
        ),
        'today': sum(
            1 for task in task_list
            if task.status == FollowUpTask.Status.PENDING
            and task.due_at
            and now <= task.due_at <= today_end
        ),
        'overdue': sum(
            1 for task in task_list
            if task.status != FollowUpTask.Status.COMPLETED
            and task.due_at
            and task.due_at < now
        ),
        'waiting': sum(
            1 for task in task_list
            if task.status == FollowUpTask.Status.WAITING
            and not (task.due_at and task.due_at < now)
        ),
        'completed': sum(1 for task in task_list if task.status == FollowUpTask.Status.COMPLETED),
    }

    employees = []
    if can_view_all:
        users = (
            get_user_model()
            .objects.filter(is_active=True)
            .filter(
                Q(employee_profile__role__in=(
                    EmployeeProfile.Role.BUSINESS,
                    EmployeeProfile.Role.TECHNICAL,
                    EmployeeProfile.Role.BOTH,
                ))
                | Q(is_superuser=True)
            )
            .select_related('employee_profile')
            .distinct()
            .order_by('username')
        )
        employees = [
            {
                'id': user.id,
                'name': employee_display_name(user),
                'username': user.username,
            }
            for user in users
        ]

    return JsonResponse({
        'tasks': [serialize_follow_up_task(task) for task in task_list],
        'summary': summary,
        'canViewAll': can_view_all,
        'employees': employees,
    })


@login_required
@require_http_methods(['PATCH'])
def follow_up_task_detail(request, task_id):
    task = get_object_or_404(
        FollowUpTask.objects.select_related('project__customer'),
        id=task_id,
    )
    if not request.user.is_superuser and task.assignee_id != request.user.id:
        return JsonResponse({'error': '无权修改该任务'}, status=403)

    payload, error_response = parse_payload(request)
    if error_response:
        return error_response
    status = str(payload.get('status', task.status)).strip()
    if status not in FollowUpTask.Status.values:
        return JsonResponse({'error': '任务状态不正确'}, status=400)
    result = str(payload.get('result', task.result)).strip()
    if status == FollowUpTask.Status.COMPLETED and not result:
        return JsonResponse({'error': '完成任务前请填写跟进结果'}, status=400)

    task.status = status
    task.result = result
    task.completed_at = timezone.now() if status == FollowUpTask.Status.COMPLETED else None
    task.save()

    if status == FollowUpTask.Status.COMPLETED:
        project = task.project
        project.progress = task.target_progress
        project.save()
        customer = project.customer
        primary_project_id = customer.projects.order_by('created_at', 'id').values_list('id', flat=True).first()
        if primary_project_id == project.id:
            customer.progress = project.progress
            customer.save(update_fields=('progress', 'updated_at'))

    refreshed = FollowUpTask.objects.select_related(
        'assignee__employee_profile',
        'project__customer',
        'project__business_owner__employee_profile',
        'project__technical_owner__employee_profile',
    ).get(id=task.id)
    return JsonResponse({'task': serialize_follow_up_task(refreshed)})


def serialize_tomorrow_item(item):
    return {
        'id': item.id,
        'title': item.title,
        'note': item.note,
        'plannedDate': item.planned_date.isoformat(),
        'isCompleted': item.is_completed,
        'completedAt': item.completed_at.isoformat() if item.completed_at else '',
        'createdAt': item.created_at.isoformat(),
    }


def parse_planned_date(value):
    if not value:
        return timezone.localdate() + timedelta(days=1)
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


@login_required
@require_http_methods(['GET', 'POST'])
def tomorrow_items(request):
    if request.method == 'GET':
        planned_date = parse_planned_date(request.GET.get('date'))
        if planned_date is None:
            return JsonResponse({'error': '计划日期格式不正确'}, status=400)
        items = TomorrowItem.objects.filter(
            user=request.user,
            planned_date=planned_date,
        )
        return JsonResponse({
            'date': planned_date.isoformat(),
            'items': [serialize_tomorrow_item(item) for item in items],
        })

    payload, error_response = parse_payload(request)
    if error_response:
        return error_response
    title = str(payload.get('title', '')).strip()
    note = str(payload.get('note', '')).strip()
    planned_date = parse_planned_date(payload.get('plannedDate'))
    if not title:
        return JsonResponse({'error': '请输入事项内容'}, status=400)
    if len(title) > 160:
        return JsonResponse({'error': '事项内容不能超过160个字'}, status=400)
    if planned_date is None:
        return JsonResponse({'error': '计划日期格式不正确'}, status=400)
    item = TomorrowItem.objects.create(
        user=request.user,
        title=title,
        note=note,
        planned_date=planned_date,
    )
    return JsonResponse({'item': serialize_tomorrow_item(item)}, status=201)


@login_required
@require_http_methods(['PATCH', 'DELETE'])
def tomorrow_item_detail(request, item_id):
    item = get_object_or_404(TomorrowItem, id=item_id, user=request.user)
    if request.method == 'DELETE':
        item.delete()
        return JsonResponse({'deleted': True})

    payload, error_response = parse_payload(request)
    if error_response:
        return error_response
    update_fields = []
    if 'title' in payload:
        title = str(payload.get('title', '')).strip()
        if not title:
            return JsonResponse({'error': '请输入事项内容'}, status=400)
        if len(title) > 160:
            return JsonResponse({'error': '事项内容不能超过160个字'}, status=400)
        item.title = title
        update_fields.append('title')
    if 'note' in payload:
        item.note = str(payload.get('note', '')).strip()
        update_fields.append('note')
    if 'isCompleted' in payload:
        item.is_completed = bool(payload.get('isCompleted'))
        item.completed_at = timezone.now() if item.is_completed else None
        update_fields.extend(('is_completed', 'completed_at'))
    if update_fields:
        item.save(update_fields=(*dict.fromkeys(update_fields), 'updated_at'))
    return JsonResponse({'item': serialize_tomorrow_item(item)})
