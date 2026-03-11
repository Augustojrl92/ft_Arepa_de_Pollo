from django.http import JsonResponse


def api_root(request):
    return JsonResponse(
        {
            "service": "pollo-backend",
            "status": "ok",
            "available_endpoints": {
                "admin": "/admin/",
                "health": "/api/health/",
                "message": "/api/message/",
            },
        }
    )


def health_check(request):
    return JsonResponse({"status": "ok"})

def server_message(request):
    return JsonResponse({"message": "esto es una respuesta del servidor"})