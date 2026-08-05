from .settings import *

DEBUG = True

EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'mailpit')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 1025))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')

SECURE_CROSS_ORIGIN_OPENER_POLICY = None

# The proxy already redirects 80 -> 443, and leaving Django's own redirect on
# makes `manage.py test` and container health checks bounce on plain HTTP.
SECURE_SSL_REDIRECT = False
