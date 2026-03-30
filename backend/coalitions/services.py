from django.db.models import Q

from sync.models import CampusUser, Coalition as SyncedCoalition


def get_coalitions():
	return list(SyncedCoalition.objects.order_by('-total_score', 'name'))

def _serialize_coalition_leaderboard():
	return [
		{
			'name': coalition.name,
			'total_points': coalition.total_score,
		}
		for coalition in get_coalitions()
	]

def _serialize_simple_coalitions(coalition_slug=None):
	coalitions = list(SyncedCoalition.objects.order_by('-total_score', 'name')[:4])

	serialized = [
		{
			'id': coalition.id,
			'name': coalition.name,
			'slug': coalition.slug,
			'image_url': coalition.image_url,
			'cover_url': coalition.cover_url,
			'color': coalition.color,
			'score': coalition.total_score,
			'rank': index,
		}
		for index, coalition in enumerate(coalitions, start=1)
	]

	if coalition_slug is None:
		return serialized

	for coalition in serialized:
		if coalition['slug'] == coalition_slug:
			return coalition

	return None


def _get_sync_user_ranks(sync_user):
	if sync_user is None:
		return None, None

	score = sync_user.coalition_user_score or 0
	intra_id = sync_user.intra_id
	base_qs = CampusUser.objects.filter(is_active=True)

	ahead_global = base_qs.filter(
		Q(coalition_user_score__gt=score)
		| Q(coalition_user_score=score, intra_id__lt=intra_id)
	).count()
	campus_rank = ahead_global + 1

	coalition_rank = None
	if sync_user.coalition_id is not None:
		coalition_qs = base_qs.filter(coalition_id=sync_user.coalition_id)
		coalition_rank = coalition_qs.filter(
			Q(coalition_user_score__gt=score)
			| Q(coalition_user_score=score, intra_id__lt=intra_id)
		).count() + 1
	elif sync_user.coalition_name:
		coalition_qs = base_qs.filter(coalition_name=sync_user.coalition_name)
		coalition_rank = coalition_qs.filter(
			Q(coalition_user_score__gt=score)
			| Q(coalition_user_score=score, intra_id__lt=intra_id)
		).count() + 1
	elif sync_user.coalition_slug:
		coalition_qs = base_qs.filter(coalition_slug=sync_user.coalition_slug)
		coalition_rank = coalition_qs.filter(
			Q(coalition_user_score__gt=score)
			| Q(coalition_user_score=score, intra_id__lt=intra_id)
		).count() + 1

	return campus_rank, coalition_rank


def _get_user_ranking_queryset(coalition_filter=None):
	queryset = CampusUser.objects.filter(is_active=True)

	if coalition_filter:
		coalition_q = (
			Q(coalition_slug=coalition_filter)
			| Q(coalition_name__iexact=coalition_filter)
		)
		if str(coalition_filter).isdigit():
			coalition_q |= Q(coalition_id=int(coalition_filter))
		queryset = queryset.filter(coalition_q)

	return queryset.order_by('-coalition_user_score', 'intra_id')


def _serialize_user_ranking(coalition_filter=None):
	users = list(_get_user_ranking_queryset(coalition_filter))

	return [
		{
			'rank': index,
			'login': user.login,
			'display_name': user.display_name,
			'avatar_url': user.avatar_url,
			'coalition': user.coalition_slug or user.coalition_name or None,
			'coalition_points': user.coalition_user_score,
			'intra_level': user.level,
		}
		for index, user in enumerate(users, start=1)
	]
