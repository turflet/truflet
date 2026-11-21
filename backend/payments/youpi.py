"""HTTP client for the self-hosted YOUPI UPI gateway.

Server-to-server only: the merchant key and webhook secret never reach the app. Settings:

    YOUPI_API_URL         e.g. https://pay-api.truflet.in   (the payment API, not the checkout host)
    YOUPI_MERCHANT_ID     merchant id from the YOUPI admin panel
    YOUPI_MERCHANT_KEY    server-side merchant API key   (secret)
    YOUPI_WEBHOOK_SECRET  webhook signing secret          (secret)
"""
import hashlib
import hmac

import requests
from django.conf import settings

TIMEOUT = 15

# YOUPI public statuses -> our Payment.status. Anything not listed is still in progress.
STATUS_MAP = {
    "SUCCESS": "success",
    "FAILED": "failed",
    "SUSPICIOUS": "failed",
    "EXPIRED": "expired",
    "CANCELLED": "cancelled",
}


class YoupiError(Exception):
    pass


def is_configured():
    return bool(settings.YOUPI_API_URL and settings.YOUPI_MERCHANT_ID and settings.YOUPI_MERCHANT_KEY)


def _url(path):
    return settings.YOUPI_API_URL.rstrip("/") + path


def _headers(**extra):
    return {
        "Content-Type": "application/json",
        "X-Merchant-Id": settings.YOUPI_MERCHANT_ID,
        "X-Merchant-Key": settings.YOUPI_MERCHANT_KEY,
        **extra,
    }


def _json(resp):
    try:
        return resp.json()
    except ValueError:
        return {}


def create_payment(order_id, amount, description="", customer=None, metadata=None):
    """Opens a checkout session. Returns YOUPI's JSON (paymentId, status, checkoutUrl, ...)."""
    body = {
        "orderId": order_id,
        "amount": f"{int(amount)}.00",
        "currency": "INR",
        "description": description,
        "metadata": metadata or {},
    }
    if customer:
        body["customer"] = {k: v for k, v in customer.items() if v}
    try:
        resp = requests.post(_url("/api/v1/payments"), json=body,
                             headers=_headers(**{"Idempotency-Key": order_id}), timeout=TIMEOUT)
    except requests.RequestException as e:
        raise YoupiError("The payment gateway is not reachable. Please try again.") from e
    data = _json(resp)
    if resp.status_code not in (200, 201) or not data.get("paymentId") or not data.get("checkoutUrl"):
        raise YoupiError(data.get("message") or data.get("error") or f"Payment gateway error ({resp.status_code}).")
    return data


def get_payment(payment_id):
    """Current state of a session, read with the merchant key (authoritative, server-to-server)."""
    try:
        resp = requests.get(_url(f"/api/v1/payments/{payment_id}"), headers=_headers(), timeout=TIMEOUT)
    except requests.RequestException as e:
        raise YoupiError("The payment gateway is not reachable.") from e
    if resp.status_code != 200:
        raise YoupiError(f"Payment gateway error ({resp.status_code}).")
    return _json(resp)


def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    """X-Gateway-Signature is `sha256=<hex HMAC-SHA256 of the raw request body>`."""
    secret = settings.YOUPI_WEBHOOK_SECRET
    if not secret or not signature_header:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.strip())
