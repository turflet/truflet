"""JSON API for the React admin dashboard (web/src/admin). Admins and turf owners:

- Admins (is_staff) see every resource; turf owners (is_venue_owner) see only their own venues' rows and
  the fields they may edit — all driven by the declarative RESOURCES in crud.py.
- Auth is the app's JWT (sign in with the email code).

Generic CRUD
    GET    admin/meta/                         role + navigation + every resource's schema
    GET    admin/r/<slug>/?q=&page=&<filter>=  rows (cells already formatted for the table)
    POST   admin/r/<slug>/                     create   (JSON or multipart for images)
    GET    admin/r/<slug>/<pk>/                form values
    PATCH  admin/r/<slug>/<pk>/                update   (only the fields sent change)
    DELETE admin/r/<slug>/<pk>/
    POST   admin/r/<slug>/<pk>/toggle/<field>/
Bespoke pages: home, search, venue detail + photos + availability board, booking detail + actions,
check-in, player detail + wallet, settings, broadcast.
"""
from datetime import date as date_cls, datetime, timedelta

from django import forms
from django.core.paginator import Paginator
from django.db import models
from django.db.models import Count, Q, Sum
from django.db.models.fields.files import FieldFile
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.models import User
from bookings import services as booking_services
from bookings.models import Booking
from core.api import image_url
from core.models import AppConfig, SupportTicket
from notifications import service as notifications
from payments import service as payments
from venues.models import Venue, VenuePhoto

from .crud import REGISTRY, RESOURCES

PARSERS = [JSONParser, MultiPartParser, FormParser]


def resolve(obj, path):
    """Follow a `a__b__c` attribute path, calling methods on the way (column values in crud.py)."""
    val = obj
    for part in path.split("__"):
        if val is None:
            return None
        val = getattr(val, part, None)
        if callable(val) and not isinstance(val, FieldFile):
            val = val()
    return val


class Panel(permissions.BasePermission):
    message = "Only Turflet admins and turf owners can use the dashboard."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.can_use_panel)


class Staff(permissions.BasePermission):
    message = "Only Turflet admins can do that."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.is_staff)


def my_venues(user):
    return Venue.objects.all() if user.is_staff else Venue.objects.filter(owner=user)


def my_bookings(user):
    return Booking.objects.all() if user.is_staff else Booking.objects.filter(venue__owner=user)


# ------------------------------------------------------------------ serialisation helpers

def _plain(request, val):
    """A model value as JSON: images → absolute URL, dates → ISO, models → {id, label}."""
    if isinstance(val, FieldFile):
        return image_url(request, val)
    if isinstance(val, (datetime,)):
        return timezone.localtime(val).isoformat() if timezone.is_aware(val) else val.isoformat()
    if isinstance(val, date_cls):
        return val.isoformat()
    if isinstance(val, models.Model):
        return {"id": val.pk, "label": str(val)}
    if isinstance(val, (int, float, bool, str)) or val is None:
        return val
    return str(val)


def _cell(request, obj, column):
    path, kind = column["path"], column["kind"]
    val = resolve(obj, path)
    if kind == "image":
        return image_url(request, val) if val else None
    if kind == "date":
        if not val:
            return None
        try:
            return timezone.localtime(val).strftime("%d %b %Y")
        except (ValueError, AttributeError):
            return val.strftime("%d %b %Y")
    if kind == "badge":
        display = getattr(obj, f"get_{path}_display", None)
        return {"value": None if val is None else str(val), "label": display() if display else (str(val) if val is not None else "")}
    if kind in ("bool", "money"):
        return val
    if isinstance(val, models.Model):
        return str(val)
    return None if val in (None, "") else (val if isinstance(val, (int, float)) else str(val))


def _field_schema(r, form, name):
    f = form.fields[name]
    mf = r.model._meta.get_field(name)
    w = f.widget
    kind = "text"
    if isinstance(f, forms.BooleanField):
        kind = "bool"
    elif isinstance(f, forms.ModelMultipleChoiceField):
        kind = "multi"
    elif isinstance(f, (forms.ModelChoiceField, forms.TypedChoiceField, forms.ChoiceField)):
        kind = "select"
    elif isinstance(f, (forms.ImageField, forms.FileField)):
        kind = "image"
    elif isinstance(f, forms.DateTimeField):
        kind = "datetime"
    elif isinstance(f, forms.DateField):
        kind = "date"
    elif isinstance(f, (forms.IntegerField, forms.DecimalField, forms.FloatField)):
        kind = "number"
    elif isinstance(w, forms.Textarea):
        kind = "textarea"
    elif isinstance(f, forms.EmailField):
        kind = "email"
    elif name.endswith("_color"):
        kind = "color"
    elif isinstance(mf, models.JSONField):
        kind = "json"
    out = {
        "name": name,
        "label": str(f.label or name.replace("_", " ").title()),
        "kind": kind,
        "required": bool(f.required),
        "help": str(f.help_text or ""),
    }
    if kind in ("select", "multi"):
        choices = []
        for value, label in f.choices:
            value = getattr(value, "value", value)  # ModelChoiceIteratorValue
            if value in ("", None):
                continue
            choices.append({"value": value, "label": str(label)})
        out["choices"] = choices[:1000]
    return out


def _resource(slug, user):
    r = REGISTRY.get(slug)
    r = r and r.for_user(user)
    if not r:
        raise Http404
    return r


def _limit_form(r, form):
    form = r.limit_form(form)
    owner = form.fields.get("owner")
    if owner is not None:
        owner.queryset = User.objects.filter(Q(is_venue_owner=True) | Q(is_staff=True))
        owner.help_text = "Turf owner who manages this venue (turn on “Turf owner” on the player first)."
    return form


def _schema(r, user):
    form = _limit_form(r, r.form_class()())
    return {
        "slug": r.slug,
        "title": r.title,
        "verbose": str(r.verbose),
        "icon": r.icon,
        "section": r.section,
        "help": r.help,
        "columns": r.columns,
        "filters": [{**f, "choices": [{"value": str(v), "label": str(lbl)} for v, lbl in f["choices"]]} for f in r.filter_choices()],
        "search": bool(r.search),
        "can_create": r.can_create,
        "can_edit": r.can_edit,
        "can_delete": r.can_delete,
        "toggles": list(r.toggles),
        "fields": [_field_schema(r, form, n) for n in r.fields if n in form.fields],
        "detail": {"venues": "venue", "bookings": "booking", "users": "user"}.get(r.slug),
    }


def _errors(form):
    # the project's exception handler turns this into {"message": <first error>, "errors": {field: [...]}}
    raise ValidationError({k: [str(m) for m in v] for k, v in form.errors.items()})


def _form_data(request, r, obj):
    """Request data merged over the instance's current values, so a PATCH may send only what changed."""
    data = QueryDict(mutable=True)
    if obj is not None:
        initial = forms.models.model_to_dict(obj, fields=r.fields)
        for k, v in initial.items():
            if isinstance(v, (list, tuple)):
                data.setlist(k, [getattr(x, "pk", x) for x in v])
            elif isinstance(v, FieldFile) or v is None:
                continue
            elif isinstance(v, bool):
                if v:
                    data[k] = "on"
            elif isinstance(v, (dict, list)):
                import json
                data[k] = json.dumps(v)
            else:
                data[k] = v
    sent = request.data
    for k in sent.keys():
        if k not in r.fields:
            continue
        vals = sent.getlist(k) if hasattr(sent, "getlist") else (sent[k] if isinstance(sent[k], list) else [sent[k]])
        if isinstance(vals, list) and len(vals) == 1 and isinstance(vals[0], list):
            vals = vals[0]
        field = r.model._meta.get_field(k)
        if isinstance(field, models.BooleanField):
            on = vals and str(vals[-1]).lower() in ("1", "true", "on", "yes")
            if on:
                data[k] = "on"
            elif k in data:
                del data[k]
        elif isinstance(field, (models.FileField,)):
            continue
        elif isinstance(field, models.JSONField) and not isinstance(vals[-1], str):
            import json
            data[k] = json.dumps(vals[-1])
        else:
            data.setlist(k, ["" if v is None else str(v) for v in vals])
    return data


# ------------------------------------------------------------------ meta & generic CRUD

@api_view(["GET"])
@permission_classes([Panel])
def meta(request):
    u = request.user
    nav = []
    for r in RESOURCES:
        rr = r.for_user(u)
        if rr:
            nav.append({"slug": rr.slug, "title": rr.title, "icon": rr.icon, "section": rr.section})
    return Response({
        "user": {"id": u.pk, "name": u.name, "email": u.email, "is_staff": u.is_staff, "is_venue_owner": u.is_venue_owner},
        "role": "admin" if u.is_staff else "owner",
        "nav": nav,
    })


@api_view(["GET", "POST"])
@permission_classes([Panel])
@parser_classes(PARSERS)
def crud_list(request, slug):
    r = _resource(slug, request.user)
    if request.method == "POST":
        return _save(request, r, None)
    qs = r.scope(r.model.objects.all())
    if r.select_related:
        qs = qs.select_related(*r.select_related)
    q = request.GET.get("q", "").strip()
    if q and r.search:
        cond = Q()
        for f in r.search:
            cond |= Q(**{f"{f}__icontains": q})
        qs = qs.filter(cond)
    for f in r.filters:
        v = request.GET.get(f)
        if v not in (None, ""):
            if r.model._meta.get_field(f).get_internal_type() == "BooleanField":
                v = v == "1"
            qs = qs.filter(**{f: v})
    qs = qs.order_by(*r.ordering) if r.ordering else qs.order_by("-pk")
    qs = qs.distinct()
    page = Paginator(qs, min(100, max(5, int(request.GET.get("size", 25) or 25)))).get_page(request.GET.get("page"))
    rows = []
    for obj in page.object_list:
        rows.append({
            "id": obj.pk,
            "label": str(obj),
            "cells": [_cell(request, obj, c) for c in r.columns],
            "toggles": {t: bool(getattr(obj, t)) for t in r.toggles},
        })
    out = {"rows": rows, "total": page.paginator.count, "page": page.number, "pages": page.paginator.num_pages}
    if request.GET.get("schema"):
        out["schema"] = _schema(r, request.user)
    return Response(out)


@api_view(["GET"])
@permission_classes([Panel])
def crud_schema(request, slug):
    return Response(_schema(_resource(slug, request.user), request.user))


@api_view(["GET", "PATCH", "PUT", "DELETE"])
@permission_classes([Panel])
@parser_classes(PARSERS)
def crud_detail(request, slug, pk):
    r = _resource(slug, request.user)
    obj = get_object_or_404(r.scope(r.model.objects.all()), pk=pk)
    if request.method == "GET":
        values = {}
        for name in r.fields:
            f = r.model._meta.get_field(name)
            if isinstance(f, models.ManyToManyField):
                values[name] = list(getattr(obj, name).values_list("pk", flat=True))
            elif isinstance(f, models.ForeignKey):
                values[name] = getattr(obj, f.attname)
            else:
                values[name] = _plain(request, getattr(obj, name))
        return Response({"id": obj.pk, "label": str(obj), "values": values})
    if request.method == "DELETE":
        if not r.can_delete:
            raise ValidationError({"message": "Delete is disabled for this resource."})
        try:
            obj.delete()
        except Exception as e:  # ProtectedError etc.
            raise ValidationError({"message": f"Cannot delete: {e.__class__.__name__}. It is still in use."})
        return Response({"ok": True})
    return _save(request, r, obj)


def _save(request, r, obj):
    if (obj is None and not r.can_create) or (obj is not None and not r.can_edit):
        raise ValidationError({"message": "You can't change this."})
    owner_new_venue = r.model is Venue and obj is None and not request.user.is_staff
    files = request.FILES
    # a JSON body can clear an image with {"field": null}
    clear = {k for k in r.fields if k in request.data and request.data.get(k) in (None, "", "null")
             and isinstance(r.model._meta.get_field(k), models.FileField)}
    form = _limit_form(r, r.form_class()(_form_data(request, r, obj), files, instance=obj))
    if not form.is_valid():
        _errors(form)
    saved = form.save(commit=False)
    for k in clear:
        setattr(saved, k, None)
    if owner_new_venue:
        # owner-onboarded grounds stay hidden in the app until an admin approves them
        saved.owner, saved.is_active = request.user, False
    saved.save()
    form.save_m2m()
    msg = ("Ground added. Add courts, sports & pricing and photos — the Turflet team will approve it and it goes "
           "live in the app." if owner_new_venue else f"{str(r.verbose).title()} saved.")
    return Response({"id": saved.pk, "label": str(saved), "message": msg}, status=201 if obj is None else 200)


@api_view(["POST"])
@permission_classes([Panel])
def crud_toggle(request, slug, pk, field):
    r = _resource(slug, request.user)
    if field not in r.toggles:
        raise ValidationError({"message": "That can't be toggled here."})
    obj = get_object_or_404(r.scope(r.model.objects.all()), pk=pk)
    setattr(obj, field, not getattr(obj, field))
    obj.save(update_fields=[field])
    return Response({"ok": True, "value": getattr(obj, field)})


# ------------------------------------------------------------------ home & search

@api_view(["GET"])
@permission_classes([Panel])
def home(request):
    Booking.sync_statuses()
    user = request.user
    venues, bookings = my_venues(user), my_bookings(user)
    today = timezone.localdate()
    paid = bookings.filter(payment_status__in=["paid", "refunded"])
    month_start = today.replace(day=1)
    days = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        amt = paid.filter(paid_at__date=d).aggregate(s=Sum("total"))["s"] or 0
        n = bookings.filter(paid_at__date=d, payment_status__in=["paid", "refunded"]).count()
        days.append({"date": d.isoformat(), "label": d.strftime("%d %b"), "short": d.strftime("%a"), "amount": amt, "count": n})
    top = (venues.annotate(n=Count("bookings", filter=Q(bookings__payment_status="paid")),
                           rev=Sum("bookings__total", filter=Q(bookings__payment_status="paid")))
           .order_by("-rev")[:5])
    stats = {
        "today_bookings": bookings.filter(date=today, status__in=["confirmed", "completed"]).count(),
        "today_checked_in": bookings.filter(date=today, checked_in_at__isnull=False).count(),
        "month_revenue": paid.filter(paid_at__date__gte=month_start).aggregate(s=Sum("total"))["s"] or 0,
        "refunds": bookings.filter(refunded_at__date__gte=month_start).aggregate(s=Sum("refund_amount"))["s"] or 0,
        "venues": venues.filter(is_active=True).count(),
        "pending_venues": venues.filter(is_active=False, owner__isnull=False).count(),
        "upcoming_bookings": bookings.filter(date__gt=today, status="confirmed").count(),
    }
    if user.is_staff:
        from payments.models import Payment
        stats.update({
            "users": User.objects.filter(is_staff=False).count(),
            "new_users": User.objects.filter(date_joined__date__gte=today - timedelta(days=7)).count(),
            "refunds_due": Payment.objects.filter(refund_status="pending").count(),
            "open_tickets": SupportTicket.objects.filter(status="open").count(),
        })
    return Response({
        "stats": stats,
        "days": days,
        "top_venues": [{"id": v.pk, "name": v.name, "bookings": v.n or 0, "revenue": v.rev or 0,
                        "image": image_url(request, v.cover)} for v in top],
        "today": [_booking_row(request, b) for b in bookings.filter(date=today, status="confirmed")
                  .select_related("user", "venue", "court").order_by("start_hour")[:8]],
        "recent": [_booking_row(request, b) for b in bookings.exclude(status__in=["held", "expired"])
                   .select_related("user", "venue", "court").order_by("-created_at")[:8]],
    })


def _booking_row(request, b):
    return {
        "id": b.pk, "code": b.code, "date": b.date.isoformat(), "date_label": f"{b.date:%a, %-d %b}",
        "time": f"{booking_services.fmt_hour(b.start_hour)} – {booking_services.fmt_hour(b.start_hour + b.duration)}",
        "player": b.user.name or b.user.email, "venue": b.venue.name, "court": b.court.name,
        "total": b.total, "status": b.status, "status_label": b.get_status_display(),
        "payment_status": b.payment_status, "checked_in": b.checked_in_at is not None,
    }


@api_view(["GET"])
@permission_classes([Panel])
def search(request):
    q = request.GET.get("q", "").strip()
    out = []
    if len(q) >= 2:
        for b in my_bookings(request.user).filter(Q(code__icontains=q) | Q(user__email__icontains=q)).select_related("venue")[:5]:
            out.append({"label": f"{b.code} · {b.venue}", "kind": "Booking", "to": f"/admin/bookings/{b.pk}"})
        for v in my_venues(request.user).filter(name__icontains=q)[:5]:
            out.append({"label": v.name, "kind": "Venue", "to": f"/admin/venues/{v.pk}"})
        if request.user.is_staff:
            for u in User.objects.filter(Q(name__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q))[:5]:
                out.append({"label": f"{u.name or '—'} · {u.email}", "kind": "Player", "to": f"/admin/users/{u.pk}"})
    return Response({"results": out})


# ------------------------------------------------------------------ venues

@api_view(["GET"])
@permission_classes([Panel])
def venue_detail(request, pk):
    v = get_object_or_404(my_venues(request.user).select_related("area__city", "owner"), pk=pk)
    return Response({
        "id": v.pk, "name": v.name, "area": str(v.area), "address": v.address, "phone": v.phone,
        "is_active": v.is_active, "is_fast_filling": v.is_fast_filling, "rating": v.rating, "review_count": v.review_count,
        "hours": f"{booking_services.fmt_hour(v.opens_at)} – {booking_services.fmt_hour(v.closes_at)}",
        "cover": image_url(request, v.cover), "owner": v.owner.email if v.owner else None,
        "partner_status": getattr(v, "get_partner_status_display", lambda: "")(),
        "photos": [{"id": p.pk, "url": image_url(request, p.image), "caption": p.caption} for p in v.photos.all()],
        "courts": [{"id": c.pk, "name": c.name, "meta": c.meta, "is_active": c.is_active,
                    "sports": [s.name for s in c.sports.all()]} for c in v.courts.prefetch_related("sports")],
        "sports": [{"id": vs.pk, "sport": vs.sport.name, "base_price": vs.base_price, "peak_surcharge": vs.peak_surcharge,
                    "max_players": vs.max_players} for vs in v.venue_sports.select_related("sport")],
        "bookings": [_booking_row(request, b) for b in v.bookings.exclude(status__in=["held", "expired"])
                     .select_related("user", "venue", "court").order_by("-date", "-start_hour")[:10]],
        "blocked": [{"id": s.pk, "date": s.date.isoformat(), "court": str(s.court) if s.court_id else "All courts",
                     "from": s.start_hour, "to": s.end_hour, "reason": s.reason}
                    for s in v.blocked_slots.filter(date__gte=timezone.localdate()).select_related("court")[:10]],
    })


@api_view(["POST"])
@permission_classes([Panel])
@parser_classes([MultiPartParser, FormParser])
def venue_photos(request, pk):
    v = get_object_or_404(my_venues(request.user), pk=pk)
    start = v.photos.count()
    created = []
    for i, f in enumerate(request.FILES.getlist("images")):
        p = VenuePhoto.objects.create(venue=v, image=f, order=start + i)
        created.append({"id": p.pk, "url": image_url(request, p.image), "caption": ""})
    return Response({"photos": created})


@api_view(["DELETE"])
@permission_classes([Panel])
def venue_photo_delete(request, pk, photo_id):
    p = get_object_or_404(VenuePhoto, pk=photo_id, venue__in=my_venues(request.user), venue_id=pk)
    p.image.delete(save=False)
    p.delete()
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([Panel])
def availability(request, pk):
    """Day view of every court's slots, for the venue desk."""
    v = get_object_or_404(my_venues(request.user), pk=pk)
    try:
        day = date_cls.fromisoformat(request.GET.get("date", ""))
    except ValueError:
        day = timezone.localdate()
    hours = list(range(v.opens_at, v.closes_at))
    rows = []
    for court in v.courts.filter(is_active=True):
        by_hour = {}
        for b in Booking.objects.filter(court=court, date=day, status__in=["confirmed", "completed", "held"]).select_related("user"):
            for h in range(b.start_hour, b.start_hour + b.duration):
                by_hour[h] = b
        taken = booking_services.taken_hours(court, day)
        cells = []
        for h in hours:
            b = by_hour.get(h)
            cells.append({
                "hour": h,
                "booking": {"id": b.pk, "code": b.code, "player": b.user.name or b.user.email, "status": b.status,
                            "start": b.start_hour == h} if b else None,
                "blocked": h in taken and not b,
            })
        rows.append({"court": {"id": court.pk, "name": court.name}, "cells": cells})
    return Response({"venue": {"id": v.pk, "name": v.name}, "date": day.isoformat(), "date_label": f"{day:%A, %-d %B}",
                     "hours": [{"hour": h, "label": booking_services.fmt_hour(h)} for h in hours], "rows": rows})


# ------------------------------------------------------------------ bookings

@api_view(["GET"])
@permission_classes([Panel])
def booking_detail(request, pk):
    b = get_object_or_404(my_bookings(request.user).select_related("user", "venue__area__city", "court", "sport", "coupon"), pk=pk)
    quote = booking_services.cancel_quote(b) if b.status == "confirmed" else None
    return Response({
        **_booking_row(request, b),
        "venue_id": b.venue_id, "sport": b.sport.name, "duration": b.duration, "players": b.players,
        "user": {"id": b.user_id, "name": b.user.name, "email": b.user.email, "phone": b.user.phone},
        "slot_amount": b.slot_amount, "convenience_fee": b.convenience_fee, "gst": b.gst, "discount": b.discount,
        "coupon": b.coupon.code if b.coupon else None,
        "payment_method": b.get_payment_method_display() if b.payment_method else "", "transaction_id": b.transaction_id,
        "paid_at": _plain(request, b.paid_at), "checked_in_at": _plain(request, b.checked_in_at),
        "cancelled_at": _plain(request, b.cancelled_at), "cancellation_code": b.cancellation_code,
        "cancel_reason": b.cancel_reason, "refund_amount": b.refund_amount, "pin": b.checkin_pin,
        "notes": b.notes, "created_at": _plain(request, b.created_at),
        "quote": quote,
    })


@api_view(["POST"])
@permission_classes([Panel])
def booking_action(request, pk, action):
    b = get_object_or_404(my_bookings(request.user), pk=pk)
    if action == "checkin":
        if b.status != "confirmed":
            raise ValidationError({"message": "Only confirmed bookings can be checked in."})
        b.checked_in_at = timezone.now()
        b.save(update_fields=["checked_in_at"])
        from community.services import on_venue_checkin
        on_venue_checkin(b)  # releases a match's escrowed shares to the host
        msg = "Checked in."
    elif action == "cancel":
        booking_services.cancel(b, request.data.get("reason", "") or "Cancelled by venue", by_venue=True)
        msg = "Cancelled with full refund."
    elif action == "complete":
        b.status = "completed"
        b.save(update_fields=["status"])
        msg = "Marked completed."
    elif action == "notes":
        b.notes = request.data.get("notes", "")
        b.save(update_fields=["notes"])
        msg = "Notes saved."
    else:
        raise ValidationError({"message": "Unknown action."})
    return Response({"ok": True, "message": msg})


@api_view(["GET"])
@permission_classes([Panel])
def checkin(request):
    """Scan / type a booking code (or the full QR payload, or today's 4-digit PIN) to verify a ticket."""
    code = request.GET.get("code", "").strip()
    if code.startswith(("TURFLET|", "TURFLY|")):
        code = code.split("|")[1]
    if not code:
        raise ValidationError({"message": "Enter a booking code or PIN."})
    mine = my_bookings(request.user).select_related("user", "venue", "court", "sport")
    if code.isdigit() and len(code) == 4:
        b = mine.filter(checkin_pin=code, date=timezone.localdate(), status="confirmed").first()
    else:
        b = mine.filter(code__iexact=code).first()
    if not b:
        raise ValidationError({"message": f"No booking found for {code}."})
    return Response({**_booking_row(request, b), "sport": b.sport.name, "players": b.players,
                     "is_today": b.date == timezone.localdate(), "checked_in_at": _plain(request, b.checked_in_at)})


# ------------------------------------------------------------------ players (admins)

@api_view(["GET"])
@permission_classes([Staff])
def user_detail(request, pk):
    u = get_object_or_404(User, pk=pk)
    return Response({
        "id": u.pk, "name": u.name, "email": u.email, "phone": u.phone, "handle": u.handle, "address": u.address,
        "home_area": str(u.home_area) if u.home_area_id else None, "wallet_balance": u.wallet_balance,
        "is_active": u.is_active, "is_staff": u.is_staff, "is_venue_owner": u.is_venue_owner,
        "date_joined": _plain(request, u.date_joined), "referral_code": getattr(u, "referral_code", ""),
        "spent": u.bookings.filter(payment_status="paid").aggregate(s=Sum("total"))["s"] or 0,
        "sports": [{"name": s.sport.name, "level": s.get_level_display() if hasattr(s, "get_level_display") else s.level}
                   for s in u.sports.select_related("sport")],
        "bookings": [_booking_row(request, b) for b in u.bookings.select_related("user", "venue", "court").order_by("-created_at")[:20]],
    })


@api_view(["POST"])
@permission_classes([Staff])
def user_wallet(request, pk):
    u = get_object_or_404(User, pk=pk)
    try:
        delta = int(request.data.get("amount", 0))
    except (TypeError, ValueError):
        delta = 0
    balance = payments.adjust_wallet(u.pk, delta)
    if delta:
        notifications.notify(u.pk, "Wallet updated", f"₹{abs(delta)} {'added to' if delta > 0 else 'removed from'} your Turflet balance")
    return Response({"ok": True, "balance": balance})


# ------------------------------------------------------------------ settings & broadcast (admins)

class SettingsForm(forms.ModelForm):
    class Meta:
        model = AppConfig
        fields = "__all__"


@api_view(["GET", "PATCH"])
@permission_classes([Staff])
@parser_classes(PARSERS)
def settings_view(request):
    cfg = AppConfig.get()

    class R:  # just enough of a Resource for the shared helpers
        model = AppConfig
        fields = list(SettingsForm().fields)

    if request.method == "PATCH":
        form = SettingsForm(_form_data(request, R, cfg), request.FILES, instance=cfg)
        if not form.is_valid():
            _errors(form)
        form.save()
        return Response({"message": "Settings saved."})
    form = SettingsForm(instance=cfg)
    return Response({
        "fields": [_field_schema(R, form, n) for n in R.fields],
        "values": {n: _plain(request, getattr(cfg, n)) for n in R.fields},
    })


@api_view(["POST"])
@permission_classes([Staff])
def broadcast(request):
    title = str(request.data.get("title", "")).strip()
    body = str(request.data.get("body", "")).strip()
    if not title:
        raise ValidationError({"message": "Title is required."})
    users = User.objects.filter(is_active=True, notifications_on=True)
    if request.data.get("audience") == "bookers":
        users = users.filter(bookings__payment_status="paid").distinct()
    sent = notifications.broadcast(users.values_list("pk", flat=True), title, body, kind="offer")
    return Response({"message": f"Sent to {sent} players.", "sent": sent})
