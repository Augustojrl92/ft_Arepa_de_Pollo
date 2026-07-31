import re

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from sync.models import CampusUser

from .models import RegistrationInvite

VALID_PASSWORD = 'Coalition-Arepa-77'
LINK_RE = re.compile(r'uid=(?P<uid>[^&\s]+)&token=(?P<token>[^\s]+)')


def extract_link_params(message):
	match = LINK_RE.search(message.body)
	assert match is not None, f'no signed link found in email body:\n{message.body}'
	return match.group('uid'), match.group('token')


class EmailAuthTestCase(APITestCase):
	"""Covers the email/password provider end to end.

	The important property under test is that none of this touches 42: every
	request below authenticates against a password stored and verified locally.
	"""

	def setUp(self):
		# Throttle state lives in the cache and would leak between tests.
		cache.clear()
		mail.outbox = []

		now = timezone.now()
		self.campus_user = CampusUser.objects.create(
			intra_id=42001,
			user_id=42001,
			login='jdoe',
			email='jdoe@student.42madrid.com',
			display_name='Jane Doe',
			created_at=now,
			updated_at=now,
		)

	def register(self, email, password=VALID_PASSWORD, confirm=None):
		return self.client.post(
			reverse('auth-register'),
			{'email': email, 'password': password, 'password_confirm': confirm or password},
			format='json',
		)

	def verify_from_email(self):
		uid, token = extract_link_params(mail.outbox[-1])
		return self.client.post(reverse('auth-verify-email'), {'uid': uid, 'token': token}, format='json')

	def login(self, email, password=VALID_PASSWORD):
		return self.client.post(reverse('auth-login'), {'email': email, 'password': password}, format='json')

	# --- registration ---------------------------------------------------------

	def test_register_creates_inactive_user_linked_to_campus_identity(self):
		response = self.register('jdoe@student.42madrid.com')
		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

		user = User.objects.get(email='jdoe@student.42madrid.com')
		self.assertFalse(user.is_active)
		# Username is the 42 login, which is what makes a later OAuth login
		# converge on this same row instead of creating a duplicate account.
		self.assertEqual(user.username, 'jdoe')

		self.campus_user.refresh_from_db()
		self.assertEqual(self.campus_user.django_user_id, user.pk)
		self.assertEqual(len(mail.outbox), 1)

	def test_password_is_hashed_with_argon2_and_salted(self):
		self.register('jdoe@student.42madrid.com')
		user = User.objects.get(email='jdoe@student.42madrid.com')

		self.assertTrue(user.password.startswith('argon2$argon2id$'))
		self.assertNotIn(VALID_PASSWORD, user.password)
		self.assertTrue(user.check_password(VALID_PASSWORD))

		other = User.objects.create_user(username='other', password=VALID_PASSWORD)
		self.assertNotEqual(user.password, other.password, 'identical passwords must not share a hash')

	def test_register_with_ineligible_email_is_indistinguishable(self):
		eligible = self.register('jdoe@student.42madrid.com')
		mail.outbox = []
		ineligible = self.register('stranger@example.com')

		self.assertEqual(ineligible.status_code, eligible.status_code)
		self.assertEqual(ineligible.data['detail'], eligible.data['detail'])
		self.assertFalse(User.objects.filter(email='stranger@example.com').exists())
		self.assertEqual(len(mail.outbox), 0)

	def test_register_rejects_weak_password(self):
		response = self.register('jdoe@student.42madrid.com', password='1234')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('password', response.data)
		self.assertFalse(User.objects.filter(email='jdoe@student.42madrid.com').exists())

	def test_register_rejects_mismatched_confirmation(self):
		response = self.register('jdoe@student.42madrid.com', confirm='Something-Else-99')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('password_confirm', response.data)

	def test_register_never_modifies_an_existing_account(self):
		existing = User.objects.create_user(
			username='jdoe',
			email='jdoe@student.42madrid.com',
			password='Original-Password-11',
		)
		mail.outbox = []

		response = self.register('jdoe@student.42madrid.com')
		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

		existing.refresh_from_db()
		self.assertTrue(existing.check_password('Original-Password-11'))
		self.assertTrue(existing.is_active)
		self.assertEqual(len(mail.outbox), 1)

	def test_registration_invite_grants_access_for_another_address(self):
		RegistrationInvite.objects.create(email='Jane@Personal.Com', campus_login='jdoe')

		response = self.register('jane@personal.com')
		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

		user = User.objects.get(email='jane@personal.com')
		self.assertEqual(user.username, 'jdoe')
		RegistrationInvite.objects.get(email='jane@personal.com', used_at__isnull=False)

	# --- verification and login ----------------------------------------------

	def test_full_cold_signup_and_login_without_oauth(self):
		self.register('jdoe@student.42madrid.com')

		verified = self.verify_from_email()
		self.assertEqual(verified.status_code, status.HTTP_200_OK)
		self.assertIn('access_token', verified.cookies)
		self.assertIn('refresh_token', verified.cookies)

		self.client.cookies.clear()
		logged_in = self.login('jdoe@student.42madrid.com')
		self.assertEqual(logged_in.status_code, status.HTTP_200_OK)
		self.assertIn('access_token', logged_in.cookies)

	def test_verification_link_is_single_use(self):
		self.register('jdoe@student.42madrid.com')
		uid, token = extract_link_params(mail.outbox[-1])

		first = self.client.post(reverse('auth-verify-email'), {'uid': uid, 'token': token}, format='json')
		self.assertEqual(first.status_code, status.HTTP_200_OK)

		replayed = self.client.post(reverse('auth-verify-email'), {'uid': uid, 'token': token}, format='json')
		self.assertEqual(replayed.status_code, status.HTTP_400_BAD_REQUEST)

	def test_login_is_blocked_until_email_is_verified(self):
		self.register('jdoe@student.42madrid.com')

		response = self.login('jdoe@student.42madrid.com')
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(response.data['code'], 'email_not_verified')

	def test_login_failures_do_not_reveal_whether_the_account_exists(self):
		self.register('jdoe@student.42madrid.com')
		self.verify_from_email()
		self.client.cookies.clear()

		wrong_password = self.login('jdoe@student.42madrid.com', password='Not-The-Password-9')
		unknown_email = self.login('nobody@example.com', password='Not-The-Password-9')

		self.assertEqual(wrong_password.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertEqual(unknown_email.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertEqual(wrong_password.data['error'], unknown_email.data['error'])

	def test_login_is_rate_limited(self):
		statuses = {self.login('nobody@example.com', password='Wrong-Password-1').status_code for _ in range(15)}
		self.assertIn(status.HTTP_429_TOO_MANY_REQUESTS, statuses)

	def test_profile_is_complete_for_a_password_account(self):
		self.register('jdoe@student.42madrid.com')
		self.verify_from_email()

		profile = self.client.get(reverse('user-profile'))
		self.assertEqual(profile.status_code, status.HTTP_200_OK)
		self.assertEqual(profile.data['login'], 'jdoe')
		self.assertEqual(profile.data['intra_id'], 42001)

	# --- password reset and change -------------------------------------------

	def test_password_reset_round_trip(self):
		self.register('jdoe@student.42madrid.com')
		self.verify_from_email()
		self.client.cookies.clear()
		mail.outbox = []

		requested = self.client.post(
			reverse('auth-password-reset'),
			{'email': 'jdoe@student.42madrid.com'},
			format='json',
		)
		self.assertEqual(requested.status_code, status.HTTP_202_ACCEPTED)
		self.assertEqual(len(mail.outbox), 1)

		uid, token = extract_link_params(mail.outbox[-1])
		confirmed = self.client.post(
			reverse('auth-password-reset-confirm'),
			{
				'uid': uid,
				'token': token,
				'new_password': 'Brand-New-Secret-8',
				'new_password_confirm': 'Brand-New-Secret-8',
			},
			format='json',
		)
		self.assertEqual(confirmed.status_code, status.HTTP_200_OK)

		self.client.cookies.clear()
		self.assertEqual(self.login('jdoe@student.42madrid.com', 'Brand-New-Secret-8').status_code, status.HTTP_200_OK)

	def test_password_reset_for_unknown_email_stays_generic(self):
		response = self.client.post(
			reverse('auth-password-reset'),
			{'email': 'nobody@example.com'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
		self.assertEqual(len(mail.outbox), 0)

	def test_oauth_account_can_add_a_password_then_sign_in_with_it(self):
		# Mirrors an account created by the 42 callback: no usable password.
		oauth_user = User.objects.create(username='jdoe', email='jdoe@student.42madrid.com')
		oauth_user.set_unusable_password()
		oauth_user.save()
		self.client.force_authenticate(user=oauth_user)

		response = self.client.post(
			reverse('auth-password-set'),
			{'new_password': VALID_PASSWORD, 'new_password_confirm': VALID_PASSWORD},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)

		self.client.force_authenticate(user=None)
		self.client.cookies.clear()
		self.assertEqual(self.login('jdoe@student.42madrid.com').status_code, status.HTTP_200_OK)

	# --- session revocation ---------------------------------------------------

	def test_logout_revokes_the_refresh_token(self):
		self.register('jdoe@student.42madrid.com')
		self.verify_from_email()
		refresh_token = self.client.cookies['refresh_token'].value

		self.assertEqual(self.client.post(reverse('auth-logout')).status_code, status.HTTP_200_OK)

		# The cookies are gone from this browser, but the point is that the
		# token itself no longer works even when replayed directly.
		replayed = self.client.post(
			reverse('token-refresh'),
			{'refresh': refresh_token},
			format='json',
		)
		self.assertEqual(replayed.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_refresh_rotates_and_burns_the_previous_token(self):
		self.register('jdoe@student.42madrid.com')
		self.verify_from_email()
		original = self.client.cookies['refresh_token'].value

		rotated = self.client.post(reverse('token-refresh'), {'refresh': original}, format='json')
		self.assertEqual(rotated.status_code, status.HTTP_200_OK)
		self.assertNotEqual(self.client.cookies['refresh_token'].value, original)

		reused = self.client.post(reverse('token-refresh'), {'refresh': original}, format='json')
		self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_password_change_revokes_sessions_on_other_devices(self):
		self.register('jdoe@student.42madrid.com')
		self.verify_from_email()
		other_device_token = self.client.cookies['refresh_token'].value

		user = User.objects.get(email='jdoe@student.42madrid.com')
		self.client.force_authenticate(user=user)
		changed = self.client.post(
			reverse('auth-password-set'),
			{
				'current_password': VALID_PASSWORD,
				'new_password': 'Brand-New-Secret-8',
				'new_password_confirm': 'Brand-New-Secret-8',
			},
			format='json',
		)
		self.assertEqual(changed.status_code, status.HTTP_200_OK)

		self.client.force_authenticate(user=None)
		stale = self.client.post(reverse('token-refresh'), {'refresh': other_device_token}, format='json')
		self.assertEqual(stale.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_changing_an_existing_password_requires_the_current_one(self):
		user = User.objects.create_user(
			username='jdoe',
			email='jdoe@student.42madrid.com',
			password='Original-Password-11',
		)
		self.client.force_authenticate(user=user)

		rejected = self.client.post(
			reverse('auth-password-set'),
			{
				'current_password': 'wrong',
				'new_password': VALID_PASSWORD,
				'new_password_confirm': VALID_PASSWORD,
			},
			format='json',
		)
		self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('current_password', rejected.data)

		accepted = self.client.post(
			reverse('auth-password-set'),
			{
				'current_password': 'Original-Password-11',
				'new_password': VALID_PASSWORD,
				'new_password_confirm': VALID_PASSWORD,
			},
			format='json',
		)
		self.assertEqual(accepted.status_code, status.HTTP_200_OK)
