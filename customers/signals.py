from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Project
from .services import sync_project_followup_tasks


@receiver(post_save, sender=Project)
def maintain_project_followup_tasks(sender, instance, **kwargs):
    sync_project_followup_tasks(instance)
