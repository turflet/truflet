"""Match flows end to end through the API.

    DATABASE_URL=sqlite:///tmp.sqlite3 python manage.py test community
"""
from datetime import datetime, timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from bookings.models import Booking
from core.models import AppConfig
from venues.models import Amenity, Area, City, Court, Sport, Venue, VenueSport

from .models import Lobby, LobbyMember


@override_settings(UPI_CHECKOUT="")  # these flows use the instant gateway; LobbyYoupiTests covers YOUPI
class MatchTestCase(TestCase):
    def setUp(self):
        AppConfig.objects.create(pk=1, split_fee=10, convenience_fee=40)
        city = City.objects.create(name="Bengaluru", is_live=True)
        self.area = Area.objects.create(city=city, name="HSR", lat=12.9121, lng=77.6446)
        self.sport = Sport.objects.create(name="Football")
        self.venue = Venue.objects.create(name="Arena", area=self.area, address="x", lat=12.9121, lng=77.6446,
                                          opens_at=6, closes_at=24, peak_start=30, peak_end=30)
        VenueSport.objects.create(venue=self.venue, sport=self.sport, base_price=1000, max_players=14)
        self.court = Court.objects.create(venue=self.venue, name="Pitch 1")
        self.court.sports.add(self.sport)
        self.host = User.objects.create_user("host@x.com", name="Hana Host", phone="+919800000001")
        self.friend = User.objects.create_user("friend@x.com", name="Fred Friend", phone="+919800000002")
        self.solo = User.objects.create_user("solo@x.com", name="Sam Solo", phone="+919800000003")
        self.other = User.objects.create_user("other@x.com", name="Oli Other", phone="+919800000004")
        self.day = timezone.localdate() + timedelta(days=2)

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    HOST_PAY_METHOD = "upi"  # instant gateway here; LobbyYoupiTests pays from the wallet

    def payload(self, **extra):
        body = {"venue": self.venue.id, "court": self.court.id, "sport": self.sport.id, "date": self.day.isoformat(),
                "start_hour": 19, "duration": 1, "capacity": 4, "is_public": True,
                "friends": [{"contact": "friend@x.com", "tag": "known"}, {"tag": "guest", "name": "Gus"}]}
        body.update(extra)
        return body

    def create(self, accept_friend=True, pay=True, **extra):
        """Squad Builder → the host is sent straight to pay the whole turf (a held booking). `pay` pays it."""
        body = self.payload(**extra)
        r = self.api(self.host).post("/api/v1/lobbies/", body, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "draft")
        self.assertEqual(r.data["checkout_booking"]["status"], "held")  # creating a match goes straight to payment
        lb = r.data
        if pay:
            lb = self.pay_host(lb)
        if accept_friend and any(f.get("tag") != "guest" for f in body.get("friends") or []):
            a = self.api(self.friend).post(f"/api/v1/lobbies/{lb['id']}/accept-invite/")
            self.assertEqual(a.status_code, 200, a.data)
        return lb

    def pay_host(self, lb):
        r = self.api(self.host).post(f"/api/v1/bookings/{lb['checkout_booking']['id']}/pay/",
                                     {"method": self.HOST_PAY_METHOD}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["lobby"]["status"], "locked")
        data = self.api(self.host).get(f"/api/v1/lobbies/{lb['id']}/").data
        data["checkout_booking"] = lb["checkout_booking"]
        return data

    def request(self, lobby_id, user):
        r = self.api(user).post(f"/api/v1/lobbies/{lobby_id}/request/", {"message": "Can I play?"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data["id"]

    def screen_in(self, lobby_id, user):
        rid = self.request(lobby_id, user)
        r = self.api(self.host).post(f"/api/v1/lobbies/{lobby_id}/requests/{rid}/approve/")
        self.assertEqual(r.status_code, 200, r.data)
        return rid

    def pay(self, lobby_id, user):
        r = self.api(user).post(f"/api/v1/lobbies/{lobby_id}/pay/", {"method": "upi"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def slot_status(self, hour=19):
        slots = self.client.get(f"/api/v1/venues/{self.venue.id}/availability/",
                                {"date": self.day, "sport": self.sport.id, "court": self.court.id}).data["slots"]
        return next(x for x in slots if x["hour"] == hour)["status"]


class HostPaysTests(MatchTestCase):
    def test_creating_holds_the_slot_for_15_minutes_and_host_pays_everything(self):
        lb = self.create(pay=False, accept_friend=False, payment_rule="split", booking_mode="crowdfund")  # old choices ignored
        self.assertEqual((lb["payment_rule"], lb["booking_mode"]), ("split", "book_recover"))
        self.assertNotEqual(self.slot_status(), "free")  # held for the host
        hold = Booking.objects.get(pk=lb["checkout_booking"]["id"])
        self.assertAlmostEqual((hold.held_until - timezone.now()).total_seconds(), 15 * 60, delta=5)
        host = LobbyMember.objects.get(lobby_id=lb["id"], tag="host")
        self.assertEqual(host.share_due, hold.total)  # the whole turf
        friend = LobbyMember.objects.get(lobby_id=lb["id"], user=self.friend)
        self.assertEqual((friend.status, friend.amount_due), ("invited", 0))
        # not listed for solo players until the host has paid
        self.assertEqual(self.client.get(f"/api/v1/venues/{self.venue.id}/lobbies/").data, [])
        lb = self.pay_host(lb)
        self.assertEqual(self.slot_status(), "booked")
        self.assertEqual(len(self.client.get(f"/api/v1/venues/{self.venue.id}/lobbies/").data), 1)

    def test_host_unpaid_after_15_minutes_cancels_and_frees_the_slot(self):
        lb = self.create(pay=False)
        with mock.patch.object(timezone, "now", return_value=timezone.now() + timedelta(minutes=16)):
            data = self.api(self.host).get(f"/api/v1/lobbies/{lb['id']}/").data
            self.assertEqual(self.slot_status(), "free")
        self.assertEqual((data["status"], data["cancelled_by"] if "cancelled_by" in data else "system"), ("cancelled", "system"))

    def test_friends_play_free(self):
        lb = self.create()
        m = LobbyMember.objects.get(lobby_id=lb["id"], user=self.friend)
        self.assertEqual((m.status, m.amount_due), ("confirmed", 0))
        self.assertEqual(self.api(self.friend).post(f"/api/v1/lobbies/{lb['id']}/pay/", {"method": "upi"}).status_code, 400)

    def test_private_squad_is_the_hosts_own_and_takes_no_requests(self):
        lb = self.create(is_public=False, capacity=10, friends=[])
        self.assertEqual(LobbyMember.objects.filter(lobby_id=lb["id"]).count(), 1)  # just the host, no placeholders
        self.assertTrue(lb["own_squad"])
        self.assertEqual((lb["taken"], lb["spots_left"]), (10, 0))
        r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/request/", {}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_players_with_you_take_spots_and_share_is_turf_over_total(self):
        lb = self.create(capacity=10, players_with_you=7)  # host + friend + guest + 4 unnamed
        self.assertEqual((lb["capacity"], lb["taken"], lb["spots_left"], lb["own_players"]), (10, 7, 3, 4))
        self.assertEqual(lb["share"], -(-lb["turf_price"] // 10))
        lots = self.client.get(f"/api/v1/venues/{self.venue.id}/lobbies/").data
        self.assertEqual(lots[0]["spots_left"], 3)

    def test_players_with_you_is_validated(self):
        r = self.api(self.host).post("/api/v1/lobbies/", {**self.payload(capacity=10), "players_with_you": 11}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.api(self.host).post("/api/v1/lobbies/", {**self.payload(capacity=10), "players_with_you": 1}, format="json")
        self.assertEqual(r.status_code, 400)  # host, friend and guest are already 3

    def test_full_squad_is_private(self):
        lb = self.create(capacity=8, players_with_you=8)
        self.assertEqual((lb["is_public"], lb["spots_left"]), (False, 0))


class ScreeningTests(MatchTestCase):
    def test_requester_never_sees_main_chat_until_approved(self):
        lb = self.create()
        self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/messages/", {"body": "Squad only: gate code 4411"})
        r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/request/", {"message": "Hi"}, format="json")
        rid = r.data["id"]
        self.assertEqual(self.api(self.solo).get(f"/api/v1/lobbies/{lb['id']}/messages/").status_code, 400)
        detail = self.api(self.solo).get(f"/api/v1/lobbies/{lb['id']}/").data
        self.assertNotIn("members", detail)
        self.assertEqual(detail["my_role"], "requested")
        self.assertIsNotNone(detail["request_expires_at"])
        # 1-on-1 thread works both ways, and is private to the pair
        self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/messages/", {"body": "Can you keep?"})
        thread = self.api(self.solo).get(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/messages/").data
        self.assertIn("Can you keep?", [m["body"] for m in thread])
        self.assertEqual(self.api(self.other).get(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/messages/").status_code, 400)
        requests = self.api(self.host).get(f"/api/v1/lobbies/{lb['id']}/requests/").data
        self.assertIn("score", requests[0]["player"])
        self.assertIsNotNone(requests[0]["expires_at"])

        self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/approve/")
        chat = self.api(self.solo).get(f"/api/v1/lobbies/{lb['id']}/messages/").data
        self.assertIn("Squad only: gate code 4411", [m["body"] for m in chat])
        card = [m for m in chat if m["kind"] == "payment" and m["card"]["is_me"]][0]["card"]
        self.assertEqual((card["amount"], card["status"]), (260, "pending"))  # ₹1000 / 4 + ₹10 fee

    def test_declined_closes_thread(self):
        lb = self.create()
        rid = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/request/", {}, format="json").data["id"]
        self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/decline/")
        r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/messages/", {"body": "pls"})
        self.assertEqual(r.status_code, 400)
        # asking again reopens the same thread (see ReRequestTests)
        self.assertEqual(self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/request/").status_code, 201)

    def test_request_expires_after_2_hours(self):
        lb = self.create()
        rid = self.request(lb["id"], self.solo)
        with mock.patch.object(timezone, "now", return_value=timezone.now() + timedelta(hours=2, minutes=1)):
            detail = self.api(self.solo).get(f"/api/v1/lobbies/{lb['id']}/").data
            r = self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/approve/")
        self.assertIsNone(detail["my_role"])  # can ask again
        self.assertEqual(r.status_code, 400)
        again = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/request/", {}, format="json")
        self.assertEqual((again.status_code, again.data["status"]), (201, "pending"))

    def test_approval_does_not_reserve_first_to_pay_gets_the_spot(self):
        lb = self.create()  # host + friend + guest = 3 of 4 → 1 spot
        self.screen_in(lb["id"], self.solo)
        self.screen_in(lb["id"], self.other)  # both approved for the single spot
        self.assertEqual(len(self.client.get(f"/api/v1/venues/{self.venue.id}/lobbies/").data), 1)  # still open
        self.pay(lb["id"], self.other)
        r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/pay/", {"method": "upi"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("paid first", str(r.data))  # "This match filled up — other players paid first"
        self.assertEqual(LobbyMember.objects.get(lobby_id=lb["id"], user=self.solo).status, "removed")
        self.assertEqual(LobbyMember.objects.get(lobby_id=lb["id"], user=self.other).status, "confirmed")
        self.assertEqual(self.client.get(f"/api/v1/venues/{self.venue.id}/lobbies/").data, [])  # full

    def test_full_match_declines_waiting_requests(self):
        lb = self.create()
        self.screen_in(lb["id"], self.solo)
        rid = self.request(lb["id"], self.other)
        self.pay(lb["id"], self.solo)
        from .models import JoinRequest
        self.assertEqual(JoinRequest.objects.get(pk=rid).status, "declined")


class BookAndRecoverTests(MatchTestCase):
    def locked(self, **extra):
        lb = self.create(**extra)
        self.assertEqual(self.slot_status(), "booked")
        return lb

    def test_venue_qr_checkin_releases_escrow_to_host(self):
        lb = self.locked(capacity=5)  # 2 open spots, ₹200 share each
        self.screen_in(lb["id"], self.solo)
        self.pay(lb["id"], self.solo)
        self.screen_in(lb["id"], self.other)
        self.pay(lb["id"], self.other)
        self.assertEqual(User.objects.get(pk=self.host.pk).wallet_balance, 0)  # still in escrow
        from community.services import on_venue_checkin
        on_venue_checkin(Booking.objects.get(pk=lb["checkout_booking"]["id"]))
        self.assertEqual(User.objects.get(pk=self.host.pk).wallet_balance, 400)  # 2 shares, fees kept
        self.assertEqual(Lobby.objects.get(pk=lb["id"]).payout_trigger, "qr")

    def test_gps_checkin_by_host_and_solo_releases_payout(self):
        lb = self.locked()
        self.screen_in(lb["id"], self.solo)
        self.pay(lb["id"], self.solo)
        kickoff = Lobby.objects.get(pk=lb["id"]).start_dt
        here = {"lat": 12.9122, "lng": 77.6447}
        with mock.patch.object(timezone, "now", return_value=kickoff - timedelta(minutes=5)):
            far = self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/checkin/", {"lat": 12.95, "lng": 77.6})
            self.assertEqual(far.status_code, 400)
            self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/checkin/", here)
            r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/checkin/", here)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Lobby.objects.get(pk=lb["id"]).payout_trigger, "gps")

    def test_no_show_report_blocks_auto_release(self):
        lb = self.locked()
        self.screen_in(lb["id"], self.solo)
        self.pay(lb["id"], self.solo)
        lobby = Lobby.objects.get(pk=lb["id"])
        with mock.patch.object(timezone, "now", return_value=lobby.start_dt + timedelta(minutes=10)):
            r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/report/", {"reason": "Host never came"})
        self.assertEqual(r.status_code, 200, r.data)
        with mock.patch.object(timezone, "now", return_value=lobby.end_dt + timedelta(minutes=20)):
            self.api(self.host).get(f"/api/v1/lobbies/{lb['id']}/")
        self.assertEqual(User.objects.get(pk=self.host.pk).wallet_balance, 0)
        self.assertEqual(Lobby.objects.get(pk=lb["id"]).payout_status, "disputed")

    def test_silent_auto_release_after_match_end(self):
        lb = self.locked()
        self.screen_in(lb["id"], self.solo)
        self.pay(lb["id"], self.solo)
        lobby = Lobby.objects.get(pk=lb["id"])
        with mock.patch.object(timezone, "now", return_value=lobby.end_dt + timedelta(minutes=16)):
            data = self.api(self.host).get(f"/api/v1/lobbies/{lb['id']}/").data
        self.assertEqual((data["payout"]["status"], data["payout"]["trigger"]), ("released", "auto"))
        self.assertEqual(User.objects.get(pk=self.host.pk).wallet_balance, 250)

    def test_drop_off_rules(self):
        lb = self.locked()
        self.screen_in(lb["id"], self.solo)
        self.pay(lb["id"], self.solo)
        # early drop-off: refunded only once a replacement pays
        r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/leave/")
        self.assertIn("replacement", r.data["message"])
        solo = LobbyMember.objects.get(lobby_id=lb["id"], user=self.solo)
        self.assertEqual((solo.refund_due, solo.escrow), (True, "held"))
        self.screen_in(lb["id"], self.other)
        self.pay(lb["id"], self.other)
        solo.refresh_from_db()
        self.assertEqual((solo.escrow, solo.status), ("refunded", "refunded"))
        # late ghosting (< 30 min): not refundable
        lobby = Lobby.objects.get(pk=lb["id"])
        with mock.patch.object(timezone, "now", return_value=lobby.start_dt - timedelta(minutes=20)):
            r = self.api(self.other).post(f"/api/v1/lobbies/{lb['id']}/leave/")
        self.assertIn("not refundable", r.data["message"])
        self.assertEqual(LobbyMember.objects.get(lobby_id=lb["id"], user=self.other).escrow, "forfeited")

    def test_venue_cancellation_refunds_everyone_in_full(self):
        lb = self.locked()
        self.screen_in(lb["id"], self.solo)
        self.pay(lb["id"], self.solo)
        from bookings.services import cancel
        b = cancel(Booking.objects.get(pk=lb["checkout_booking"]["id"]), "Rain", by_venue=True)
        self.assertEqual(b.refund_amount, b.total)
        self.assertEqual(Lobby.objects.get(pk=lb["id"]).status, "cancelled")
        self.assertEqual(LobbyMember.objects.get(lobby_id=lb["id"], user=self.solo).escrow, "refunded")

    def test_unpublish_refunds_solo_and_keeps_squad(self):
        lb = self.locked()
        self.screen_in(lb["id"], self.solo)
        self.pay(lb["id"], self.solo)
        r = self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/unpublish/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(r.data["is_public"])
        self.assertEqual(LobbyMember.objects.get(lobby_id=lb["id"], user=self.solo).escrow, "refunded")
        self.assertEqual(self.api(self.friend).get(f"/api/v1/lobbies/{lb['id']}/messages/").status_code, 200)


class SquadBuilderValidationTests(MatchTestCase):
    def test_capacity_cannot_exceed_sport_max(self):
        r = self.api(self.host).post("/api/v1/lobbies/", {
            "venue": self.venue.id, "court": self.court.id, "sport": self.sport.id, "date": self.day.isoformat(),
            "start_hour": 19, "duration": 1, "capacity": 30, "is_public": True}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Lobby.objects.exists())

    def test_taken_slot_creates_nothing(self):
        Booking.objects.create(user=self.other, venue=self.venue, court=self.court, sport=self.sport, date=self.day,
                               start_hour=19, status="confirmed", total=1000)
        r = self.api(self.host).post("/api/v1/lobbies/", {
            "venue": self.venue.id, "court": self.court.id, "sport": self.sport.id, "date": self.day.isoformat(),
            "start_hour": 19, "duration": 1, "capacity": 4, "is_public": True}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Lobby.objects.exists())

    def test_unknown_friend_suggests_guest(self):
        r = self.api(self.host).get("/api/v1/lobbies/players/", {"contact": "nobody@x.com"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("guest", r.data["message"])


class DiscoveryTests(MatchTestCase):
    def test_radius_expands_until_three_venues(self):
        far = [(12.94, 77.65), (12.95, 77.66), (12.96, 77.67)]  # ~3-7 km away
        for i, (lat, lng) in enumerate(far):
            v = Venue.objects.create(name=f"Far {i}", area=self.area, address="x", lat=lat, lng=lng)
            VenueSport.objects.create(venue=v, sport=self.sport, base_price=800 + i * 400)
        r = self.client.get("/api/v1/venues/", {"area": self.area.id, "lat": 12.9121, "lng": 77.6446}).data
        self.assertEqual(r["radius_km"], 5)
        self.assertIn("Expanded search to 5 km", r["notice"])
        self.assertEqual(len(r["items"]), 3)

    def test_filters(self):
        roof = Amenity.objects.create(name="Covered roof", icon="covered")
        self.venue.amenities.add(roof)
        other = Venue.objects.create(name="Open air", area=self.area, address="x")
        VenueSport.objects.create(venue=other, sport=self.sport, base_price=2500)
        r = self.client.get("/api/v1/venues/", {"area": self.area.id, "amenities": "covered"}).data
        self.assertEqual([v["name"] for v in r["items"]], ["Arena"])
        r = self.client.get("/api/v1/venues/", {"area": self.area.id, "price_max": 1500}).data
        self.assertEqual([v["name"] for v in r["items"]], ["Arena"])
        # fully booked 6–8 PM → filtered out of that window
        for h in (18, 19):
            Booking.objects.create(user=self.other, venue=self.venue, court=self.court, sport=self.sport,
                                   date=self.day, start_hour=h, status="confirmed", total=1)
        r = self.client.get("/api/v1/venues/", {"area": self.area.id, "date": self.day.isoformat(),
                                                "from_hour": 18, "to_hour": 20}).data
        self.assertNotIn("Arena", [v["name"] for v in r["items"]])

    def test_venue_card_counts_open_lobbies(self):
        self.create()
        r = self.client.get("/api/v1/venues/", {"area": self.area.id}).data
        self.assertEqual(r["items"][0]["open_lobbies"], 1)


class InviteTests(MatchTestCase):
    def test_known_friend_is_invited_not_added(self):
        lb = self.create(accept_friend=False)
        m = LobbyMember.objects.get(lobby_id=lb["id"], user=self.friend)
        self.assertEqual(m.status, "invited")
        self.assertEqual(lb["spots_left"], 1)  # host + invited friend + guest hold 3 of 4
        # an invited friend sees the card with Accept / Decline, never the private chat
        card = self.api(self.friend).get(f"/api/v1/lobbies/{lb['id']}/").data
        self.assertEqual(card["my_role"], "invited")
        self.assertNotIn("members", card)
        self.assertEqual(self.api(self.friend).get(f"/api/v1/lobbies/{lb['id']}/messages/").status_code, 400)
        self.assertEqual([x["id"] for x in self.api(self.friend).get("/api/v1/lobbies/mine/").data["requests"]],
                         [lb["id"]])
        r = self.api(self.friend).post(f"/api/v1/lobbies/{lb['id']}/accept-invite/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["me"]["status"], "confirmed")  # the host covers friends
        self.assertFalse(r.data["me"]["can_pay"])

    def test_declined_invite_frees_the_spot(self):
        lb = self.create(accept_friend=False)
        r = self.api(self.friend).post(f"/api/v1/lobbies/{lb['id']}/decline-invite/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["spots_left"], 2)
        self.assertEqual(self.api(self.friend).post(f"/api/v1/lobbies/{lb['id']}/accept-invite/").status_code, 400)

    def test_only_host_can_lock(self):
        lb = self.create(pay=False)
        self.assertEqual(self.api(self.friend).post(f"/api/v1/lobbies/{lb['id']}/lock/").status_code, 400)


class ReRequestTests(MatchTestCase):
    def test_declined_player_can_request_again(self):
        lb = self.create()
        r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/request/", {"message": "hi"}, format="json")
        rid = r.data["id"]
        self.assertEqual(self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/decline/").status_code, 200)
        self.assertEqual(self.api(self.solo).get(f"/api/v1/lobbies/{lb['id']}/").data["my_role"], "declined")
        again = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/request/", {"message": "Please?"}, format="json")
        self.assertEqual(again.status_code, 201, again.data)
        self.assertEqual((again.data["id"], again.data["status"]), (rid, "pending"))
        self.assertEqual(self.api(self.host).post(f"/api/v1/lobbies/{lb['id']}/requests/{rid}/approve/").status_code, 200)


# ------------------------------------------------------------------ UPI through the YOUPI checkout
import hashlib  # noqa: E402
import hmac  # noqa: E402
import json  # noqa: E402


from payments.models import Payment  # noqa: E402

YOUPI = dict(UPI_CHECKOUT="youpi", YOUPI_API_URL="https://gw.test", YOUPI_MERCHANT_ID="m-1",
             YOUPI_MERCHANT_KEY="key", YOUPI_WEBHOOK_SECRET="whsec")


@override_settings(**YOUPI)
class LobbyYoupiTests(MatchTestCase):
    HOST_PAY_METHOD = "wallet"

    def setUp(self):
        super().setUp()
        User.objects.filter(pk=self.host.pk).update(wallet_balance=100000)
        self.created = 0
        patcher = mock.patch("payments.youpi.create_payment", side_effect=self._fake_create)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _fake_create(self, order_id, amount, **kw):
        self.created += 1
        return {"paymentId": f"pay-{self.created}", "orderId": order_id, "status": "INITIATED",
                "checkoutUrl": f"https://pay.test/checkout/pay-{self.created}"}

    def webhook(self, p, event="SUCCESS", utr="999988887777"):
        body = json.dumps({"event": event, "paymentId": p.provider_payment_id, "orderId": p.order_id,
                           "amountPaise": p.amount * 100, "method": "UPI", "utr": utr}).encode()
        sig = "sha256=" + hmac.new(b"whsec", body, hashlib.sha256).hexdigest()
        return self.client.post("/api/v1/payments/youpi/webhook/", data=body, content_type="application/json",
                                HTTP_X_GATEWAY_SIGNATURE=sig)

    def member(self, lb, user):
        return LobbyMember.objects.get(lobby_id=lb["id"], user=user)

    def approved(self):
        lb = self.create()
        self.screen_in(lb["id"], self.solo)
        return lb

    def test_share_opens_checkout_and_settles_on_webhook(self):
        lb = self.approved()
        r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/pay/", {"method": "upi"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["payment"]["checkout_url"], "https://pay.test/checkout/pay-1")
        m = self.member(lb, self.solo)
        self.assertEqual(m.status, "pending")
        p = Payment.objects.get()
        self.assertEqual((p.purpose, p.reference_id, p.amount), ("lobby_share", m.pk, m.amount_due))
        self.webhook(p)
        self.webhook(p)  # duplicate delivery is harmless
        m.refresh_from_db()
        p.refresh_from_db()
        self.assertEqual((m.status, m.escrow, m.payment_method, m.transaction_id), ("confirmed", "held", "upi", "999988887777"))
        self.assertEqual((p.status, p.refund_status), ("success", ""))

    def test_polling_settles_share(self):
        lb = self.approved()
        self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/pay/", {"method": "upi"}, format="json")
        p = Payment.objects.get()
        status = {"status": "SUCCESS", "paymentId": p.provider_payment_id, "orderId": p.order_id,
                  "amountPaise": str(p.amount * 100), "method": "UPI"}
        with mock.patch("payments.youpi.get_payment", return_value=status):
            r = self.api(self.solo).get(f"/api/v1/lobbies/{lb['id']}/payment/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["payment"]["status"], "success")
        self.assertEqual(self.member(lb, self.solo).status, "confirmed")

    def test_wallet_share_still_instant(self):
        lb = self.approved()
        User.objects.filter(pk=self.solo.pk).update(wallet_balance=5000)
        r = self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/pay/", {"method": "wallet"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertNotIn("payment", r.data)
        self.assertEqual(self.member(lb, self.solo).status, "confirmed")

    def test_late_share_after_window_is_flagged_for_refund(self):
        lb = self.approved()
        self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/pay/", {"method": "upi"}, format="json")
        LobbyMember.objects.filter(lobby_id=lb["id"], user=self.solo).update(status="removed")
        p = Payment.objects.get()
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.status, p.refund_status), ("success", "pending"))

    def test_upi_share_landing_after_someone_else_filled_the_match_is_refunded(self):
        lb = self.approved()
        self.screen_in(lb["id"], self.other)
        self.api(self.solo).post(f"/api/v1/lobbies/{lb['id']}/pay/", {"method": "upi"}, format="json")
        User.objects.filter(pk=self.other.pk).update(wallet_balance=5000)
        r = self.api(self.other).post(f"/api/v1/lobbies/{lb['id']}/pay/", {"method": "wallet"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)  # paid first → takes the last spot
        p = Payment.objects.get(user=self.solo)
        self.webhook(p)
        p.refresh_from_db()
        self.assertEqual((p.status, p.refund_status), ("success", "pending"))
        self.assertNotEqual(self.member(lb, self.solo).status, "confirmed")
