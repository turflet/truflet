from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings


User = get_user_model()


@override_settings(WEB_APP_URL="https://web.example", OTP_DEV_MODE=True)
class LegalPageTests(TestCase):
    def test_old_backend_pages_redirect_to_the_web_app(self):
        for old, new in [("/privacy/", "/privacy"), ("/delete-account/", "/delete-account"),
                         ("/admin-panel/", "/admin"), ("/admin-panel/r/venues/", "/admin/r/venues/")]:
            r = self.client.get(old)
            self.assertEqual(r.status_code, 302)
            self.assertEqual(r["Location"], f"https://web.example{new}")
        self.assertEqual(self.client.get("/api/v1/config/").json()["privacy_url"], "https://web.example/privacy")

    def test_legal_info_hides_placeholder_phone(self):
        r = self.client.get("/api/v1/legal/").json()
        self.assertIn("privacy_updated", r)
        self.assertNotEqual(r["phone"], "+918000000000")

    def test_account_deletion_flow(self):
        from accounts.models import AccountDeletionRequest, EmailOTP
        User.objects.create_user(email="leaver@example.com")
        self.assertEqual(self.client.post("/api/v1/account-deletion/code/", {"email": "nobody@example.com"}).status_code, 400)
        self.assertEqual(self.client.post("/api/v1/account-deletion/code/", {"email": "Leaver@Example.com"}).status_code, 200)
        bad = self.client.post("/api/v1/account-deletion/confirm/", {"email": "leaver@example.com", "code": "000000"})
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post("/api/v1/account-deletion/confirm/", {"email": "leaver@example.com", "code": "123456", "reason": "moving"})
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertTrue(AccountDeletionRequest.objects.filter(email="leaver@example.com", status="pending", reason="moving").exists())
