from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("order_id", "user", "purpose", "reference", "amount", "status", "utr", "refund_status",
                    "paid_at", "created_at")
    list_filter = ("status", "provider", "purpose", "refund_status")
    search_fields = ("order_id", "reference", "utr", "provider_payment_id", "user__email", "user__phone")
    readonly_fields = ("user", "purpose", "reference_id", "reference", "amount", "method", "provider", "order_id",
                       "provider_payment_id", "checkout_url", "status", "utr", "gateway_payload", "paid_at",
                       "created_at", "updated_at")
    fields = readonly_fields + ("failure_reason", "refund_status", "refund_amount")

    def has_add_permission(self, request):
        return False  # payments only come from the checkout flow
