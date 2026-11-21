from django.apps import AppConfig


class BookingsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bookings'

    def ready(self):
        from payments.checkout import payment_succeeded

        from .services import on_payment_succeeded

        # a UPI checkout that succeeds confirms its booking
        payment_succeeded.connect(on_payment_succeeded, dispatch_uid="bookings.on_payment_succeeded")
