from .settings import *

DEBUG = True

# Verification and reset emails are printed to the container logs in development.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
