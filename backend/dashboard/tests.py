"""Admin dashboard JSON API (used by the React admin)."""
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings import services as bookings
from core.models import AppConfig
from venues.models import Area, City, Court, Sport, Venue, VenueSport

from .crud import RESOURCES


@override_settings(UPI_CHECKOUT="")
class AdminApiTests(TestCase):
    def setUp(self):
        AppConfig.objects.create(pk=1, convenience_fee=40)
        self.area = Area.objects.create(city=City.objects.create(name="B", is_live=True), name="HSR", lat=1, lng=1)
        self.sport = Sport.objects.create(name="Football")
        self.admin = User.objects.create_user("a@x.com", name="Ada", phone="+919800000041", is_staff=True)
        self.owner = User.objects.create_user("o@x.com", name="Owen", phone="+919800000042", is_venue_owner=True)
        self.player = User.objects.create_user("p@x.com", name="Pia", phone="+919800000043", wallet_balance=5000)
        self.mine = self._venue("Mine", self.owner)
        self.other = self._venue("Other", None)
        court = self.mine.courts.first()
        day = timezone.localdate() + timedelta(days=1)
        self.booking = bookings.pay(bookings.create_hold(self.player, self.mine, court.id, self.sport.id, day, 10, 1), "wallet")

    def _venue(self, name, owner):
        v = Venue.objects.create(name=name, area=self.area, address="x", lat=1, lng=1, opens_at=6, closes_at=24,
                                 peak_start=30, peak_end=30, owner=owner)
        VenueSport.objects.create(venue=v, sport=self.sport, base_price=1000, max_players=14)
        c = Court.objects.create(venue=v, name="Pitch 1")
        c.sports.add(self.sport)
        return v

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    def test_players_cannot_use_the_dashboard(self):
        self.assertEqual(self.api(self.player).get("/api/v1/admin/meta/").status_code, 403)
        self.assertEqual(APIClient().get("/api/v1/admin/home/").status_code, 401)

    def test_every_resource_lists_with_schema_for_admins(self):
        a = self.api(self.admin)
        meta = a.get("/api/v1/admin/meta/").json()
        self.assertEqual(meta["role"], "admin")
        self.assertEqual(len(meta["nav"]), len(RESOURCES))
        for r in RESOURCES:
            res = a.get(f"/api/v1/admin/r/{r.slug}/?schema=1")
            self.assertEqual(res.status_code, 200, (r.slug, res.content[:300]))
            body = res.json()
            self.assertEqual(len(body["schema"]["columns"]), len(r.columns))
            for row in body["rows"]:
                self.assertEqual(len(row["cells"]), len(r.columns))

    def test_owner_sees_only_their_venues_and_bookings(self):
        o = self.api(self.owner)
        meta = o.get("/api/v1/admin/meta/").json()
        self.assertEqual(meta["role"], "owner")
        self.assertNotIn("users", [n["slug"] for n in meta["nav"]])
        names = [r["label"] for r in o.get("/api/v1/admin/r/venues/").json()["rows"]]
        self.assertEqual(names, ["Mine"])
        self.assertEqual(o.get(f"/api/v1/admin/r/venues/{self.other.pk}/").status_code, 404)
        self.assertEqual(o.get(f"/api/v1/admin/venues/{self.other.pk}/").status_code, 404)
        self.assertEqual(o.get("/api/v1/admin/r/users/").status_code, 404)
        self.assertEqual(o.get(f"/api/v1/admin/users/{self.player.pk}/").status_code, 403)
        self.assertEqual(o.get("/api/v1/admin/r/bookings/").json()["total"], 1)

    def test_create_patch_toggle_delete(self):
        a = self.api(self.admin)
        r = a.post("/api/v1/admin/r/sports/", {"name": "Padel", "fg_color": "#112233", "bg_color": "#ffffff", "order": 3, "is_active": True}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        pk = r.json()["id"]
        r = a.patch(f"/api/v1/admin/r/sports/{pk}/", {"order": 9}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        s = Sport.objects.get(pk=pk)
        self.assertEqual((s.name, s.order, s.is_active), ("Padel", 9, True))  # untouched fields kept
        self.assertFalse(a.post(f"/api/v1/admin/r/sports/{pk}/toggle/is_active/").json()["value"])
        bad = a.post("/api/v1/admin/r/sports/", {"order": 1}, format="json")
        self.assertEqual(bad.status_code, 400)
        self.assertIn("name", bad.json()["errors"])
        self.assertEqual(a.delete(f"/api/v1/admin/r/sports/{pk}/").status_code, 200)

    def test_owner_new_ground_starts_hidden(self):
        o = self.api(self.owner)
        r = o.post("/api/v1/admin/r/venues/", {"name": "New Turf", "area": self.area.pk, "address": "y", "lat": 1, "lng": 1,
                                                "opens_at": 6, "closes_at": 23, "peak_start": 18, "peak_end": 22}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        v = Venue.objects.get(pk=r.json()["id"])
        self.assertEqual((v.owner, v.is_active), (self.owner, False))

    def test_home_checkin_and_booking_actions(self):
        o = self.api(self.owner)
        home = o.get("/api/v1/admin/home/").json()
        self.assertEqual(len(home["days"]), 14)
        found = o.get(f"/api/v1/admin/checkin/?code={self.booking.code}").json()
        self.assertEqual(found["id"], self.booking.pk)
        r = o.post(f"/api/v1/admin/bookings/{self.booking.pk}/checkin/")
        self.assertEqual(r.status_code, 200, r.content)
        self.booking.refresh_from_db()
        self.assertIsNotNone(self.booking.checked_in_at)
        detail = o.get(f"/api/v1/admin/bookings/{self.booking.pk}/").json()
        self.assertEqual(detail["code"], self.booking.code)
        board = o.get(f"/api/v1/admin/venues/{self.mine.pk}/board/?date={self.booking.date}").json()
        self.assertTrue(any(c["booking"] for row in board["rows"] for c in row["cells"]))

    def test_admin_wallet_settings_broadcast(self):
        a = self.api(self.admin)
        self.assertEqual(a.post(f"/api/v1/admin/users/{self.player.pk}/wallet/", {"amount": 100}, format="json").json()["balance"],
                         User.objects.get(pk=self.player.pk).wallet_balance)
        s = a.get("/api/v1/admin/settings/").json()
        self.assertIn("convenience_fee", s["values"])
        self.assertEqual(a.patch("/api/v1/admin/settings/", {"convenience_fee": 55}, format="json").status_code, 200)
        self.assertEqual(AppConfig.get().convenience_fee, 55)
        self.assertEqual(a.post("/api/v1/admin/broadcast/", {"title": "Hi"}, format="json").status_code, 200)
