from django.http import JsonResponse
from django.contrib.auth.models import Group, User
from rest_framework import permissions, viewsets
from core.serializer import GroupSerializer, UserSerializer

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

class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]


class GroupViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows groups to be viewed or edited.
    """

    queryset = Group.objects.all().order_by("name")
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]