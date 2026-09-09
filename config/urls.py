"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView, LogoutView
from django.urls import path
from django.views.generic import TemplateView
from customers.views import (
    authorization_detail,
    available_employees,
    contract_detail,
    customer_authorizations,
    customer_contracts,
    customer_detail,
    customer_partnerships,
    customer_project_association_detail,
    customer_project_associations,
    customer_projects,
    customers_import,
    customers_collection,
    follow_up_task_detail,
    follow_up_tasks,
    health_check,
    mark_progress_update_read,
    mark_progress_updates_read,
    material_experiment,
    overview_statistics,
    partnership_detail,
    project_detail,
    progress_update_detail,
    progress_updates,
    scheme_calculation,
    export_scheme_calculation,
    project_type_detail,
    project_types,
    regional_business_map,
    tomorrow_item_detail,
    tomorrow_items,
    visitor_record_detail,
    visitor_records,
    visitor_records_export,
    visitor_records_import,
)
from customers.personal import my_projects, calendar_events, calendar_event_detail, duplicate_customers

urlpatterns = [
    path('api/my-projects/', my_projects, name='my-projects'),
    path('api/calendar/', calendar_events, name='calendar-events'),
    path('api/calendar/<int:item_id>/', calendar_event_detail, name='calendar-event-detail'),
    path('api/customers/check-duplicates/', duplicate_customers, name='duplicate-customers'),
    path('health/', health_check, name='health-check'),
    path('admin/', admin.site.urls),
    path(
        'login/',
        LoginView.as_view(
            template_name='login.html',
            redirect_authenticated_user=True,
        ),
        name='login',
    ),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('api/employees/', available_employees, name='available-employees'),
    path('api/customers/', customers_collection, name='customers-collection'),
    path('api/customers/import/', customers_import, name='customers-import'),
    path('api/customers/<int:customer_id>/', customer_detail, name='customer-detail'),
    path('api/customers/<int:customer_id>/projects/', customer_projects, name='customer-projects'),
    path('api/customers/<int:customer_id>/project-associations/', customer_project_associations, name='customer-project-associations'),
    path('api/project-associations/<int:association_id>/', customer_project_association_detail, name='customer-project-association-detail'),
    path('api/projects/<int:project_id>/', project_detail, name='project-detail'),
    path('api/customers/<int:customer_id>/partnerships/', customer_partnerships, name='customer-partnerships'),
    path('api/partnerships/<int:identity_id>/', partnership_detail, name='partnership-detail'),
    path('api/customers/<int:customer_id>/authorizations/', customer_authorizations, name='customer-authorizations'),
    path('api/authorizations/<int:authorization_id>/', authorization_detail, name='authorization-detail'),
    path('api/customers/<int:customer_id>/contracts/', customer_contracts, name='customer-contracts'),
    path('api/contracts/<int:contract_id>/', contract_detail, name='contract-detail'),
    path('api/statistics/regional-business-map/', regional_business_map, name='regional-business-map'),
    path('api/statistics/overview/', overview_statistics, name='overview-statistics'),
    path('api/customers/<int:customer_id>/scheme-calculation/', scheme_calculation, name='scheme-calculation'),
    path('api/customers/<int:customer_id>/scheme-calculation/export/', export_scheme_calculation, name='export-scheme-calculation'),
    path('api/customers/<int:customer_id>/material-experiment/', material_experiment, name='material-experiment'),
    path('api/followups/', follow_up_tasks, name='follow-up-tasks'),
    path('api/followups/<int:task_id>/', follow_up_task_detail, name='follow-up-task-detail'),
    path('api/project-types/', project_types, name='project-types'),
    path('api/project-types/<int:project_type_id>/', project_type_detail, name='project-type-detail'),
    path('api/progress-updates/', progress_updates, name='progress-updates'),
    path('api/progress-updates/<int:update_id>/', progress_update_detail, name='progress-update-detail'),
    path('api/progress-updates/<int:update_id>/read/', mark_progress_update_read, name='mark-progress-update-read'),
    path('api/progress-updates/read/', mark_progress_updates_read, name='mark-progress-updates-read'),
    path('api/visitors/', visitor_records, name='visitor-records'),
    path('api/visitors/import/', visitor_records_import, name='visitor-records-import'),
    path('api/visitors/export/', visitor_records_export, name='visitor-records-export'),
    path('api/visitors/<int:record_id>/', visitor_record_detail, name='visitor-record-detail'),
    path('api/tomorrow-items/', tomorrow_items, name='tomorrow-items'),
    path('api/tomorrow-items/<int:item_id>/', tomorrow_item_detail, name='tomorrow-item-detail'),
    path(
        '',
        login_required(TemplateView.as_view(template_name='index.html')),
        name='home',
    ),
]
