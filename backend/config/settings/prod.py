from .settings import *

DEBUG = False

# Production delivers real email; the console backend would leak verification
# links to stdout instead of sending them.
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
