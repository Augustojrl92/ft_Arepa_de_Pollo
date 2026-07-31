from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
	"""Signed, stateless token for confirming ownership of an email address.

	Nothing is stored server side: the token is an HMAC over SECRET_KEY plus the
	fields below, so it expires with PASSWORD_RESET_TIMEOUT and is invalidated
	as soon as any of them changes.

	`is_active` is part of the hash, which makes the token single use: verifying
	flips the flag and every previously issued link stops validating.

	A distinct `key_salt` keeps these tokens from being interchangeable with the
	password reset tokens produced by Django's `default_token_generator`.
	"""

	key_salt = 'authentication.EmailVerificationTokenGenerator'

	def _make_hash_value(self, user, timestamp):
		return f'{user.pk}{user.password}{user.is_active}{user.email}{timestamp}'


email_verification_token_generator = EmailVerificationTokenGenerator()
