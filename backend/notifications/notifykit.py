"""NotifyKit-backed notification service: push and email go through the central NotifyKit microservice.

Enable with:
    NOTIFICATION_SERVICE=notifications.notifykit.NotifyKitNotificationService
    NOTIFYKIT_URL=https://notify.example.com
    NOTIFYKIT_API_KEY=nk_live_...          (the project's server key; never ship it to the app)

What stays here and what moves:
  * In-app notifications (the bell) are still saved in this database, so the app's list keeps working
    even when NotifyKit is unreachable.
  * Push: devices are mirrored to NotifyKit, and each notification is sent there as a PUSH (after the
    caller's transaction commits). NotifyKit owns the Firebase credentials, retries and dead-lettering.
  * Email (sign-in codes): see `send_email`; accounts/mailer.py falls back to SMTP if NotifyKit fails.

The NotifyKit project needs these notification types (see notify-kit/docs/deploy-home-laptop.md):
BOOKING, MATCH, SYSTEM (TRANSACTIONAL), OFFER (MARKETING), LOGIN_CODE (SECURITY, mandatory).

Every call here is best-effort with a short timeout: a NotifyKit outage must never break a booking.
"""
import logging
from urllib.parse import quote

import requests
from django.conf import settings
from django.db import transaction

from .service import LocalNotificationService

log = logging.getLogger(__name__)

_PLATFORMS = {"android": "ANDROID", "ios": "IOS", "web": "WEB"}


class NotifyKitError(Exception):
    def __init__(self, status, code, message=""):
        super().__init__(f"NotifyKit {status} {code}: {message}")
        self.status, self.code = status, code


class NotifyKitClient:
    def __init__(self, base_url=None, api_key=None, timeout=None):
        self.base = (base_url or settings.NOTIFYKIT_URL).rstrip("/") + "/api/v1"
        self.timeout = timeout or settings.NOTIFYKIT_TIMEOUT
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {api_key or settings.NOTIFYKIT_API_KEY}"

    def _call(self, method, path, json=None, idempotency_key=None):
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        r = self.session.request(method, self.base + path, json=json, headers=headers, timeout=self.timeout)
        try:
            body = r.json()
        except ValueError:
            raise NotifyKitError(r.status_code, "BAD_RESPONSE", r.text[:200])
        if not body.get("success"):
            err = body.get("error") or {}
            raise NotifyKitError(r.status_code, err.get("code", "UNKNOWN"), err.get("message", ""))
        return body["data"]

    def send(self, payload, idempotency_key=None):
        return self._call("POST", "/notifications", payload, idempotency_key)

    def register_device(self, user_id, token, platform):
        return self._call("POST", f"/users/{quote(str(user_id), safe='')}/devices",
                          {"fcm_token": token, "platform": platform})

    def remove_device(self, user_id, device_id):
        return self._call("DELETE", f"/users/{quote(str(user_id), safe='')}/devices/{quote(device_id, safe='')}")


_client = None


def client() -> NotifyKitClient:
    global _client
    if _client is None:
        _client = NotifyKitClient()
    return _client


def is_configured():
    return bool(getattr(settings, "NOTIFYKIT_URL", "") and getattr(settings, "NOTIFYKIT_API_KEY", ""))


def send_email(external_user_id, email, subject, html, text="", name="", type_="LOGIN_CODE", idempotency_key=None):
    """Queues one email through NotifyKit. Raises on failure so the caller can fall back."""
    recipient = {"external_user_id": str(external_user_id), "email": email}
    if name:
        recipient["name"] = name
    return client().send({
        "type": type_, "title": subject, "body": text or subject, "html_body": html,
        "priority": "HIGH", "channels": ["EMAIL"], "recipients": [recipient],
    }, idempotency_key)


def _push(notification_id, user_id, title, body, kind):
    try:
        client().send({
            "type": kind.upper(), "title": title, "body": body or title, "channels": ["PUSH"],
            "recipients": [{"external_user_id": str(user_id)}],
            "data": {"kind": kind, "notification_id": str(notification_id)},
        }, idempotency_key=f"turflet-notification-{notification_id}")
    except NotifyKitError as e:
        if e.code != "NO_ELIGIBLE_RECIPIENTS":  # = the player has no registered device; that's normal
            log.warning("NotifyKit push for notification %s failed: %s", notification_id, e)
    except requests.RequestException as e:
        log.warning("NotifyKit unreachable, push for notification %s dropped: %s", notification_id, e)


class NotifyKitNotificationService(LocalNotificationService):
    """In-app rows stay local; push delivery and device tokens live in NotifyKit."""

    def notify(self, user_id, title, body="", kind="system"):
        if not user_id:
            return None
        from django.contrib.auth import get_user_model

        from .models import Notification

        n = Notification.objects.create(user_id=user_id, title=title, body=body, kind=kind)
        if get_user_model().objects.filter(pk=user_id, notifications_on=True).exists():
            transaction.on_commit(lambda: _push(n.pk, user_id, title, body, kind))
        return n.pk

    def register_device(self, user_id, token, platform=""):
        from .models import DeviceToken

        previous = DeviceToken.objects.filter(token=token).first()
        device, _ = DeviceToken.objects.update_or_create(
            token=token, defaults={"user_id": user_id, "platform": platform[:20]})
        try:
            # NotifyKit upserts by token, so this also moves the device off any previous player.
            remote = client().register_device(user_id, token, _PLATFORMS.get(platform.lower(), "ANDROID"))
            if remote.get("device_id") != device.notifykit_device_id:
                DeviceToken.objects.filter(pk=device.pk).update(notifykit_device_id=remote.get("device_id", ""))
        except (NotifyKitError, requests.RequestException) as e:
            log.warning("NotifyKit device registration failed for user %s: %s", user_id, e)
            if previous and previous.user_id != user_id and previous.notifykit_device_id:
                self._remove_remote(previous.user_id, previous.notifykit_device_id)

    def unregister_device(self, token):
        from .models import DeviceToken

        device = DeviceToken.objects.filter(token=token).first()
        if not device:
            return
        if device.notifykit_device_id:
            self._remove_remote(device.user_id, device.notifykit_device_id)
        device.delete()

    @staticmethod
    def _remove_remote(user_id, device_id):
        try:
            client().remove_device(user_id, device_id)
        except (NotifyKitError, requests.RequestException) as e:
            log.warning("NotifyKit device removal failed (user %s, device %s): %s", user_id, device_id, e)
