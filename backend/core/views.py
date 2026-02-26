from django.http import JsonResponse


# Vista raíz del backend.
# Se usa para comprobar rápidamente que el servicio Django está levantado.
def landing(_request):
    # Devuelve un JSON simple con estado 200 (OK).
    return JsonResponse({"message": "backend django base ok"}, status=200)


# Endpoint de healthcheck.
# Lo usan Docker y pruebas manuales para validar disponibilidad del backend.
def health(_request):
    # Respuesta mínima estándar para indicar que el servicio está sano.
    return JsonResponse({"status": "ok"}, status=200)
