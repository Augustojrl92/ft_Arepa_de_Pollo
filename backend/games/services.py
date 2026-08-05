from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from sync.models import CampusUser
from users.models import FriendsList

from .models import GameMatch, GameRound


VALID_CHOICES = {choice for choice, _label in GameRound.CHOICES}
WINNING_RELATIONS = {
	('scissors', 'paper'): 'corta',
	('paper', 'rock'): 'cubre',
	('rock', 'lizard'): 'aplasta',
	('lizard', 'spock'): 'envenena',
	('spock', 'scissors'): 'rompe',
	('scissors', 'lizard'): 'decapita',
	('lizard', 'paper'): 'se come',
	('paper', 'spock'): 'refuta',
	('spock', 'rock'): 'vaporiza',
	('rock', 'scissors'): 'aplasta',
}


class GameError(Exception):
	def __init__(self, message, http_status=400):
		super().__init__(message)
		self.message = message
		self.http_status = http_status


def _user_identity(user, request=None):
	profile = getattr(user, 'campus_user_profile', None)
	preferences = getattr(user, 'preferences', None)
	avatar_url = ''
	if preferences and preferences.custom_avatar:
		avatar_url = preferences.custom_avatar.url
		if request:
			avatar_url = request.build_absolute_uri(avatar_url)
	elif profile:
		avatar_url = profile.avatar_url

	return {
		'user_id': user.id,
		'login': profile.login if profile else user.username,
		'display_name': profile.display_name if profile and profile.display_name else user.username,
		'avatar_url': avatar_url,
	}


def _find_user(login):
	if not isinstance(login, str) or not login.strip():
		raise GameError('Opponent login is required')
	login = login.strip()
	profile = CampusUser.objects.select_related('django_user').filter(login=login).first()
	if profile and profile.django_user:
		return profile.django_user
	user = get_user_model().objects.filter(username=login).first()
	if not user:
		raise GameError('Opponent not found', 404)
	return user


def _are_friends(first_user, second_user):
	friend_list, _created = FriendsList.objects.get_or_create(owner=first_user)
	return friend_list.friends.filter(owner=second_user).exists()


def _ensure_participant(match, user):
	if user.id not in {match.inviter_id, match.opponent_id}:
		raise GameError('You are not a participant in this match', 403)


def _has_open_match(first_user, second_user):
	return GameMatch.objects.filter(
		Q(inviter=first_user, opponent=second_user) | Q(inviter=second_user, opponent=first_user),
		status__in=[GameMatch.Status.PENDING, GameMatch.Status.ACTIVE],
	).exists()


def get_busy_user_ids(user_ids):
	user_ids = set(user_ids)
	if not user_ids:
		return set()
	active_matches = GameMatch.objects.filter(status=GameMatch.Status.ACTIVE).filter(
		Q(inviter_id__in=user_ids) | Q(opponent_id__in=user_ids)
	).values_list('inviter_id', 'opponent_id')
	return {
		user_id
		for participants in active_matches
		for user_id in participants
		if user_id in user_ids
	}


def create_invitation(user, opponent_login, target_score=3):
	opponent = _find_user(opponent_login)
	if opponent.id == user.id:
		raise GameError('You cannot invite yourself')
	if not _are_friends(user, opponent):
		raise GameError('You can only invite friends', 403)
	try:
		target_score = int(target_score)
	except (TypeError, ValueError):
		raise GameError('Target score must be 3 or 5')
	if target_score not in {3, 5}:
		raise GameError('Target score must be 3 or 5')
	if _has_open_match(user, opponent):
		raise GameError('There is already an open match between these players', 409)
	return GameMatch.objects.create(inviter=user, opponent=opponent, target_score=target_score)


@transaction.atomic
def resolve_invitation(match_id, user, action):
	match = GameMatch.objects.select_for_update().select_related('inviter', 'opponent').filter(pk=match_id).first()
	if not match:
		raise GameError('Match not found', 404)
	_ensure_participant(match, user)
	if action == 'forfeit':
		if match.status != GameMatch.Status.ACTIVE:
			raise GameError('Only active matches can be forfeited', 409)
		match.status = GameMatch.Status.COMPLETED
		match.winner = match.opponent if user.id == match.inviter_id else match.inviter
		match.completed_at = timezone.now()
		match.save(update_fields=['status', 'winner', 'completed_at', 'updated_at'])
		return match

	if match.status != GameMatch.Status.PENDING:
		raise GameError('This invitation is no longer pending', 409)

	if action == 'accept':
		if user.id != match.opponent_id:
			raise GameError('Only the invited player can accept', 403)
		participant_ids = {match.inviter_id, match.opponent_id}
		list(
			get_user_model().objects.select_for_update()
			.filter(pk__in=participant_ids)
			.order_by('pk')
		)
		busy_user_ids = get_busy_user_ids(participant_ids)
		if match.opponent_id in busy_user_ids:
			raise GameError('Ya estas en una partida activa', 409)
		if match.inviter_id in busy_user_ids:
			raise GameError('El jugador que te invito ya esta en una partida activa', 409)
		match.status = GameMatch.Status.ACTIVE
		match.accepted_at = timezone.now()
		match.save(update_fields=['status', 'accepted_at', 'updated_at'])
		GameRound.objects.create(match=match, number=1)
	elif action == 'decline':
		if user.id != match.opponent_id:
			raise GameError('Only the invited player can decline', 403)
		match.status = GameMatch.Status.DECLINED
		match.save(update_fields=['status', 'updated_at'])
	elif action == 'cancel':
		if user.id != match.inviter_id:
			raise GameError('Only the inviting player can cancel', 403)
		match.status = GameMatch.Status.CANCELLED
		match.save(update_fields=['status', 'updated_at'])
	else:
		raise GameError('Action must be accept, decline, cancel or forfeit')
	return match


def _resolve_choices(first, second):
	if first == second:
		return None, 'iguala'
	if (first, second) in WINNING_RELATIONS:
		return 'inviter', WINNING_RELATIONS[(first, second)]
	return 'opponent', WINNING_RELATIONS[(second, first)]


@transaction.atomic
def submit_move(match_id, user, choice):
	if choice not in VALID_CHOICES:
		raise GameError('Invalid choice')
	match = GameMatch.objects.select_for_update().select_related('inviter', 'opponent').filter(pk=match_id).first()
	if not match:
		raise GameError('Match not found', 404)
	_ensure_participant(match, user)
	if match.status != GameMatch.Status.ACTIVE:
		raise GameError('This match is not active', 409)

	round_item = match.rounds.select_for_update().filter(resolved_at__isnull=True).first()
	if not round_item:
		raise GameError('No open round is available', 409)
	field = 'inviter_choice' if user.id == match.inviter_id else 'opponent_choice'
	if getattr(round_item, field):
		raise GameError('You already submitted a choice for this round', 409)
	setattr(round_item, field, choice)
	round_item.save(update_fields=[field])

	if not round_item.inviter_choice or not round_item.opponent_choice:
		return match

	winner_side, verb = _resolve_choices(round_item.inviter_choice, round_item.opponent_choice)
	round_item.verb = verb
	round_item.resolved_at = timezone.now()
	if winner_side == 'inviter':
		round_item.winner = match.inviter
		match.inviter_score += 1
	elif winner_side == 'opponent':
		round_item.winner = match.opponent
		match.opponent_score += 1
	round_item.save(update_fields=['winner', 'verb', 'resolved_at'])

	if match.inviter_score >= match.target_score or match.opponent_score >= match.target_score:
		match.status = GameMatch.Status.COMPLETED
		match.winner = match.inviter if match.inviter_score > match.opponent_score else match.opponent
		match.completed_at = timezone.now()
		match.save(update_fields=['inviter_score', 'opponent_score', 'status', 'winner', 'completed_at', 'updated_at'])

		winner_user = match.winner
		campus_profile = getattr(winner_user, 'campus_user_profile', None)
		if campus_profile is not None:
			campus_profile.today_rps_wins += 1
			campus_profile.save(update_fields=['today_rps_wins'])

	else:
		match.save(update_fields=['inviter_score', 'opponent_score', 'updated_at'])
		GameRound.objects.create(match=match, number=round_item.number + 1)
	return match


def serialize_match(match, user, request=None, busy_user_ids=None):
	_ensure_participant(match, user)
	if busy_user_ids is None:
		busy_user_ids = get_busy_user_ids({match.inviter_id, match.opponent_id})
	is_inviter = user.id == match.inviter_id
	resolved_rounds = []
	current_round = None
	for round_item in match.rounds.all():
		if round_item.resolved_at:
			resolved_rounds.append({
				'number': round_item.number,
				'inviter_choice': round_item.inviter_choice,
				'opponent_choice': round_item.opponent_choice,
				'winner_user_id': round_item.winner_id,
				'verb': round_item.verb,
			})
		else:
			my_choice = round_item.inviter_choice if is_inviter else round_item.opponent_choice
			opponent_choice = round_item.opponent_choice if is_inviter else round_item.inviter_choice
			current_round = {
				'number': round_item.number,
				'choice_submitted': bool(my_choice),
				'opponent_choice_submitted': bool(opponent_choice),
			}

	return {
		'id': match.id,
		'status': match.status,
		'target_score': match.target_score,
		'inviter': _user_identity(match.inviter, request=request),
		'opponent': _user_identity(match.opponent, request=request),
		'inviter_score': match.inviter_score,
		'opponent_score': match.opponent_score,
		'winner_user_id': match.winner_id,
		'role': 'inviter' if is_inviter else 'opponent',
		'inviter_busy': match.inviter_id in busy_user_ids,
		'opponent_busy': match.opponent_id in busy_user_ids,
		'current_round': current_round,
		'rounds': list(reversed(resolved_rounds)),
		'created_at': match.created_at.isoformat(),
		'updated_at': match.updated_at.isoformat(),
	}
