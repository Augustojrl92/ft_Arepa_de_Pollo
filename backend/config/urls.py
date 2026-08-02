"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import path, include

from .views import api_root, health_check, server_message, status_check
from authentication import urls as auth_urls
from coalitions import urls as coalition_urls
from users import urls as user_urls
<<<<<<< HEAD
from games import urls as game_urls
=======
from chat import urls as chat_urls
>>>>>>> 5cbbf09 (feat: chat service with chats persistence at #ggc45)

urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    path('api/status/', status_check, name='status-check'),
    path('api/message/', server_message, name='server-message'),
    path('api/auth/', include(auth_urls)),
    path('api/coalitions/', include(coalition_urls)),
    path('api/users/', include(user_urls)),
    path('api/games/', include(game_urls)),
    path('api/chat/', include(chat_urls)),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
