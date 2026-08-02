from rest_framework.permissions import BasePermission

from sync.models import CampusUser

GUEST = 'guest'
STUDENT = 'student'
ADMIN = 'admin'

ROLES = (GUEST, STUDENT, ADMIN)


def role_for(user):
	"""Resolve an account's role.

	`admin` is an explicit grant carried by Django's `is_staff` flag, so it can
	be given and revoked from the Django admin without another table to keep in
	step. It is checked first: an administrator is not demoted just because they
	have no campus identity attached.

	`student` versus `guest` is *derived* from whether a `CampusUser` points at
	the account. The link is the entitlement, so deriving it makes the two
	impossible to disagree — there is no stored copy to drift.
	"""
	if not user or not user.is_authenticated:
		return None

	if user.is_staff or user.is_superuser:
		return ADMIN

	if CampusUser.objects.filter(django_user=user).exists():
		return STUDENT

	return GUEST


def is_guest(user):
	return role_for(user) == GUEST


class IsStudentOrAdmin(BasePermission):
	"""Campus data is for students and administrators.

	A guest holds a real account — it can sign in, see that it exists, attach a
	42 identity, or delete itself — but nothing else. That is what makes signing
	up with somebody else's email worthless to an attacker: confirming an email
	proves control of a mailbox, and a mailbox is worth one guest account.
	"""

	message = 'Link your 42 account to access this.'
	code = 'campus_link_required'

	def has_permission(self, request, view):
		return role_for(request.user) in (STUDENT, ADMIN)


class IsAdmin(BasePermission):
	"""Reserved for administrator-only actions.

	Nothing uses it yet — admins currently see exactly what students see — but
	the level exists so those actions have somewhere to hang.
	"""

	message = 'Administrator access required.'
	code = 'admin_required'

	def has_permission(self, request, view):
		return role_for(request.user) == ADMIN
