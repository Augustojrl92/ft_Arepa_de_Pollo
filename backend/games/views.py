from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GameMatch
from .events import broadcast_game_event
from .services import GameError, create_invitation, resolve_invitation, serialize_match, submit_move


def _error_response(error):
	return Response({'error': error.message}, status=error.http_status)


def _get_match(match_id, user):
	return (
		GameMatch.objects
		.select_related('inviter', 'opponent', 'winner', 'inviter__campus_user_profile', 'opponent__campus_user_profile')
		.prefetch_related('rounds')
		.filter(Q(inviter=user) | Q(opponent=user), pk=match_id)
		.first()
	)


class MatchListView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		matches = (
			GameMatch.objects
			.select_related('inviter', 'opponent', 'winner', 'inviter__campus_user_profile', 'opponent__campus_user_profile')
			.prefetch_related('rounds')
			.filter(Q(inviter=request.user) | Q(opponent=request.user))[:30]
		)
		serialized = [serialize_match(match, request.user, request=request) for match in matches]
		return Response({
			'incoming': [item for item in serialized if item['status'] == 'pending' and item['role'] == 'opponent'],
			'outgoing': [item for item in serialized if item['status'] == 'pending' and item['role'] == 'inviter'],
			'active': [item for item in serialized if item['status'] == 'active'],
			'recent': [item for item in serialized if item['status'] in {'completed', 'declined', 'cancelled'}][:10],
		})

	def post(self, request):
		try:
			match = create_invitation(request.user, request.data.get('opponent_login'), request.data.get('target_score', 3))
		except GameError as error:
			return _error_response(error)
		match = _get_match(match.id, request.user)
		broadcast_game_event(match, 'invitation.created')
		return Response(serialize_match(match, request.user, request=request), status=status.HTTP_201_CREATED)


class MatchDetailView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request, match_id):
		match = _get_match(match_id, request.user)
		if not match:
			return Response({'error': 'Match not found'}, status=status.HTTP_404_NOT_FOUND)
		return Response(serialize_match(match, request.user, request=request))

	def patch(self, request, match_id):
		try:
			match = resolve_invitation(match_id, request.user, request.data.get('action'))
		except GameError as error:
			return _error_response(error)
		match = _get_match(match.id, request.user)
		event_name = {
			'accept': 'invitation.accepted',
			'decline': 'invitation.declined',
			'cancel': 'invitation.cancelled',
			'forfeit': 'match.forfeited',
		}.get(request.data.get('action'), 'match.updated')
		broadcast_game_event(match, event_name)
		return Response(serialize_match(match, request.user, request=request))


class MatchMoveView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request, match_id):
		try:
			match = submit_move(match_id, request.user, request.data.get('choice'))
		except GameError as error:
			return _error_response(error)
		match = _get_match(match.id, request.user)
		broadcast_game_event(match, 'match.move_submitted')
		return Response(serialize_match(match, request.user, request=request))


class MatchRematchView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request, match_id):
		match = _get_match(match_id, request.user)
		if not match:
			return Response({'error': 'Match not found'}, status=status.HTTP_404_NOT_FOUND)
		if match.status != GameMatch.Status.COMPLETED:
			return Response({'error': 'Only completed matches can have a rematch'}, status=status.HTTP_409_CONFLICT)
		opponent = match.opponent if request.user.id == match.inviter_id else match.inviter
		profile = getattr(opponent, 'campus_user_profile', None)
		try:
			new_match = create_invitation(request.user, profile.login if profile else opponent.username, match.target_score)
		except GameError as error:
			return _error_response(error)
		new_match = _get_match(new_match.id, request.user)
		broadcast_game_event(new_match, 'rematch.created')
		return Response(serialize_match(new_match, request.user, request=request), status=status.HTTP_201_CREATED)
