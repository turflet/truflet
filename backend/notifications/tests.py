from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import notifykit, service
from .channels import fcm
from .models import DeviceToken, Notification

User = get_user_model()


class DeviceTokenTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("a@x.com", name="Ann", phone="+919800000011")
        self.b = User.objects.create_user("b@x.com", name="Ben", phone="+919800000012")
        self.api = APIClient()

    def test_register_moves_token_between_players_and_remove_needs_no_session(self):
        self.api.force_authenticate(self.a)
        self.assertEqual(self.api.post("/api/v1/devices/", {"token": "tok1", "platform": "android"}).status_code, 200)
        self.api.force_authenticate(self.b)
        self.api.post("/api/v1/devices/", {"token": "tok1", "platform": "android"})
        self.assertEqual(DeviceToken.objects.get(token="tok1").user, self.b)
        self.api.force_authenticate(None)
        self.assertEqual(self.api.post("/api/v1/devices/remove/", {"token": "tok1"}).status_code, 200)
        self.assertFalse(DeviceToken.objects.exists())

    def test_register_requires_sign_in(self):
        self.assertEqual(self.api.post("/api/v1/devices/", {"token": "tok1"}).status_code, 401)


class NotifyTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user("a@x.com", name="Ann", phone="+919800000011")
        self.b = User.objects.create_user("b@x.com", name="Ben", phone="+919800000012", notifications_on=False)

    def test_notify_saves_and_pushes_after_commit_unless_muted(self):
        with mock.patch.object(fcm, "send") as send, self.captureOnCommitCallbacks(execute=True):
            nid = service.notify(self.a.pk, "Hi", "there", "match")
        send.assert_called_once_with(self.a.pk, "Hi", "there", {"kind": "match", "notification_id": nid})
        with mock.patch.object(fcm, "send") as send, self.captureOnCommitCallbacks(execute=True):
            service.notify(self.b.pk, "Hi")
        send.assert_not_called()
        self.assertEqual(Notification.objects.filter(user=self.b).count(), 1)  # muted players still get it in-app

    def test_notify_without_a_user_is_a_no_op(self):
        self.assertIsNone(service.notify(None, "Hi"))
        self.assertFalse(Notification.objects.exists())

    def test_broadcast_and_list_api(self):
        self.assertEqual(service.broadcast([self.a.pk, self.b.pk], "Offer", "₹100 off"), 2)
        api = APIClient()
        api.force_authenticate(self.a)
        r = api.get("/api/v1/notifications/")
        self.assertEqual((r.data["unread"], r.data["items"][0]["kind"]), (1, "offer"))
        api.post("/api/v1/notifications/read/")
        self.assertEqual(api.get("/api/v1/notifications/").data["unread"], 0)

    def test_push_without_credentials_is_a_no_op(self):
        DeviceToken.objects.create(user=self.a, token="tok1")
        with mock.patch.object(fcm, "_load", return_value=None), mock.patch.object(fcm.requests, "post") as post:
            fcm.send(self.a.pk, "Hi")
        post.assert_not_called()


@override_settings(NOTIFYKIT_URL="https://nk.test", NOTIFYKIT_API_KEY="nk_test_x", NOTIFYKIT_TIMEOUT=2)
class NotifyKitServiceTests(TestCase):
    def setUp(self):
        notifykit._client = None
        self.svc = notifykit.NotifyKitNotificationService()
        self.a = User.objects.create_user("a@x.com", name="Ann", phone="+919800000011")
        self.b = User.objects.create_user("b@x.com", name="Ben", phone="+919800000012", notifications_on=False)

    def tearDown(self):
        notifykit._client = None

    @staticmethod
    def _resp(status, data=None, error=None):
        r = mock.Mock(status_code=status)
        r.json.return_value = {"success": error is None, "data": data, "error": error}
        return r

    def test_notify_saves_locally_and_pushes_through_notifykit_after_commit(self):
        with mock.patch("requests.Session.request", return_value=self._resp(202, {})) as req, \
                self.captureOnCommitCallbacks(execute=True):
            nid = self.svc.notify(self.a.pk, "Hi", "there", "match")
        self.assertTrue(Notification.objects.filter(pk=nid, user=self.a).exists())
        method, url = req.call_args.args
        kw = req.call_args.kwargs
        self.assertEqual((method, url), ("POST", "https://nk.test/api/v1/notifications"))
        self.assertEqual(kw["json"]["type"], "MATCH")
        self.assertEqual(kw["json"]["channels"], ["PUSH"])
        self.assertEqual(kw["json"]["recipients"], [{"external_user_id": str(self.a.pk)}])
        self.assertEqual(kw["json"]["data"], {"kind": "match", "notification_id": str(nid)})
        self.assertEqual(kw["headers"], {"Idempotency-Key": f"turflet-notification-{nid}"})

    def test_muted_player_gets_in_app_only(self):
        with mock.patch("requests.Session.request") as req, self.captureOnCommitCallbacks(execute=True):
            self.svc.notify(self.b.pk, "Hi")
        req.assert_not_called()
        self.assertEqual(Notification.objects.filter(user=self.b).count(), 1)

    def test_notifykit_down_never_breaks_notify(self):
        import requests as rq
        with mock.patch("requests.Session.request", side_effect=rq.ConnectionError("down")), \
                self.captureOnCommitCallbacks(execute=True):
            nid = self.svc.notify(self.a.pk, "Hi")
        self.assertTrue(Notification.objects.filter(pk=nid).exists())

    def test_device_register_and_unregister_are_mirrored(self):
        with mock.patch("requests.Session.request", return_value=self._resp(201, {"device_id": "dev-1"})) as req:
            self.svc.register_device(self.a.pk, "tok1", "android")
        self.assertEqual(req.call_args.kwargs["json"], {"fcm_token": "tok1", "platform": "ANDROID"})
        self.assertEqual(DeviceToken.objects.get(token="tok1").notifykit_device_id, "dev-1")
        with mock.patch("requests.Session.request", return_value=self._resp(200, {})) as req:
            self.svc.unregister_device("tok1")
        self.assertEqual(req.call_args.args, ("DELETE", f"https://nk.test/api/v1/users/{self.a.pk}/devices/dev-1"))
        self.assertFalse(DeviceToken.objects.exists())

    def test_login_email_goes_through_notifykit_and_falls_back_to_smtp(self):
        from django.core import mail

        from accounts.mailer import send_login_code

        with mock.patch("requests.Session.request", return_value=self._resp(202, {})) as req:
            send_login_code("a@x.com", "654321")
        body = req.call_args.kwargs["json"]
        self.assertEqual((body["type"], body["channels"], body["recipients"][0]["email"]), ("LOGIN_CODE", ["EMAIL"], "a@x.com"))
        self.assertIn("654321", body["html_body"])
        self.assertEqual(len(mail.outbox), 0)

        err = {"code": "INTERNAL", "message": "boom", "request_id": "x"}
        with mock.patch("requests.Session.request", return_value=self._resp(500, error=err)):
            send_login_code("a@x.com", "111222")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("111222", mail.outbox[0].subject)
