import datetime

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .models import FAQ, AppConfig, PolicySection, RefundRule, SupportTicket


def exception_handler(exc, context):
    """Adds a single human readable `message` to every error response."""
    response = drf_exception_handler(exc, context)
    if response is not None and isinstance(response.data, (dict, list)):
        response.data = {"message": _first_message(response.data), "errors": response.data}
    return response


def _first_message(data):
    if isinstance(data, list):
        return _first_message(data[0]) if data else "Something went wrong."
    if isinstance(data, dict):
        if "detail" in data:
            return str(data["detail"])
        for v in data.values():
            return _first_message(v)
    return str(data)


def image_url(request, field):
    """Absolute URL for an ImageField (works for local files and Cloudinary)."""
    if not field:
        return None
    try:
        url = field.url
    except ValueError:
        return None
    if url.startswith("http"):
        return url
    return request.build_absolute_uri(url) if request else url


class ImageURLField(serializers.Field):
    def to_representation(self, value):
        return image_url(self.context.get("request"), value)


# ------------------------------------------------------------------ config & content

@api_view(["GET"])
def app_config(request):
    from venues.models import Venue
    c = AppConfig.get()
    return Response({
        "convenience_fee": c.convenience_fee,
        "gst_percent": float(c.gst_percent),
        "hold_minutes": c.hold_minutes,
        "free_cancel_hours": c.free_cancel_hours,
        "reschedule_cutoff_hours": c.reschedule_cutoff_hours,
        "referral_reward": c.referral_reward,
        "split_fee": c.split_fee,
        "live_venues": Venue.objects.filter(is_active=True).count(),
        "offer": {
            "enabled": c.offer_enabled, "tag": c.offer_tag, "title": c.offer_title,
            "subtitle": c.offer_subtitle, "image": image_url(request, c.offer_image),
        },
        "privacy_url": f"{settings.WEB_APP_URL}/privacy",
        "support": {
            "phone": c.support_phone, "email": c.support_email, "whatsapp": c.support_whatsapp,
            "chat_hours": c.chat_hours, "call_hours": c.call_hours, "email_sla": c.email_sla,
            "reply_time": c.reply_time_text,
        },
        "policy_updated_on": c.policy_updated_on.strftime("%-d %b %Y") if c.policy_updated_on else None,
        "app_version": c.app_version,
        # true: UPI opens the gateway checkout (pick any UPI app there), so the app doesn't ask for a UPI ID
        "upi_checkout": settings.UPI_CHECKOUT == "youpi",
    })


@api_view(["GET"])
def faqs(request):
    q = request.GET.get("q", "").strip()
    qs = FAQ.objects.filter(is_active=True)
    if q:
        from django.db.models import Q
        qs = qs.filter(Q(question__icontains=q) | Q(answer__icontains=q))
    return Response([{"id": f.id, "q": f.question, "a": f.answer} for f in qs])


@api_view(["GET"])
def policies(request):
    sections = PolicySection.objects.all()
    return Response({
        "refund_rules": [
            {"percent": r.percent, "min_hours": r.min_hours_before, "title": r.title, "subtitle": r.subtitle}
            for r in RefundRule.objects.all()
        ],
        "refund_notes": [
            {"heading": s.heading, "body": s.body, "icon": s.icon, "color": s.color}
            for s in sections if s.kind == "refund_note"
        ],
        "privacy": [{"heading": s.heading, "items": s.items} for s in sections if s.kind == "privacy"],
        "terms": [{"heading": s.heading, "items": s.items} for s in sections if s.kind == "terms"],
    })


# ------------------------------------------------------------------ legal pages (web app /privacy, /delete-account)

PRIVACY_UPDATED = datetime.date(2026, 11, 13)


def _support():
    c = AppConfig.get()
    phone = c.support_phone if c.support_phone and c.support_phone != "+918000000000" else ""  # skip the placeholder
    return c.support_email, phone


@api_view(["GET"])
def legal(request):
    """Contact details and last-updated date for the public privacy policy page."""
    email, phone = _support()
    return Response({"privacy_updated": PRIVACY_UPDATED.isoformat(), "email": email, "phone": phone})


def _bad(message):
    return Response({"message": message}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def deletion_code(request):
    """Account deletion, step 1 (the Play Store "Delete account URL"): email a one-time code to the
    address the person signs in with, proving they own the account."""
    from accounts.mailer import send_login_code
    from accounts.models import EmailOTP, User, normalize_email

    email = normalize_email(request.data.get("email"))
    try:
        validate_email(email)
    except DjangoValidationError:
        return _bad("Enter a valid email address.")
    if not User.objects.filter(email=email).exists():
        return _bad("We couldn't find a Turflet account with this email.")
    if EmailOTP.recently_sent(email):
        return _bad("A code was just sent. Please wait 30 seconds before asking again.")
    code = EmailOTP.issue(email, dev_mode=settings.OTP_DEV_MODE)
    try:
        send_login_code(email, code)
    except Exception:
        if not settings.OTP_DEV_MODE:
            return _bad("We couldn't send the email right now. Please try again.")
    return Response({"email": email})


@api_view(["POST"])
def deletion_confirm(request):
    """Account deletion, step 2: check the code and record a deletion request for the team to process."""
    from accounts.models import AccountDeletionRequest, EmailOTP, User, normalize_email

    email = normalize_email(request.data.get("email"))
    code = str(request.data.get("code", "")).strip()
    reason = str(request.data.get("reason", ""))[:1000]
    otp = EmailOTP.objects.filter(email=email, used=False).first() if email else None
    if not otp or otp.is_expired():
        return _bad("Code expired. Start again to get a new one.")
    if otp.attempts >= EmailOTP.MAX_ATTEMPTS:
        return _bad("Too many attempts. Start again to get a new code.")
    if EmailOTP.hash(code) != otp.code_hash:
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        return _bad("That code is incorrect.")
    otp.used = True
    otp.save(update_fields=["used"])
    if not AccountDeletionRequest.objects.filter(email=email, status="pending").exists():
        AccountDeletionRequest.objects.create(email=email, user=User.objects.filter(email=email).first(), reason=reason)
    return Response({"email": email, "support_email": _support()[0]})


# ------------------------------------------------------------------ support

class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = ["id", "booking", "subject", "message", "reply", "status", "created_at"]
        read_only_fields = ["reply", "status", "created_at"]


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def tickets(request):
    if request.method == "POST":
        s = TicketSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        booking = s.validated_data.get("booking")
        if booking and booking.user_id != request.user.id:
            return Response({"message": "Not your booking."}, status=status.HTTP_400_BAD_REQUEST)
        s.save(user=request.user)
        return Response(s.data, status=status.HTTP_201_CREATED)
    return Response(TicketSerializer(request.user.tickets.all(), many=True).data)
