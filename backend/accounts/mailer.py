"""Sends the sign-in code by email.

With NOTIFYKIT_URL + NOTIFYKIT_API_KEY set, the email goes through NotifyKit (type LOGIN_CODE). If
NotifyKit is unreachable or refuses it, it falls back to Django's mailer so players can still sign in.

Django's mailer uses the EMAIL_* settings in .env (Gmail, SES, SendGrid, Mailgun …).
Without EMAIL_HOST the console backend prints the email to the server log.
"""
import hashlib
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

log = logging.getLogger(__name__)


def send_login_code(email, code):
    ctx = {"code": code, "minutes": 10, "app": "Turflet"}
    text = render_to_string("emails/login_code.txt", ctx)
    html = render_to_string("emails/login_code.html", ctx)
    subject = f"{code} is your Turflet sign-in code"

    from notifications import notifykit

    if notifykit.is_configured():
        # Sign-in happens before we know the player's id, so NotifyKit's user id is derived from the email.
        uid = "email-" + hashlib.sha256(email.strip().lower().encode()).hexdigest()[:32]
        try:
            notifykit.send_email(uid, email, subject, html, text)
            return
        except Exception as e:  # noqa: BLE001 — any failure: fall back to SMTP
            log.warning("NotifyKit login email failed, falling back to SMTP: %s", e)

    msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [email])
    msg.attach_alternative(html, "text/html")
    msg.send(fail_silently=False)
