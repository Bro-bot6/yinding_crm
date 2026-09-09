"""Personal project portfolio and private calendar; no automatic stage changes."""
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import OuterRef, Q, Subquery
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_time
from django.views.decorators.http import require_GET, require_http_methods

from .models import EmployeeProfile, Project, ProjectProgressUpdate, TomorrowItem
from .views import accessible_customers, employee_display_name, parse_payload, serialize_project


def owned_projects(user):
    profile = getattr(user, 'employee_profile', None)
    role = profile.role if profile else ''
    scope = Q(pk__in=[])
    if user.is_superuser or role in ('business', 'both'):
        scope |= Q(business_owner=user) | Q(business_owner__isnull=True, owners_inherit_customer=True, customer__business_owner=user)
    if user.is_superuser or role in ('technical', 'both'):
        scope |= Q(technical_owner=user) | Q(technical_owner__isnull=True, owners_inherit_customer=True, customer__technical_owner=user)
    return Project.objects.filter(scope).distinct()


@login_required
@require_GET
def my_projects(request):
    employee = request.user
    if request.GET.get('employee'):
        if not request.user.is_superuser:
            return JsonResponse({'error': '只能查看自己的项目'}, status=403)
        raw_id = request.GET['employee']
        if not raw_id.isdigit():
            return JsonResponse({'error': '员工编号不正确'}, status=400)
        employee = get_object_or_404(get_user_model(), id=int(raw_id), is_active=True)
    latest = ProjectProgressUpdate.objects.filter(project_id=OuterRef('pk')).order_by('-occurred_at', '-id')
    projects = owned_projects(employee).select_related(
        'customer', 'project_type', 'business_owner__employee_profile', 'technical_owner__employee_profile',
    ).annotate(
        latest_followup_at=Subquery(latest.values('occurred_at')[:1]),
        latest_followup_content=Subquery(latest.values('content')[:1]),
    ).order_by('id')
    items = []
    for project in projects:
        item = serialize_project(project)
        item['customer']['description'] = project.customer.description
        item['latestFollowupAt'] = project.latest_followup_at.isoformat() if project.latest_followup_at else ''
        item['latestFollowupContent'] = project.latest_followup_content or ''
        items.append(item)
    employees = []
    if request.user.is_superuser:
        employees = [
            {'value': user.id, 'label': employee_display_name(user)}
            for user in get_user_model().objects.filter(is_active=True, is_superuser=False, employee_profile__isnull=False).select_related('employee_profile')
        ]
    return JsonResponse({
        'projects': items, 'canViewEmployees': request.user.is_superuser,
        'employees': employees,
        'ownActiveCount': owned_projects(request.user).filter(is_active=True).count(),
        'ownActiveCustomerCount': owned_projects(request.user).filter(is_active=True).values('customer_id').distinct().count(),
    })


def serialize_event(item):
    return {
        'id': item.id, 'title': item.title, 'note': item.note,
        'plannedDate': item.planned_date.isoformat(),
        'plannedTime': item.planned_time.strftime('%H:%M') if item.planned_time else '',
        'kind': item.kind, 'isCompleted': item.is_completed, 'isCancelled': item.is_cancelled,
        'reminderMinutes': item.reminder_minutes,
        'projectId': item.project_id or '', 'customerId': item.customer_id or '',
        'completedAt': item.completed_at.isoformat() if item.completed_at else '',
        'createdAt': item.created_at.isoformat(),
    }


def apply_event_payload(item, payload, user):
    title = str(payload.get('title', item.title)).strip()
    if not title or len(title) > 160:
        raise ValueError('请输入事项标题，最多160字')
    planned_date = parse_date(str(payload.get('plannedDate', item.planned_date or '')))
    if not planned_date:
        raise ValueError('请选择有效日期')
    raw_time = str(payload.get('plannedTime', item.planned_time or ''))
    planned_time = parse_time(raw_time) if raw_time else None
    if raw_time and (planned_time is None or planned_time.tzinfo is not None):
        raise ValueError('请选择有效时间')
    kind = payload.get('kind', item.kind)
    if kind not in ('personal', 'appointment', 'project'):
        raise ValueError('事项类型不正确')
    reminder = payload.get('reminderMinutes', item.reminder_minutes)
    if reminder not in (None, 0, 15, 30, 60, 1440) or isinstance(reminder, bool):
        raise ValueError('提醒时间不正确')
    customer_id = payload.get('customerId', item.customer_id) or None
    project_id = payload.get('projectId', item.project_id) or None
    for value in (customer_id, project_id):
        if value is not None and not str(value).isdigit():
            raise ValueError('关联编号不正确')
    # A project link is a reference, never a grant of access to this event.
    project = None
    if project_id:
        project = Project.objects.filter(id=project_id, customer__in=accessible_customers(user)).first()
        if not project:
            raise ValueError('关联项目不存在或不可访问')
        if customer_id and int(customer_id) != project.customer_id:
            raise ValueError('所选项目不属于该客户')
        customer_id = project.customer_id
    if customer_id and not accessible_customers(user).filter(id=customer_id).exists():
        raise ValueError('关联客户不存在或不可访问')
    for key in ('isCompleted', 'isCancelled'):
        if key in payload and not isinstance(payload[key], bool):
            raise ValueError('事项状态不正确')
    completed = payload.get('isCompleted', item.is_completed)
    cancelled = payload.get('isCancelled', item.is_cancelled)
    if completed and cancelled:
        raise ValueError('已取消的事项不能同时标记完成')
    if completed != item.is_completed:
        item.completed_at = timezone.now() if completed else None
    item.title, item.note = title, str(payload.get('note', item.note)).strip()
    if len(item.note) > 5000:
        raise ValueError('备注最多5000字')
    item.planned_date, item.planned_time, item.kind = planned_date, planned_time, kind
    item.reminder_minutes = reminder
    item.customer_id, item.project = customer_id, project
    item.is_completed, item.is_cancelled = completed, cancelled


@login_required
@require_http_methods(['GET', 'POST'])
def calendar_events(request):
    if request.method == 'POST':
        payload, error = parse_payload(request)
        if error:
            return error
        item = TomorrowItem(user=request.user)
        try:
            apply_event_payload(item, payload, request.user)
        except (ValueError, TypeError) as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        item.save()
        return JsonResponse({'item': serialize_event(item)}, status=201)
    today = timezone.localdate()
    try:
        start = parse_date(request.GET.get('start', today.replace(day=1).isoformat()))
        end = parse_date(request.GET.get('end', (today + timedelta(days=42)).isoformat()))
    except ValueError:
        start = end = None
    if not start or not end or end < start or (end - start).days > 366:
        return JsonResponse({'error': '请选择不超过一年的有效日期范围'}, status=400)
    own = TomorrowItem.objects.filter(user=request.user)
    pending = own.filter(is_completed=False, is_cancelled=False)
    now = timezone.now()
    reminders = []
    # Scan the advance-reminder horizon, independent of the displayed month.
    for item in pending.filter(planned_date__range=(today, today + timedelta(days=1)), reminder_minutes__isnull=False):
        at = timezone.make_aware(datetime.combine(item.planned_date, item.planned_time or time(9)))
        due = at - timedelta(minutes=item.reminder_minutes)
        if due <= now <= at + timedelta(hours=1):
            reminders.append(serialize_event(item))
    return JsonResponse({
        'items': [serialize_event(item) for item in own.filter(planned_date__range=(start, end)).order_by('planned_date', 'planned_time', 'id')],
        'todayCount': pending.filter(planned_date=today).count(), 'reminders': reminders,
        'userId': request.user.id,
    })


@login_required
@require_http_methods(['PATCH', 'DELETE'])
def calendar_event_detail(request, item_id):
    item = get_object_or_404(TomorrowItem, id=item_id, user=request.user)
    if request.method == 'DELETE':
        item.delete()
        return JsonResponse({'deleted': True})
    payload, error = parse_payload(request)
    if error:
        return error
    try:
        apply_event_payload(item, payload, request.user)
    except (ValueError, TypeError) as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    item.save()
    return JsonResponse({'item': serialize_event(item)})


@login_required
@require_http_methods(['POST'])
def duplicate_customers(request):
    payload, error = parse_payload(request)
    if error:
        return error
    rows = payload.get('customers', [])
    if not isinstance(rows, list) or not 1 <= len(rows) <= 200:
        return JsonResponse({'error': '请提交1至200条待检查客资'}, status=400)
    matches = []
    seen = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            return JsonResponse({'error': '客资格式不正确'}, status=400)
        name, phone = str(row.get('name', '')).strip(), str(row.get('phone', '')).strip()
        scope = Q(pk__in=[])
        if name:
            scope |= Q(name__iexact=name)
        if phone:
            scope |= Q(phone__iexact=phone)
        query = accessible_customers(request.user).filter(scope)
        if str(row.get('id', '')).isdigit():
            query = query.exclude(pk=int(row['id']))
        existing = list(query.order_by('id').values('id', 'name', 'phone')[:10])
        batch_rows = [i + 1 for i, n, p in seen if (name and name.casefold() == n.casefold()) or (phone and phone.casefold() == p.casefold())]
        if existing or batch_rows:
            matches.append({'row': index + 1, 'name': name, 'existing': existing, 'batchRows': batch_rows})
        seen.append((index, name, phone))
    return JsonResponse({'matches': matches})
