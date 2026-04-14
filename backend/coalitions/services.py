from django.db.models import Q, Avg, Sum
from django.utils import timezone
from datetime import timedelta

from sync.models import CampusUser, Coalition as SyncedCoalition, CoalitionScoreSnapshot, CampusUserScoreSnapshot, SyncMetadata
from users.models import UserPreferences


SYNC_METADATA_KEY = 'campus_sync'


def _get_scored_users_queryset(coalition_slug=None):
	queryset = CampusUser.objects.exclude(coalition_user_score=0)
	if coalition_slug:
		queryset = queryset.filter(coalition_slug=coalition_slug)
	return queryset


def _get_last_time_update():
	metadata = SyncMetadata.objects.filter(key=SYNC_METADATA_KEY).only('last_time_update').first()
	if metadata is None or metadata.last_time_update is None:
		return None
	return metadata.last_time_update


def _get_rank_change(current_rank, previous_rank):
	if current_rank is None or previous_rank is None:
		return None, None

	delta = previous_rank - current_rank
	if delta > 0:
		return delta, 'up'
	if delta < 0:
		return delta, 'down'
	return 0, 'same'


def _resolve_user_avatar_url(user, request=None):
	django_user = getattr(user, 'django_user', None)
	if django_user is None:
		return user.avatar_url

	preferences = getattr(django_user, 'preferences', None)
	if preferences is None:
		preferences = UserPreferences.objects.filter(user=django_user).only('custom_avatar').first()

	if preferences and preferences.custom_avatar:
		custom_url = preferences.custom_avatar.url
		if request is not None:
			return request.build_absolute_uri(custom_url)
		return custom_url

	return user.avatar_url

def _get_current_coalition_rank(coalition):
	ahead_count = SyncedCoalition.objects.filter(
		Q(total_score__gt=coalition.total_score)
		| Q(total_score=coalition.total_score, name__lt=coalition.name)
	).count()
	return ahead_count + 1

def _get_level_distribution(coalition_slug):
	coalition_users = _get_scored_users_queryset(coalition_slug=coalition_slug)
	average_level = round(coalition_users.aggregate(average_level=Avg('level'))['average_level'] or 0, 2)

	range_counts = {
		'0': 0,
		'1-3': 0,
		'4-6': 0,
		'7-10': 0,
		'+10': 0,
	}

	for level in coalition_users.values_list('level', flat=True):
		if level is None:
			continue

		level_number = int(level)
		if level_number <= 0:
			range_counts['0'] += 1
		elif level_number <= 3:
			range_counts['1-3'] += 1
		elif level_number <= 6:
			range_counts['4-6'] += 1
		elif level_number <= 10:
			range_counts['7-10'] += 1
		else:
			range_counts['+10'] += 1

	return [
		{'range': '0', 'count': range_counts['0']},
		{'range': '1-3', 'count': range_counts['1-3']},
		{'range': '4-6', 'count': range_counts['4-6']},
		{'range': '7-10', 'count': range_counts['7-10']},
		{'range': '+10', 'count': range_counts['+10']},
	], average_level

def _get_score_change(coalition_slug):
	coalition = SyncedCoalition.objects.filter(slug=coalition_slug).first()
	if coalition is None:
		return None, None, None, None, None, None

	today = timezone.localdate()
	previous_day = today - timedelta(days=1)

	def _get_change(days):
		target_date = today - timedelta(days=days)
		reference_snapshot = (
			CoalitionScoreSnapshot.objects.filter(
				coalition=coalition,
				snapshot_date__lte=target_date,
			)
			.order_by('-snapshot_date')
			.first()
		)
		if reference_snapshot is None:
			return None
		return coalition.total_score - reference_snapshot.total_score

	current_rank = _get_current_coalition_rank(coalition)
	previous_snapshot = (
		CoalitionScoreSnapshot.objects.filter(
			coalition=coalition,
			snapshot_date__lte=previous_day,
		)
		.order_by('-snapshot_date')
		.first()
	)
	previous_rank = previous_snapshot.campus_rank if previous_snapshot else None
	rank_change, rank_status = _get_rank_change(current_rank, previous_rank)

	return (
		_get_change(1),
		_get_change(7),
		_get_change(30),
		current_rank,
		rank_change,
		rank_status,
	)

def _get_top_members(coalition_slug, limit=3, request=None):
	all_users = CampusUser.objects.filter(coalition_slug=coalition_slug)
	all_active_users = _get_scored_users_queryset(coalition_slug=coalition_slug)
	top_users = all_active_users.select_related('django_user', 'django_user__preferences').order_by('-coalition_user_score', 'intra_id')[:limit]

	return [
		{
			'login': user.login,
			'display_name': user.display_name,
			'avatar_url': _resolve_user_avatar_url(user, request=request),
			'coalition_points': user.coalition_user_score,
			'intra_level': user.level,
		}
		for user in top_users
	], all_users.count(), all_active_users.count()

def get_coalitions():
	return list(SyncedCoalition.objects.order_by('-total_score', 'name'))

def _serialize_simple_coalitions(coalition_slug=None):
	coalitions = list(SyncedCoalition.objects.order_by('-total_score', 'name')[:4])

	serialized = [
		({
			'id': coalition.id,
			'name': coalition.name,
			'slug': coalition.slug,
			'image_url': coalition.image_url,
			'cover_url': coalition.cover_url,
			'color': coalition.color,
			'score': coalition.total_score,
			'rank': index,
			'member_count': total_members,
			'active_members': active_members,
			'average_level': average_level,
			'evaluations_done_total': evaluations_done_total,
			'evaluations_done_current_season': evaluations_done_current_season,
		})
		for index, coalition in enumerate(coalitions, start=1)
		for _, average_level in [_get_level_distribution(coalition.slug)]
		for _, total_members, active_members in [_get_top_members(coalition.slug)]
		for evaluation_totals in [
			CampusUser.objects.filter(coalition_slug=coalition.slug).aggregate(
				evaluations_done_total=Sum('evaluations_done_total'),
				evaluations_done_current_season=Sum('evaluations_done_current_season'),
			)
		]
		for evaluations_done_total, evaluations_done_current_season in [(
			evaluation_totals['evaluations_done_total'] or 0,
			evaluation_totals['evaluations_done_current_season'] or 0,
		)]
	]

	if coalition_slug is None:
		return serialized

	for coalition in serialized:
		if coalition['slug'] == coalition_slug:
			return coalition

	return None

def _serialize_coalition_details(coalition_slug, request=None):
	coalition = SyncedCoalition.objects.filter(slug=coalition_slug).first()
	
	if coalition is None:
		return None

	level_distribution, average_level = _get_level_distribution(coalition_slug)
	score_change_24, score_change_weekly, score_change_monthly, campus_rank, campus_rank_change, campus_rank_status = _get_score_change(coalition_slug)
	top_members, total_members, active_members = _get_top_members(coalition_slug)
	evaluation_totals = CampusUser.objects.filter(coalition_slug=coalition_slug).aggregate(
		evaluations_done_total=Sum('evaluations_done_total'),
		evaluations_done_current_season=Sum('evaluations_done_current_season'),
	)

	return {
		'level_distribution': level_distribution,
		'average_level': average_level,
		'score_change_24': score_change_24,
		'score_change_weekly': score_change_weekly,
		'score_change_monthly': score_change_monthly,
		'campus_rank': campus_rank,
		'campus_rank_change': campus_rank_change,
		'campus_rank_status': campus_rank_status,
		'top_members': top_members,
		'total_members': total_members,
		'active_members': active_members,
		'evaluations_done_total': evaluation_totals['evaluations_done_total'] or 0,
		'evaluations_done_current_season': evaluation_totals['evaluations_done_current_season'] or 0,
	}

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

	return campus_rank

def _get_user_ranking_queryset(coalition_filter=None):
	queryset = _get_scored_users_queryset()
	if coalition_filter:
		coalition_q = (
			Q(coalition_slug=coalition_filter)
			| Q(coalition_name__iexact=coalition_filter)
		)
		if str(coalition_filter).isdigit():
			coalition_q |= Q(coalition_id=int(coalition_filter))
		queryset = queryset.filter(coalition_q)

	return queryset.order_by('-coalition_user_score', 'intra_id')

def _serialize_user_ranking(coalition_filter=None, page=1, per_page=30, request=None):
	queryset = _get_user_ranking_queryset(coalition_filter)
	total = queryset.count()
	offset = (page - 1) * per_page
	limit = offset + per_page
	users = list(queryset.select_related('django_user', 'django_user__preferences')[offset:limit])
	user_ids = [user.id for user in users]
	previous_day = timezone.localdate() - timedelta(days=1)

	previous_snapshots = (
		CampusUserScoreSnapshot.objects.filter(
			campus_user_id__in=user_ids,
			snapshot_date__lte=previous_day,
		)
		.order_by('campus_user_id', '-snapshot_date')
		.distinct('campus_user_id')
	)
	previous_by_user_id = {snapshot.campus_user_id: snapshot for snapshot in previous_snapshots}

	return {
		'page': page,
		'per_page': per_page,
		'total': total,
		'total_pages': (total + per_page - 1) // per_page if total else 0,
		'users': [
			({
				'rank': offset + index,
			'login': user.login,
			'display_name': user.display_name,
			'avatar_url': _resolve_user_avatar_url(user, request=request),
			'coalition': user.coalition_slug or user.coalition_name or None,
			'coalition_points': user.coalition_user_score,
			'intra_level': user.level,
			'evaluations_done_total': user.evaluations_done_total,
			'evaluations_done_current_season': user.evaluations_done_current_season,
			'campus_rank_change': campus_rank_change,
			'campus_rank_status': campus_rank_status,
			'coalition_rank': user.coalition_rank,
			'coalition_rank_change': coalition_rank_change,
			'coalition_rank_status': coalition_rank_status,
			})
			for index, user in enumerate(users, start=1)
			for previous_snapshot in [previous_by_user_id.get(user.id)]
			for campus_rank_change, campus_rank_status in [_get_rank_change(offset + index, previous_snapshot.campus_user_rank if previous_snapshot else None)]
			for coalition_rank_change, coalition_rank_status in [_get_rank_change(user.coalition_rank, previous_snapshot.coalition_user_rank if previous_snapshot else None)]
		],
	}
