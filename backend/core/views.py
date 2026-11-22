"""The public pages (privacy policy, account deletion, admin dashboard) live in the React web app (web/).
These keep the old backend URLs working — the Play Store listing and older app builds link to them."""
from django.conf import settings
from django.shortcuts import redirect


def to_web(path):
    def view(request, rest=""):
        return redirect(f"{settings.WEB_APP_URL}{path}{rest}")
    return view
