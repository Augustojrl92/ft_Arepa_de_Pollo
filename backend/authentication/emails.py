import os

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .tokens import email_verification_token_generator


def _frontend_url():
	return os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')


def _signed_link(path, user, generator):
	uid = urlsafe_base64_encode(force_bytes(user.pk))
	token = generator.make_token(user)
	return f'{_frontend_url()}{path}?uid={uid}&token={token}'


def _send(subject, message, recipient):
	# fail_silently=False so a broken mail configuration surfaces in the logs
	# instead of leaving users waiting for a link that was never sent.
	send_mail(
		subject=subject,
		message=message,
		from_email=settings.DEFAULT_FROM_EMAIL,
		recipient_list=[recipient],
		fail_silently=False,
	)


def send_verification_email(user):
	link = _signed_link('/verify-email', user, email_verification_token_generator)
	_send(
		'Confirm your AEDLPH account',
		(
			'Welcome to AEDLPH.\n\n'
			'Confirm this email address to activate your account:\n\n'
			f'{link}\n\n'
			'The link expires in 24 hours. If you did not create this account you can ignore this message.\n'
		),
		user.email,
	)


def send_password_reset_email(user):
	link = _signed_link('/reset-password/confirm', user, default_token_generator)
	_send(
		'Reset your AEDLPH password',
		(
			'We received a request to reset your AEDLPH password.\n\n'
			f'{link}\n\n'
			'The link expires in 24 hours. If you did not request this, no action is needed.\n'
		),
		user.email,
	)


def send_existing_account_email(user):
	"""Sent when someone tries to register an address that already has an account.

	The registration endpoint always returns the same generic response, so this
	email is what tells the legitimate owner what happened — and it reaches only
	the address that already controls the account.
	"""
	link = _signed_link('/reset-password/confirm', user, default_token_generator)
	_send(
		'You already have an AEDLPH account',
		(
			'Someone tried to register an account with this email address, but one already exists.\n\n'
			'You can sign in with 42, or set a password here:\n\n'
			f'{link}\n\n'
			'If this was not you, no action is needed — your account was not changed.\n'
		),
		user.email,
	)
