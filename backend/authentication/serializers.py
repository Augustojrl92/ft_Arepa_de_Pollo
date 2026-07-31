from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


def _normalize_email(value):
	return (value or '').strip().lower()


class _PasswordPairMixin:
	"""Shared confirm-match check and Django validator plumbing.

	Running `validate_password` here is what makes the backend the real
	authority: the same rules configured in AUTH_PASSWORD_VALIDATORS apply
	whether the request came from our form or from curl.
	"""

	password_field = 'password'
	confirm_field = 'password_confirm'

	def _validate_password_pair(self, attrs, user=None):
		password = attrs.get(self.password_field)
		confirm = attrs.get(self.confirm_field)

		if password != confirm:
			raise serializers.ValidationError({self.confirm_field: 'Passwords do not match.'})

		try:
			validate_password(password, user=user)
		except DjangoValidationError as error:
			raise serializers.ValidationError({self.password_field: list(error.messages)})

		return attrs


class RegisterSerializer(serializers.Serializer, _PasswordPairMixin):
	email = serializers.EmailField(max_length=255)
	password = serializers.CharField(write_only=True, max_length=128)
	password_confirm = serializers.CharField(write_only=True, max_length=128)

	def validate_email(self, value):
		return _normalize_email(value)

	def validate(self, attrs):
		# Unsaved instance so UserAttributeSimilarityValidator can compare the
		# password against the email the user just typed.
		probe = User(email=attrs.get('email', ''), username=attrs.get('email', ''))
		return self._validate_password_pair(attrs, user=probe)


class LoginSerializer(serializers.Serializer):
	email = serializers.EmailField(max_length=255)
	password = serializers.CharField(write_only=True, max_length=128)

	def validate_email(self, value):
		return _normalize_email(value)


class VerifyEmailSerializer(serializers.Serializer):
	uid = serializers.CharField(max_length=64)
	token = serializers.CharField(max_length=128)


class PasswordResetRequestSerializer(serializers.Serializer):
	email = serializers.EmailField(max_length=255)

	def validate_email(self, value):
		return _normalize_email(value)


class PasswordResetConfirmSerializer(serializers.Serializer, _PasswordPairMixin):
	password_field = 'new_password'
	confirm_field = 'new_password_confirm'

	uid = serializers.CharField(max_length=64)
	token = serializers.CharField(max_length=128)
	new_password = serializers.CharField(write_only=True, max_length=128)
	new_password_confirm = serializers.CharField(write_only=True, max_length=128)

	def validate(self, attrs):
		return self._validate_password_pair(attrs, user=self.context.get('user'))


class SetPasswordSerializer(serializers.Serializer, _PasswordPairMixin):
	password_field = 'new_password'
	confirm_field = 'new_password_confirm'

	current_password = serializers.CharField(write_only=True, max_length=128, required=False, allow_blank=True)
	new_password = serializers.CharField(write_only=True, max_length=128)
	new_password_confirm = serializers.CharField(write_only=True, max_length=128)

	def validate(self, attrs):
		user = self.context['user']

		# Accounts created through 42 have no password yet, so the first time
		# there is nothing to confirm. Once one exists, changing it requires it.
		if user.has_usable_password():
			current = attrs.get('current_password') or ''
			if not user.check_password(current):
				raise serializers.ValidationError({'current_password': 'Current password is incorrect.'})

		return self._validate_password_pair(attrs, user=user)
