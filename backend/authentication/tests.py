import re
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from sync.models import CampusUser

from .permissions import ADMIN, GUEST, STUDENT, role_for

VALID_PASSWORD = 'Coalition-Arepa-77'
GUEST_EMAIL = 'someone@example.com'
LINK_RE = re.compile(r'uid=(?P<uid>[^&\s]+)&token=(?P<token>[^\s]+)')


def extract_link_params(message):
	match = LINK_RE.search(message.body)
	assert match is not None, f'no signed link found in email body:\n{message.body}'
	return match.group('uid'), match.group('token')


class AuthTestCase(APITestCase):
	"""Two credential providers and two access levels.

	Signing up with an email and a password never touches 42, and produces a
	**guest**: a real account that can reach nothing. Confirming an email proves
	control of a mailbox, which is worth exactly one guest account — so signing
	up with somebody else's address gains an attacker nothing.

	Authorising with 42 is what attaches a campus identity and unlocks campus
	data. It is an entitlement step, not the way you sign in.
	"""

	def setUp(self):
		# Throttle state lives in the cache and would leak between tests.
		cache.clear()
		mail.outbox = []

		now = timezone.now()
		self.campus_user = CampusUser.objects.create(
			intra_id=42001, user_id=42001, login='jdoe',
			email='jdoe@student.42madrid.com', display_name='Jane Doe',
			created_at=now, updated_at=now,
		)
		self.other_campus_user = CampusUser.objects.create(
			intra_id=42002, user_id=42002, login='asmith',
			email='asmith@student.42madrid.com', display_name='Alex Smith',
			created_at=now, updated_at=now,
		)

	# --- helpers --------------------------------------------------------------

	def register(self, email=GUEST_EMAIL, password=VALID_PASSWORD, confirm=None):
		return self.client.post(
			reverse('auth-register'),
			{'email': email, 'password': password, 'password_confirm': confirm or password},
			format='json',
		)

	def confirm_from_email(self):
		uid, token = extract_link_params(mail.outbox[-1])
		return self.client.post(reverse('auth-verify-email'), {'uid': uid, 'token': token}, format='json')

	def signup_guest(self, email=GUEST_EMAIL, password=VALID_PASSWORD):
		self.register(email, password)
		self.confirm_from_email()
		return User.objects.get(email=email)

	def login(self, email=GUEST_EMAIL, password=VALID_PASSWORD):
		return self.client.post(reverse('auth-login'), {'email': email, 'password': password}, format='json')

	def _mock_42(self, mock_post, mock_get, campus_user=None):
		campus_user = campus_user or self.campus_user

		token_response = Mock(status_code=200)
		token_response.json.return_value = {'access_token': 'stub-token'}
		mock_post.return_value = token_response

		me_response = Mock(status_code=200)
		me_response.json.return_value = {
			'id': campus_user.intra_id,
			'login': campus_user.login,
			'email': campus_user.email,
			'displayname': campus_user.display_name,
			'campus': [{'id': 22, 'name': 'Madrid'}],
			'cursus_users': [],
		}
		mock_get.return_value = me_response

	def _callback(self, purpose, link_user=None, campus_user=None):
		session = self.client.session
		session['oauth42_state'] = 'stub-state'
		session['oauth42_purpose'] = purpose
		if link_user is not None:
			session['link_user_id'] = link_user.pk
		session.save()
		return self.client.get(reverse('oauth42-callback'), {'code': 'stub', 'state': 'stub-state'})

	def link_42(self, mock_post, mock_get, user, campus_user=None):
		self._mock_42(mock_post, mock_get, campus_user)
		return self._callback('link', link_user=user)

	# --- guest lifecycle ------------------------------------------------------

	def test_registration_creates_an_unconfirmed_guest_with_no_campus_link(self):
		response = self.register()
		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

		user = User.objects.get(email=GUEST_EMAIL)
		self.assertFalse(user.is_active)
		# Stored under the email, which contains "@" and so can never collide
		# with a 42 login.
		self.assertEqual(user.username, GUEST_EMAIL)
		self.assertFalse(CampusUser.objects.filter(django_user=user).exists())
		self.assertEqual(len(mail.outbox), 1)

	def test_login_is_blocked_until_the_email_is_confirmed(self):
		self.register()
		response = self.login()
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(response.data['code'], 'email_not_verified')

	def test_confirming_signs_in_as_a_guest(self):
		self.register()
		confirmed = self.confirm_from_email()

		self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
		self.assertIn('access_token', confirmed.cookies)
		self.assertEqual(role_for(User.objects.get(email=GUEST_EMAIL)), GUEST)

	def test_guest_profile_is_a_shell_not_a_404(self):
		self.signup_guest()

		profile = self.client.get(reverse('user-profile'))
		self.assertEqual(profile.status_code, status.HTTP_200_OK)
		self.assertEqual(profile.data['role'], GUEST)
		self.assertNotIn('intra_id', profile.data)

	def test_guest_cannot_reach_campus_data(self):
		"""The property that makes registering with any email harmless."""
		self.signup_guest()

		for name, params in (
			('user-details', {'login': 'jdoe'}),
			('user-points-history', {'login': 'jdoe'}),
			('friends-me', {}),
		):
			with self.subTest(endpoint=name):
				response = self.client.get(reverse(name), params)
				self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_guest_can_delete_its_own_account(self):
		user = self.signup_guest()
		mail.outbox = []

		response = self.client.delete(reverse('auth-account-delete'))
		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(User.objects.filter(pk=user.pk).exists())

		self.assertEqual(len(mail.outbox), 1)
		self.assertEqual(mail.outbox[0].to, [GUEST_EMAIL])
		self.assertIn('deleted', mail.outbox[0].subject.lower())

	@patch('authentication.views.send_account_deleted_email', side_effect=RuntimeError('smtp down'))
	def test_deletion_still_succeeds_when_the_confirmation_email_fails(self, _mock_send):
		"""The owner asked for the account to go; a mail failure must not undo it."""
		user = self.signup_guest()

		response = self.client.delete(reverse('auth-account-delete'))
		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(User.objects.filter(pk=user.pk).exists())

	# --- roles ----------------------------------------------------------------

	def test_admin_is_an_explicit_grant_that_outranks_the_campus_link(self):
		"""Admins currently see what students see; the level exists regardless."""
		user = self.signup_guest()
		self.assertEqual(role_for(user), GUEST)

		user.is_staff = True
		user.save(update_fields=['is_staff'])

		self.assertEqual(role_for(user), ADMIN)
		# Not demoted for lacking a campus identity, and campus data is reachable.
		self.assertFalse(CampusUser.objects.filter(django_user=user).exists())
		self.assertEqual(
			self.client.get(reverse('user-details'), {'login': 'jdoe'}).status_code,
			status.HTTP_200_OK,
		)

	def test_profile_reports_the_role(self):
		self.signup_guest()
		self.assertEqual(self.client.get(reverse('user-profile')).data['role'], GUEST)

	# --- upgrading to campus --------------------------------------------------

	@patch('authentication.views.requests.get')
	@patch('authentication.views.requests.post')
	def test_linking_42_upgrades_a_guest_and_unlocks_campus_data(self, mock_post, mock_get):
		user = self.signup_guest()
		self.assertEqual(role_for(user), GUEST)

		self.link_42(mock_post, mock_get, user)

		user.refresh_from_db()
		self.assertEqual(role_for(user), STUDENT)
		# The rest of the app keys off username, so the proven login is adopted.
		self.assertEqual(user.username, 'jdoe')
		self.campus_user.refresh_from_db()
		self.assertEqual(self.campus_user.django_user_id, user.pk)

		profile = self.client.get(reverse('user-profile'))
		self.assertEqual(profile.data['role'], STUDENT)
		self.assertEqual(profile.data['intra_id'], 42001)

		self.assertEqual(
			self.client.get(reverse('user-details'), {'login': 'jdoe'}).status_code,
			status.HTTP_200_OK,
		)

	@patch('authentication.views.requests.get')
	@patch('authentication.views.requests.post')
	def test_a_campus_identity_cannot_be_linked_twice(self, mock_post, mock_get):
		first = self.signup_guest('first@example.com')
		self.link_42(mock_post, mock_get, first)
		self.client.cookies.clear()

		second = self.signup_guest('second@example.com')
		response = self.link_42(mock_post, mock_get, second)

		self.assertIn('campus_identity_already_linked', response.url)
		second.refresh_from_db()
		self.assertEqual(role_for(second), GUEST)

	@patch('authentication.views.requests.get')
	@patch('authentication.views.requests.post')
	def test_login_still_works_after_linking(self, mock_post, mock_get):
		user = self.signup_guest()
		self.link_42(mock_post, mock_get, user)
		self.client.cookies.clear()

		self.assertEqual(self.login().status_code, status.HTTP_200_OK)

	@patch('authentication.views.requests.get')
	@patch('authentication.views.requests.post')
	def test_42_login_never_overwrites_the_email_you_signed_up_with(self, mock_post, mock_get):
		"""Password login looks accounts up by email.

		Adopting 42's profile address here would silently change the handle its
		owner signs in with, locking them out of their own account.
		"""
		user = self.signup_guest('personal@example.com')
		self.link_42(mock_post, mock_get, user)
		self.client.cookies.clear()

		# Now sign in through 42, which reports a different address.
		self._mock_42(mock_post, mock_get)
		self._callback('login')

		user.refresh_from_db()
		self.assertEqual(user.email, 'personal@example.com')

		self.client.cookies.clear()
		self.assertEqual(self.login('personal@example.com').status_code, status.HTTP_200_OK)

	@patch('authentication.views.requests.get')
	@patch('authentication.views.requests.post')
	def test_42_login_fills_in_the_email_when_the_account_has_none(self, mock_post, mock_get):
		self._mock_42(mock_post, mock_get)
		self._callback('login')

		self.assertEqual(User.objects.get(username='jdoe').email, 'jdoe@student.42madrid.com')

	# --- credentials ----------------------------------------------------------

	def test_password_is_hashed_with_argon2_and_salted(self):
		user = self.signup_guest()

		self.assertTrue(user.password.startswith('argon2$argon2id$'))
		self.assertNotIn(VALID_PASSWORD, user.password)

		other = User.objects.create_user(username='other', password=VALID_PASSWORD)
		self.assertNotEqual(user.password, other.password, 'identical passwords must not share a hash')

	def test_weak_password_is_rejected_by_the_backend(self):
		response = self.register(password='1234')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('password', response.data)
		self.assertFalse(User.objects.exists())

	def test_mismatched_confirmation_is_rejected(self):
		response = self.register(confirm='Something-Else-99')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('password_confirm', response.data)

	def test_registering_an_existing_email_never_modifies_the_account(self):
		user = self.signup_guest()
		mail.outbox = []

		response = self.register(GUEST_EMAIL, password='Different-Password-9')
		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

		user.refresh_from_db()
		self.assertTrue(user.check_password(VALID_PASSWORD))
		self.assertEqual(len(mail.outbox), 1)

	# --- signing in -----------------------------------------------------------

	@patch('authentication.views.requests.get')
	@patch('authentication.views.requests.post')
	def test_login_uses_no_42_request_at_all(self, mock_post, mock_get):
		self.signup_guest()
		self.client.cookies.clear()

		response = self.login()

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		mock_post.assert_not_called()
		mock_get.assert_not_called()

	def test_login_failures_do_not_reveal_whether_the_account_exists(self):
		self.signup_guest()
		self.client.cookies.clear()

		wrong_password = self.login(GUEST_EMAIL, password='Not-The-Password-9')
		unknown_email = self.login('nobody@example.com', password='Not-The-Password-9')

		self.assertEqual(wrong_password.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertEqual(unknown_email.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertEqual(wrong_password.data['error'], unknown_email.data['error'])

	def test_login_is_rate_limited(self):
		statuses = {self.login('nobody@example.com', 'Wrong-Password-1').status_code for _ in range(15)}
		self.assertIn(status.HTTP_429_TOO_MANY_REQUESTS, statuses)

	# --- the 42 sign-in path --------------------------------------------------

	@patch('authentication.views.requests.get')
	@patch('authentication.views.requests.post')
	def test_42_login_records_a_missing_password_as_unusable(self, mock_post, mock_get):
		"""get_or_create leaves password='', which Django reports as *usable*."""
		self._mock_42(mock_post, mock_get)
		self._callback('login')

		user = User.objects.get(username='jdoe')
		self.assertNotEqual(user.password, '')
		self.assertFalse(user.has_usable_password())

	@patch('authentication.views.requests.get')
	@patch('authentication.views.requests.post')
	def test_42_account_can_add_a_password_then_sign_in_with_it(self, mock_post, mock_get):
		self._mock_42(mock_post, mock_get)
		self._callback('login')
		user = User.objects.get(username='jdoe')

		self.client.force_authenticate(user=user)
		response = self.client.post(
			reverse('auth-password-set'),
			{'new_password': VALID_PASSWORD, 'new_password_confirm': VALID_PASSWORD},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)

		self.client.force_authenticate(user=None)
		self.client.cookies.clear()
		self.assertEqual(self.login('jdoe@student.42madrid.com').status_code, status.HTTP_200_OK)

	def test_changing_an_existing_password_requires_the_current_one(self):
		user = User.objects.create_user(
			username='jdoe', email='jdoe@student.42madrid.com', password='Original-Password-11',
		)
		self.client.force_authenticate(user=user)

		rejected = self.client.post(
			reverse('auth-password-set'),
			{'current_password': 'wrong', 'new_password': VALID_PASSWORD, 'new_password_confirm': VALID_PASSWORD},
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

	# --- password reset -------------------------------------------------------

	def test_password_reset_round_trip(self):
		self.signup_guest()
		self.client.cookies.clear()
		mail.outbox = []

		requested = self.client.post(reverse('auth-password-reset'), {'email': GUEST_EMAIL}, format='json')
		self.assertEqual(requested.status_code, status.HTTP_202_ACCEPTED)
		self.assertEqual(len(mail.outbox), 1)

		uid, token = extract_link_params(mail.outbox[-1])
		confirmed = self.client.post(
			reverse('auth-password-reset-confirm'),
			{
				'uid': uid, 'token': token,
				'new_password': 'Brand-New-Secret-8', 'new_password_confirm': 'Brand-New-Secret-8',
			},
			format='json',
		)
		self.assertEqual(confirmed.status_code, status.HTTP_200_OK)

		self.client.cookies.clear()
		self.assertEqual(self.login(GUEST_EMAIL, 'Brand-New-Secret-8').status_code, status.HTTP_200_OK)

	def test_password_reset_for_unknown_email_stays_generic(self):
		response = self.client.post(
			reverse('auth-password-reset'), {'email': 'nobody@example.com'}, format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
		self.assertEqual(len(mail.outbox), 0)

	# --- session revocation ---------------------------------------------------

	def test_logout_revokes_the_refresh_token(self):
		self.signup_guest()
		refresh_token = self.client.cookies['refresh_token'].value

		self.assertEqual(self.client.post(reverse('auth-logout')).status_code, status.HTTP_200_OK)

		replayed = self.client.post(reverse('token-refresh'), {'refresh': refresh_token}, format='json')
		self.assertEqual(replayed.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_refresh_rotates_and_burns_the_previous_token(self):
		self.signup_guest()
		original = self.client.cookies['refresh_token'].value

		rotated = self.client.post(reverse('token-refresh'), {'refresh': original}, format='json')
		self.assertEqual(rotated.status_code, status.HTTP_200_OK)
		self.assertNotEqual(self.client.cookies['refresh_token'].value, original)

		reused = self.client.post(reverse('token-refresh'), {'refresh': original}, format='json')
		self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_password_change_revokes_sessions_on_other_devices(self):
		user = self.signup_guest()
		other_device_token = self.client.cookies['refresh_token'].value

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
