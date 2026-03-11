from django.http import JsonResponse


def server_message(request):
    return JsonResponse({"message": "esto es una respuesta del servidor"})