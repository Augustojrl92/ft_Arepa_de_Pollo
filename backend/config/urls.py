from django.contrib import admin
from django.urls import include, path
from rest_framework import routers
from core.views import landing, GroupViewSet, UserViewSet

router = routers.DefaultRouter()
router.register(r"users", UserViewSet)
router.register(r"groups", GroupViewSet)

urlpatterns = [
    path("", landing, name="landing"),
    path("", include(router.urls)),
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]
