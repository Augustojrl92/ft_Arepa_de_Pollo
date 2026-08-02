from .settings import *

DEBUG = True

# Development delivers through Mailpit (the `mailpit` compose service): a real
# SMTP conversation, but every message is captured and shown at
# http://localhost:8025 instead of being delivered. No MTA, no third-party
# account, and nothing leaves the machine.
#
# Every value stays overridable from .env — set
# EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend to fall back to
# printing emails in the container logs.
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'mailpit')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 1025))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')

# Django sends Cross-Origin-Opener-Policy: same-origin by default. Browsers
# ignore it on origins that are not "potentially trustworthy" — anything served
# over plain HTTP that is not localhost — and log a console warning saying so.
# LAN testing hits exactly that case, and the project requires a clean console,
# so the header is dropped in development only. Production serves HTTPS and
# keeps the default.
SECURE_CROSS_ORIGIN_OPENER_POLICY = None
