from sync.models import Coalition as SyncedCoalition


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
