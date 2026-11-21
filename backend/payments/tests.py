from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from . import service as payments

User = get_user_model()


class WalletTests(TestCase):
    def setUp(self):
        self.u = User.objects.create_user("w@x.com", name="Wally", phone="+919800000021", wallet_balance=500)

    def balance(self):
        return payments.wallet_balance(self.u.pk)

    def test_wallet_charge_debits_and_refuses_when_short(self):
        r = payments.charge(self.u.pk, 300, "wallet", reference="T1")
        self.assertTrue(r.success)
        self.assertTrue(r.transaction_id.startswith("WALLET/"))
        self.assertEqual(self.balance(), 200)
        r = payments.charge(self.u.pk, 300, "wallet", reference="T2")
        self.assertEqual((r.success, r.message), (False, "Not enough Turflet balance."))
        self.assertEqual(self.balance(), 200)

    def test_gateway_charge_leaves_wallet_alone_and_checks_upi(self):
        self.assertTrue(payments.charge(self.u.pk, 300, "upi", reference="T1", upi_id="me@bank").success)
        self.assertFalse(payments.charge(self.u.pk, 300, "upi", reference="T2", upi_id="nope").success)
        self.assertEqual(self.balance(), 500)

    def test_refund_goes_back_the_way_it_was_paid(self):
        payments.refund(self.u.pk, 100, "wallet", "WALLET/1")
        self.assertEqual(self.balance(), 600)
        payments.refund(self.u.pk, 100, "upi", "UPI/1")
        self.assertEqual(self.balance(), 600)

    def test_debit_is_all_or_nothing_and_adjust_never_goes_negative(self):
        self.assertFalse(payments.debit_wallet(self.u.pk, 501))
        self.assertTrue(payments.debit_wallet(self.u.pk, 500))
        self.assertEqual(payments.adjust_wallet(self.u.pk, -50), 0)
        self.assertEqual(payments.adjust_wallet(self.u.pk, 75), 75)


class BookingWalletRefundTests(TestCase):
    """A booking paid from the wallet and cancelled by the venue is refunded to the wallet."""

    def test_venue_cancellation_refunds_wallet(self):
        from bookings import services as bookings
        from core.models import AppConfig
        from venues.models import Area, City, Court, Sport, Venue, VenueSport

        AppConfig.objects.create(pk=1, convenience_fee=40)
        area = Area.objects.create(city=City.objects.create(name="B", is_live=True), name="HSR", lat=1, lng=1)
        sport = Sport.objects.create(name="Football")
        venue = Venue.objects.create(name="Arena", area=area, address="x", lat=1, lng=1, opens_at=6, closes_at=24,
                                     peak_start=30, peak_end=30)
        VenueSport.objects.create(venue=venue, sport=sport, base_price=1000, max_players=14)
        court = Court.objects.create(venue=venue, name="Pitch 1")
        court.sports.add(sport)
        u = User.objects.create_user("p@x.com", name="Pat", phone="+919800000022", wallet_balance=5000)

        b = bookings.create_hold(u, venue, court.id, sport.id, timezone.localdate() + timedelta(days=2), 10, 1)
        b = bookings.pay(b, "wallet")
        self.assertEqual(payments.wallet_balance(u.pk), 5000 - b.total)
        bookings.cancel(b, "Rain", by_venue=True)
        self.assertEqual(payments.wallet_balance(u.pk), 5000)


# --- UPI through YOUPI -------------------------------------------------------------------------------

import hashlib  # noqa: E402
import hmac  # noqa: E402
import json  # noqa: E402
from unittest import mock  # noqa: E402

from django.test import override_settings  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from .models import Payment  # noqa: E402

YOUPI = dict(UPI_CHECKOUT="youpi", YOUPI_API_URL="https://gw.test", YOUPI_MERCHANT_ID="m-1",
             YOUPI_MERCHANT_KEY="key", YOUPI_WEBHOOK_SECRET="whsec")
WEBHOOK = "/api/v1/payments/youpi/webhook/"


@override_settings(**YOUPI)
class YoupiCheckoutTests(TestCase):
    def setUp(self):
        from bookings import services as bookings
        from core.models import AppConfig
        from venues.models import Area, City, Court, Sport, Venue, VenueSport

        AppConfig.objects.create(pk=1, convenience_fee=40)
        area = Area.objects.create(city=City.objects.create(name="B", is_live=True), name="HSR", lat=1, lng=1)
        self.sport = Sport.objects.create(name="Football")
        self.venue = Venue.objects.create(name="Arena", area=area, address="x", lat=1, lng=1, opens_at=6,
                                          closes_at=24, peak_start=30, peak_end=30)
        VenueSport.objects.create(venue=self.venue, sport=self.sport, base_price=1000, max_players=14)
        self.court = Court.objects.create(venue=self.venue, name="Pitch 1")
        self.court.sports.add(self.sport)
        self.user = User.objects.create_user("u@x.com", name="Uma", phone="+919800000031")
        self.day = timezone.localdate() + timedelta(days=2)
        self.booking = bookings.create_hold(self.user, self.venue, self.court.id, self.sport.id, self.day, 10, 1)
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.created = 0
        patcher = mock.patch("payments.youpi.create_payment", side_effect=self._fake_create)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _fake_create(self, order_id, amount, **kw):
        self.created += 1
        return {"paymentId": f"pay-{self.created}", "orderId": order_id, "status": "INITIATED",
                "checkoutUrl": f"https://pay.test/checkout/pay-{self.created}"}

    def start(self):
        r = self.api.post(f"/api/v1/bookings/{self.booking.id}/pay/", {"method": "upi"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def webhook(self, payment, event="SUCCESS", utr="123456789012", amount_paise=None, method="UPI", secret="whsec"):
        body = json.dumps({
            "event": event, "paymentId": payment.provider_payment_id, "orderId": payment.order_id,
            "amount": f"{payment.amount}.00", "amountPaise": payment.amount * 100 if amount_paise is None else amount_paise,
            "currency": "INR", "method": method, "utr": utr,
        }).encode()
        sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return self.client.post(WEBHOOK, data=body, content_type="application/json", HTTP_X_GATEWAY_SIGNATURE=sig)

    def refresh(self):
        self.booking.refresh_from_db()
        return self.booking

    def test_upi_pay_opens_checkout_and_keeps_booking_held(self):
        data = self.start()
        p = Payment.objects.get()
        self.assertEqual((p.status, p.amount, p.reference_id, p.user), ("pending", self.booking.total, self.booking.id, self.user))
        self.assertEqual(data["payment"]["checkout_url"], "https://pay.test/checkout/pay-1")
        self.assertEqual((data["status"], data["payment_status"]), ("held", "pending"))
        self.assertGreater(self.refresh().held_until, timezone.now() + timedelta(minutes=9))

    def test_tapping_pay_again_reuses_the_open_session(self):
        self.start()
        with mock.patch("payments.youpi.get_payment", return_value={"status": "ACTIVE"}):
            self.start()
        self.assertEqual((Payment.objects.count(), self.created), (1, 1))

    def test_signed_success_webhook_confirms_booking_once(self):
        self.start()
        p = Payment.objects.get()
        for _ in range(2):  # the gateway may deliver twice
            self.assertEqual(self.webhook(p).status_code, 200)
        p.refresh_from_db()
        b = self.refresh()
        self.assertEqual((p.status, p.utr, p.refund_status), ("success", "123456789012", ""))
        self.assertEqual((b.status, b.payment_status, b.payment_method, b.transaction_id),
                         ("confirmed", "paid", "upi", "123456789012"))
        from notifications.models import Notification
        self.assertEqual(Notification.objects.filter(user=self.user, title="Booking confirmed").count(), 1)

    def test_bad_signature_wrong_amount_or_cod_never_confirm(self):
        self.start()
        p = Payment.objects.get()
        self.assertEqual(self.webhook(p, secret="wrong").status_code, 401)
        self.webhook(p, amount_paise=100)
        self.webhook(p, method="COD")
        p.refresh_from_db()
        self.assertEqual((p.status, self.refresh().status), ("pending", "held"))

    def test_polling_confirms_from_gateway_status_and_utr_follows(self):
        self.start()
        p = Payment.objects.get()
        status = {"status": "SUCCESS", "paymentId": p.provider_payment_id, "orderId": p.order_id,
                  "amountPaise": str(p.amount * 100), "method": "UPI"}
        with mock.patch("payments.youpi.get_payment", return_value=status):
            data = self.api.get(f"/api/v1/bookings/{self.booking.id}/payment/").json()
        self.assertEqual((data["status"], data["payment"]["status"]), ("confirmed", "success"))
        self.assertEqual(self.refresh().transaction_id, "pay-1")
        self.webhook(p)  # webhook arrives later with the bank reference
        self.assertEqual(self.refresh().transaction_id, "123456789012")

    def test_failed_payment_leaves_booking_payable(self):
        self.start()
        p = Payment.objects.get()
        self.webhook(p, event="EXPIRED")
        p.refresh_from_db()
        self.assertEqual((p.status, self.refresh().status), ("expired", "held"))
        self.start()  # a fresh session for the retry
        self.assertEqual(Payment.objects.filter(status="pending").count(), 1)
        self.assertEqual(Payment.objects.first().order_id, f"{self.booking.code}-P2")

    def test_late_payment_for_a_lost_slot_is_flagged_for_refund(self):
        from bookings import services as bookings
        self.start()
        p = Payment.objects.get()
        from bookings.models import Booking
        Booking.objects.filter(pk=self.booking.pk).update(status="expired")
        other = User.objects.create_user("o@x.com", name="Oz", phone="+919800000032", wallet_balance=5000)
        bookings.pay(bookings.create_hold(other, self.venue, self.court.id, self.sport.id, self.day, 10, 1), "wallet")
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.status, p.refund_status, p.refund_amount), ("success", "pending", p.amount))
        self.assertEqual(self.refresh().status, "expired")

    def test_late_payment_for_a_free_slot_still_confirms(self):
        self.start()
        p = Payment.objects.get()
        from bookings.models import Booking
        Booking.objects.filter(pk=self.booking.pk).update(status="expired")
        self.webhook(p)
        self.assertEqual(self.refresh().status, "confirmed")

    def test_cancelling_a_youpi_booking_queues_a_manual_refund(self):
        from bookings import services as bookings
        self.start()
        p = Payment.objects.get()
        self.webhook(p)
        bookings.cancel(self.refresh(), "Rain", by_venue=True)
        p.refresh_from_db()
        self.assertEqual((p.refund_status, p.refund_amount), ("pending", self.booking.total))

    @override_settings(UPI_CHECKOUT="")
    def test_without_youpi_upi_still_uses_the_instant_gateway(self):
        r = self.api.post(f"/api/v1/bookings/{self.booking.id}/pay/", {"method": "upi"}, format="json")
        self.assertEqual(r.json()["status"], "confirmed")
        self.assertFalse(Payment.objects.exists())
