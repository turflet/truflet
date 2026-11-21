from django.apps import AppConfig


class CommunityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "community"
    verbose_name = "Matches"

    def ready(self):
        from payments.checkout import payment_succeeded

        from .services import on_payment_succeeded

        # a UPI checkout that succeeds settles the lobby share / host balance it was for
        payment_succeeded.connect(on_payment_succeeded, dispatch_uid="community.on_payment_succeeded")
