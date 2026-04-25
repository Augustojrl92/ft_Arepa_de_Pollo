# """
# ASGI config for config project.

# It exposes the ASGI callable as a module-level variable named ``application``.

# For more information on this file, see
# https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
# """

import os

from channels.routing import ProtocolTypeRouter, URLRouter
# from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application
from authentication.websocket import CookieJWTAuthMiddleware
from games.routing import websocket_urlpatterns as games_ws
from chat.routing import websocket_urlpatterns as chat_ws

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

django_asgi_app = get_asgi_application()

# from chat.routing import websocket_urlpatterns
# from authentication.channel_auth import JWTAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": CookieJWTAuthMiddleware(
        URLRouter(
            games_ws + chat_ws
        )
    ),
})
