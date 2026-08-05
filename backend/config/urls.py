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
import re

from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.views import serve as staticfiles_serve
from django.urls import path, re_path, include
from django.views.static import serve as media_serve

from .views import api_root, server_message
from authentication import urls as auth_urls
from coalitions import urls as coalition_urls
from users import urls as user_urls
from games import urls as game_urls
from chat import urls as chat_urls

urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/message/', server_message, name='server-message'),
    path('api/auth/', include(auth_urls)),
    path('api/coalitions/', include(coalition_urls)),
    path('api/users/', include(user_urls)),
    path('api/games/', include(game_urls)),
    path('api/chat/', include(chat_urls)),
]

# Django's usual shortcuts here — staticfiles_urlpatterns() / static() — both
# hard-code a DEBUG check *inside* the view itself (raising Http404, or in
# static()'s case silently registering nothing at all), because Django's own
# docs frame them as debug-server-only conveniences. There is no separate
# static file server in this architecture, though — nginx forwards /static/
# and /media/ straight to this backend (see nginx.conf) in both dev and prod
# — so both are wired up directly against the underlying views, bypassing
# that guard on purpose. This is what keeps user-uploaded avatars and the
# admin UI working once DEBUG=False.
urlpatterns += [
    re_path(
        r'^%s(?P<path>.*)$' % re.escape(settings.STATIC_URL.lstrip('/')),
        staticfiles_serve,
        kwargs={'insecure': True},
    ),
    re_path(
        r'^%s(?P<path>.*)$' % re.escape(settings.MEDIA_URL.lstrip('/')),
        media_serve,
        kwargs={'document_root': settings.MEDIA_ROOT},
    ),
]
