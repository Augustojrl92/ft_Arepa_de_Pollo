"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

django_asgi_application = get_asgi_application()

from authentication.websocket import CookieJWTAuthMiddleware
from games.routing import websocket_urlpatterns


application = ProtocolTypeRouter({
	'http': django_asgi_application,
	'websocket': AllowedHostsOriginValidator(
		CookieJWTAuthMiddleware(URLRouter(websocket_urlpatterns))
	),
})
