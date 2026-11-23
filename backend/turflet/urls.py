from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView


from accounts import api as accounts
from bookings import api as bookings
from community import api as community
from core import api as core
from core import views as core_pages
from dashboard import api as dash
from notifications import api as notifications
from payments import api as payments_api
from venues import api as venues

api = [
    # auth & profile
    path("auth/otp/request/", accounts.otp_request),
    path("auth/otp/verify/", accounts.otp_verify),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("me/", accounts.me),
    path("me/sports/", accounts.my_sports),
    # content
    path("config/", core.app_config),
    path("faqs/", core.faqs),
    path("policies/", core.policies),
    path("legal/", core.legal),
    path("account-deletion/code/", core.deletion_code),
    path("account-deletion/confirm/", core.deletion_confirm),
    path("notifications/", notifications.notifications),
    path("notifications/read/", notifications.notifications_read),
    path("devices/", notifications.devices),
    path("devices/remove/", notifications.devices_remove),
    path("support/tickets/", core.tickets),
    # venues
    path("cities/", venues.cities),
    path("locate/", venues.locate),
    path("sports/", venues.sports),
    path("venues/", venues.venue_list),
    path("venues/saved/", venues.saved),
    path("seo/venues/", venues.seo_venues),
    path("venues/<int:pk>/", venues.venue_detail),
    path("venues/<int:pk>/availability/", venues.availability),
    path("venues/<int:pk>/save/", venues.toggle_save),
    path("venues/<int:pk>/review/", venues.review),
    # bookings
    path("coupons/validate/", bookings.validate_coupon),
    path("bookings/", bookings.bookings),
    path("bookings/<int:pk>/", bookings.booking_detail),
    path("bookings/<int:pk>/coupon/", bookings.apply_coupon),
    path("bookings/<int:pk>/pay/", bookings.pay),
    path("bookings/<int:pk>/payment/", bookings.payment_status),
    # payment gateway callbacks (server-to-server, signed)
    path("payments/youpi/webhook/", payments_api.youpi_webhook),
    path("bookings/<int:pk>/cancel/", bookings.cancel),
    path("bookings/<int:pk>/reschedule/", bookings.reschedule),
    # matches (lobbies)
    path("amenities/", venues.amenities),
    path("lobbies/", community.lobbies),
    path("lobbies/mine/", community.my_lobbies),
    path("lobbies/players/", community.players_lookup),
    path("lobbies/<int:pk>/", community.lobby_view),
    path("lobbies/<int:pk>/request/", community.lobby_request),
    path("lobbies/<int:pk>/messages/", community.lobby_messages),
    path("lobbies/<int:pk>/pay/", community.lobby_pay),
    path("lobbies/<int:pk>/payment/", community.lobby_payment),
    path("lobbies/<int:pk>/requests/", community.lobby_requests),
    path("lobbies/<int:pk>/requests/<int:rid>/", community.request_detail),
    path("lobbies/<int:pk>/requests/<int:rid>/messages/", community.request_messages),
    path("lobbies/<int:pk>/requests/<int:rid>/<str:action>/", community.request_decide),
    path("lobbies/<int:pk>/members/<int:member_id>/remove/", community.lobby_remove_member),
    path("lobbies/<int:pk>/<str:action>/", community.lobby_action),
    path("venues/<int:pk>/lobbies/", community.venue_lobbies),
    # admin dashboard API (React admin at web/src/admin); admins + turf owners, JWT auth
    path("admin/meta/", dash.meta),
    path("admin/home/", dash.home),
    path("admin/search/", dash.search),
    path("admin/checkin/", dash.checkin),
    path("admin/settings/", dash.settings_view),
    path("admin/broadcast/", dash.broadcast),
    path("admin/venues/<int:pk>/", dash.venue_detail),
    path("admin/venues/<int:pk>/photos/", dash.venue_photos),
    path("admin/venues/<int:pk>/photos/<int:photo_id>/", dash.venue_photo_delete),
    path("admin/venues/<int:pk>/board/", dash.availability),
    path("admin/bookings/<int:pk>/", dash.booking_detail),
    path("admin/bookings/<int:pk>/<str:action>/", dash.booking_action),
    path("admin/users/<int:pk>/", dash.user_detail),
    path("admin/users/<int:pk>/wallet/", dash.user_wallet),
    path("admin/r/<slug:slug>/", dash.crud_list),
    path("admin/r/<slug:slug>/schema/", dash.crud_schema),
    path("admin/r/<slug:slug>/<int:pk>/", dash.crud_detail),
    path("admin/r/<slug:slug>/<int:pk>/toggle/<str:field>/", dash.crud_toggle),
]

urlpatterns = [
    path("api/v1/", include(api)),
    # pages that moved to the React web app — redirect so existing links keep working
    path("", core_pages.to_web("/")),
    path("privacy/", core_pages.to_web("/privacy")),
    path("privacy-policy/", core_pages.to_web("/privacy")),
    path("delete-account/", core_pages.to_web("/delete-account")),
    path("admin-panel/", core_pages.to_web("/admin")),
    path("admin-panel/<path:rest>", core_pages.to_web("/admin/")),
    path("django-admin/", admin.site.urls),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
