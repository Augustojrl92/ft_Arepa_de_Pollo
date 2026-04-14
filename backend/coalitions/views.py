from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import _serialize_simple_coalitions, _serialize_user_ranking, _serialize_coalition_details, _get_last_time_update

class CoalitionSimpleView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		coalition_slug = request.query_params.get('slug')
		last_time_update = _get_last_time_update()
		last_time_update_iso = last_time_update.isoformat() if last_time_update else None

		if coalition_slug:
			coalition = _serialize_simple_coalitions(coalition_slug=coalition_slug)
			if coalition is None:
				return Response(
					{'error': 'Coalition not found'},
					status=status.HTTP_404_NOT_FOUND,
				)
			return Response({'coalition': coalition, 'last_time_update': last_time_update_iso}, status=status.HTTP_200_OK)

		return Response(
			{'coalitions': _serialize_simple_coalitions(), 'last_time_update': last_time_update_iso},
			status=status.HTTP_200_OK,
		)

class UserRankingView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		coalition_filter = request.query_params.get('coalition')
		try:
			page = max(int(request.query_params.get('page', 1)), 1)
		except (TypeError, ValueError):
			page = 1

		try:
			per_page = max(int(request.query_params.get('per_page', 30)), 1)
		except (TypeError, ValueError):
			per_page = 30

		return Response(
			_serialize_user_ranking(coalition_filter, page=page, per_page=per_page, request=request),
			status=status.HTTP_200_OK,
		)

class CoalitionSingleDetailView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		coalition_slug = request.query_params.get('coalition')

		if not coalition_slug:
			return Response(
				{'error': 'Coalition slug is required'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		coalition_details = _serialize_coalition_details(coalition_slug, request=request)

		if coalition_details is None:
			return Response(
				{'error': 'Coalition not found'},
				status=status.HTTP_404_NOT_FOUND,
			)

		return Response({'coalition': coalition_details}, status=status.HTTP_200_OK)
