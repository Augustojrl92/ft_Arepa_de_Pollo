from .settings import *

DEBUG = True
# The proxy already redirects 80 -> 443, and leaving Django's own redirect on
# makes `manage.py test` and container health checks bounce on plain HTTP.
SECURE_SSL_REDIRECT = False
