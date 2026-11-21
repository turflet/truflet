"""UPI checkout through YOUPI: open a session, learn the outcome, tell whoever the money is for.

Flow
  1. `start_upi_checkout` creates a Payment row (pending) and a YOUPI session; the app opens `checkout_url`.
  2. The outcome arrives by signed webhook (`handle_webhook`) or by the app polling, which calls
     `sync_payment` (a server-to-server status read with the merchant key). Both end in `_apply_outcome`.
  3. On success `payment_succeeded` is sent once; the owning app (bookings) confirms the order. If no
     receiver could fulfil it (e.g. the slot was lost meanwhile) the payment is flagged for a refund.

Only the gateway's own reports move a payment to `success`; nothing the app sends can.
"""
import json
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.dispatch import Signal
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import youpi
from .models import Payment

log = logging.getLogger(__name__)

# Sent when a payment succeeds (and again if its bank UTR arrives later).
# kwargs: payment = {"id", "purpose", "reference_id", "amount", "method", "transaction_id", "gateway_id", "utr"};
# transaction_id is the UTR when known, else the gateway id.
# A receiver returns True when the order is (or already was) fulfilled by this payment, else False.
payment_succeeded = Signal()


def upi_checkout_enabled():
    return getattr(settings, "UPI_CHECKOUT", "") == "youpi"


def _customer(user):
    phone = "".join(ch for ch in str(getattr(user, "phone", "") or "") if ch.isdigit())[-10:]
    return {"name": getattr(user, "name", ""), "email": getattr(user, "email", ""), "phoneNumber": phone}


def start_upi_checkout(user, purpose, reference_id, reference, amount, description=""):
    """The pending Payment for this order, opening a new YOUPI session only when needed.

    Callers must lock the order row first, so two taps on Pay can't race for the same attempt number.
    """
    if not youpi.is_configured():
        raise ValidationError({"payment": "UPI payments are not set up yet. Please try another method."})
    previous = Payment.objects.filter(purpose=purpose, reference_id=reference_id)
    latest = previous.first()
    if latest and latest.status in ("pending", "success") and latest.amount == amount:
        latest = sync_payment(latest)
        if latest.status in ("pending", "success"):
            return latest  # reuse the open session instead of starting a second one

    order_id = f"{reference}-P{previous.count() + 1}"
    try:
        data = youpi.create_payment(
            order_id, amount, description=description, customer=_customer(user),
            metadata={"purpose": purpose, "reference": reference, "reference_id": reference_id},
        )
    except youpi.YoupiError as e:
        raise ValidationError({"payment": str(e)})
    return Payment.objects.create(
        user=user, purpose=purpose, reference_id=reference_id, reference=reference, amount=amount,
        method="upi", provider="youpi", order_id=order_id, provider_payment_id=data["paymentId"],
        checkout_url=data["checkoutUrl"], gateway_payload=data,
    )


def _matches(payment, data):
    """A gateway report counts only if it is for this exact order, amount and a real UPI payment."""
    try:
        paise = int(data.get("amountPaise"))
    except (TypeError, ValueError):
        return False
    return (data.get("orderId") == payment.order_id
            and data.get("paymentId") == payment.provider_payment_id
            and str(data.get("method", "")).upper() == "UPI"
            and paise == payment.amount * 100)


def sync_payment(payment):
    """Asks YOUPI for the latest state of a pending payment and applies it. Never raises."""
    if payment.status != "pending" or payment.provider != "youpi" or not payment.provider_payment_id:
        return payment
    try:
        data = youpi.get_payment(payment.provider_payment_id)
    except youpi.YoupiError:
        return payment
    status = youpi.STATUS_MAP.get(str(data.get("status", "")).upper())
    if status is None:
        return payment
    if status == "success" and not _matches(payment, data):
        log.warning("YOUPI status for %s does not match the order; ignoring", payment.order_id)
        return payment
    return _apply_outcome(payment.pk, status, payload=data)


def handle_webhook(raw_body: bytes, signature: str):
    """Verifies and applies a YOUPI webhook. Returns (http_status, detail)."""
    if not youpi.verify_signature(raw_body, signature):
        return 401, "Invalid signature"
    try:
        data = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return 400, "Invalid JSON"
    payment = Payment.objects.filter(provider="youpi", order_id=data.get("orderId")).first()
    if payment is None or data.get("paymentId") != payment.provider_payment_id:
        return 200, "Unknown payment"  # acknowledge so the gateway stops retrying
    status = youpi.STATUS_MAP.get(str(data.get("event", "")).upper())
    if status is None:
        return 200, "Ignored event"
    if status == "success" and not _matches(payment, data):
        log.warning("YOUPI webhook for %s does not match the order (method/amount); ignoring", payment.order_id)
        return 200, "Mismatched payment ignored"
    _apply_outcome(payment.pk, status, utr=str(data.get("utr") or ""), payload=data)
    return 200, "ok"


def _announce(p):
    return payment_succeeded.send(sender=Payment, payment={
        "id": p.id, "purpose": p.purpose, "reference_id": p.reference_id, "amount": p.amount,
        "method": p.method, "transaction_id": p.transaction_id, "gateway_id": p.provider_payment_id, "utr": p.utr,
    })


@transaction.atomic
def _apply_outcome(pk, status, utr="", payload=None):
    p = Payment.objects.select_for_update().get(pk=pk)
    if p.status == "success":
        # final. A later report may still carry the bank UTR: record it and let the order update its copy.
        if utr and not p.utr:
            p.utr = utr
            p.save(update_fields=["utr", "updated_at"])
            _announce(p)
        return p
    if payload:
        p.gateway_payload = payload
    if status != "success":
        p.status = status
        p.save(update_fields=["status", "gateway_payload", "updated_at"])
        return p
    p.status, p.paid_at, p.failure_reason = "success", timezone.now(), ""
    p.utr = utr or p.utr
    p.save()
    if not any(ok is True for _, ok in _announce(p)):
        p.refund_status, p.refund_amount = "pending", p.amount
        p.failure_reason = "Money received but the order could not be completed: refund due."
        p.save(update_fields=["refund_status", "refund_amount", "failure_reason", "updated_at"])
        log.error("Payment %s succeeded but its %s #%s was not fulfilled; refund due",
                  p.order_id, p.purpose, p.reference_id)
    return p


def mark_refund_due(transaction_id, amount):
    """If `transaction_id` belongs to a successful YOUPI payment, queue a manual refund. Returns whether it did.

    UPI has no automatic refund here: the venue sends the money back from its own UPI app and marks it done.
    """
    if not transaction_id:
        return False
    with transaction.atomic():
        p = (Payment.objects.select_for_update()
             .filter(status="success", provider="youpi")
             .filter(Q(utr=transaction_id) | Q(provider_payment_id=transaction_id)).first())
        if p is None:
            return False
        p.refund_amount = min(p.amount, p.refund_amount + amount)
        p.refund_status = "pending"
        p.save(update_fields=["refund_amount", "refund_status", "updated_at"])
    return True
