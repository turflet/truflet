from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from . import checkout


@csrf_exempt
@require_POST
def youpi_webhook(request):
    """Signed server-to-server callback from YOUPI. The HMAC is checked over the raw, unparsed body."""
    status, detail = checkout.handle_webhook(request.body, request.headers.get("X-Gateway-Signature", ""))
    return JsonResponse({"received": status == 200, "detail": detail}, status=status)
