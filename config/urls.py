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
    available_employees,
    customer_detail,
    customers_collection,
    follow_up_task_detail,
    follow_up_tasks,
    tomorrow_item_detail,
    tomorrow_items,
)

urlpatterns = [
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
    path('api/customers/<int:customer_id>/', customer_detail, name='customer-detail'),
    path('api/followups/', follow_up_tasks, name='follow-up-tasks'),
    path('api/followups/<int:task_id>/', follow_up_task_detail, name='follow-up-task-detail'),
    path('api/tomorrow-items/', tomorrow_items, name='tomorrow-items'),
    path('api/tomorrow-items/<int:item_id>/', tomorrow_item_detail, name='tomorrow-item-detail'),
    path(
        '',
        login_required(TemplateView.as_view(template_name='index.html')),
        name='home',
    ),
]
