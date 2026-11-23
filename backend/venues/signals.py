"""Rebuild the web app when public venue data changes, so its prerendered venue / city pages and
sitemap stay current. Set WEB_DEPLOY_HOOK_URL to a Vercel Deploy Hook for the web project."""
import logging
import urllib.request

from django.conf import settings
from django.db import transaction
from django.db.models.signals import m2m_changed, post_delete, post_save

from .models import Venue, VenuePhoto, VenueSport

log = logging.getLogger(__name__)
_pending = False


def _fire():
    global _pending
    _pending = False
    try:
        urllib.request.urlopen(urllib.request.Request(settings.WEB_DEPLOY_HOOK_URL, method="POST"), timeout=5)
    except Exception as e:  # never break an admin save over a rebuild
        log.warning("web deploy hook failed: %s", e)


def request_web_rebuild(**_):
    """At most one hook call per transaction, sent after it commits."""
    global _pending
    if not getattr(settings, "WEB_DEPLOY_HOOK_URL", "") or _pending:
        return
    _pending = True
    transaction.on_commit(_fire)


for model in (Venue, VenueSport, VenuePhoto):
    post_save.connect(request_web_rebuild, sender=model, dispatch_uid=f"web_rebuild_save_{model.__name__}")
    post_delete.connect(request_web_rebuild, sender=model, dispatch_uid=f"web_rebuild_delete_{model.__name__}")
m2m_changed.connect(request_web_rebuild, sender=Venue.amenities.through, dispatch_uid="web_rebuild_amenities")
