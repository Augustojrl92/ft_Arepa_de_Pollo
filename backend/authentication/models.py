"""Authentication app uses Django's built-in User model as source of truth."""

from django.conf import settings
from django.db import models


class RegistrationInvite(models.Model):
	"""Authorises one email address to register with a password.

	Registration normally matches the submitted email against the campus roster
	synced from 42. This covers the cases the roster cannot: a student whose
	intra email is empty in the sync, or who wants to use a different address.

	The invite always names a campus login, so every account created through it
	still resolves to a `CampusUser` and gets a complete profile.
	"""

	email = models.EmailField(max_length=255, unique=True)
	campus_login = models.CharField(max_length=255, help_text='CampusUser.login this invite grants access to.')
	note = models.CharField(max_length=255, blank=True)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='registration_invites_created',
	)
	created_at = models.DateTimeField(auto_now_add=True)
	used_at = models.DateTimeField(null=True, blank=True)

	def save(self, *args, **kwargs):
		self.email = (self.email or '').strip().lower()
		return super().save(*args, **kwargs)

	def __str__(self):
		state = 'used' if self.used_at else 'pending'
		return f'{self.email} -> {self.campus_login} ({state})'
