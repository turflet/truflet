"""The payments table: one row per attempt to collect money through an external checkout (YOUPI UPI).

A row is created when the player taps Pay and stays `pending` until the gateway reports the outcome
(signed webhook, or a server-to-server status check). What the money is for is kept as plain values
(`purpose` + `reference_id`), so this app never imports the apps it is paid for.
"""
from django.conf import settings
from django.db import models

from core.models import TimeStamped


class Payment(TimeStamped):
    STATUS = [
        ("pending", "Pending"),
        ("success", "Success"),
        ("failed", "Failed"),
        ("expired", "Expired"),
        ("cancelled", "Cancelled"),
    ]
    REFUND_STATUS = [("", "None"), ("pending", "Refund pending (manual)"), ("done", "Refunded")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments")
    purpose = models.CharField(max_length=20, default="booking", help_text="What the money is for")
    reference_id = models.PositiveIntegerField(db_index=True, help_text="Id of the booking (or other order)")
    reference = models.CharField(max_length=30, help_text="Human code of the order, e.g. TRF-21N26-4821")
    amount = models.PositiveIntegerField(help_text="₹, whole rupees")
    method = models.CharField(max_length=10, default="upi")
    provider = models.CharField(max_length=20, default="youpi")

    order_id = models.CharField(max_length=64, unique=True, help_text="Order id sent to the gateway")
    provider_payment_id = models.CharField(max_length=64, blank=True, db_index=True)
    checkout_url = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default="pending", db_index=True)
    utr = models.CharField(max_length=40, blank=True, help_text="Bank reference number")
    failure_reason = models.CharField(max_length=200, blank=True)
    gateway_payload = models.JSONField(default=dict, blank=True, help_text="Last payload from the gateway")
    paid_at = models.DateTimeField(null=True, blank=True)

    refund_status = models.CharField(max_length=10, choices=REFUND_STATUS, default="", blank=True)
    refund_amount = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["purpose", "reference_id"])]

    def __str__(self):
        return f"{self.order_id} · ₹{self.amount} · {self.status}"

    @property
    def transaction_id(self):
        """What the order shows as its transaction id: the bank UTR once known, else the gateway id."""
        return self.utr or self.provider_payment_id

    def as_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "amount": self.amount,
            "method": self.method,
            "provider": self.provider,
            "order_id": self.order_id,
            "checkout_url": self.checkout_url,
            "utr": self.utr,
            "failure_reason": self.failure_reason,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
        }
