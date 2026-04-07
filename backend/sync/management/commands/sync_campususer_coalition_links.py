from django.core.management.base import BaseCommand

from sync.models import CampusUser
from sync.services import _build_sync_context, fetch_coalitions_data


# Objective:
# Backfill local coalition link fields from `/v2/coalitions_users` without reloading the whole campus users dataset.
# Expects:
# - Optional request pacing through the CLI.
# Returns:
# - Prints a summary with fetched coalition-user rows and updated CampusUser rows.
class Command(BaseCommand):
	help = 'Sincroniza coalitions_user_id y datos de coalicion para CampusUser usando solo coalitions_users.'

	# Objective:
	# Declare the CLI arguments supported by this command.
	# Expects:
	# - Django's argument parser for management commands.
	# Returns:
	# - No explicit return value; it mutates the parser in place.
	def add_arguments(self, parser):
		parser.add_argument('--request-interval', type=float, default=0.25)

	# Objective:
	# Fetch coalition-user rows from 42 and update the matching local CampusUser records.
	# Expects:
	# - Parsed CLI options coming from `add_arguments`.
	# Returns:
	# - No explicit return value; writes a summary to stdout.
	def handle(self, *args, **options):
		request_interval = options['request_interval']
		ctx = _build_sync_context()
		coalition_info = fetch_coalitions_data(ctx=ctx, request_interval=request_interval)
		coalition_data_by_user_id = coalition_info['coalition_data_by_user_id']

		users = list(CampusUser.objects.filter(intra_id__in=coalition_data_by_user_id.keys()).order_by('id'))
		updated_users = []

		for user in users:
			coalition_data = coalition_data_by_user_id.get(user.intra_id)
			if not coalition_data:
				continue

			user.coalitions_user_id = coalition_data.get('coalitions_user_id')
			user.coalition_id = coalition_data.get('coalition_id')
			user.coalition_name = coalition_data.get('coalition_name', '')
			user.coalition_slug = coalition_data.get('coalition_slug', '')
			user.coalition_user_score = coalition_data.get('coalition_score', 0)
			user.coalition_rank = coalition_data.get('coalition_rank')
			updated_users.append(user)

		if updated_users:
			CampusUser.objects.bulk_update(
				updated_users,
				[
					'coalitions_user_id',
					'coalition_id',
					'coalition_name',
					'coalition_slug',
					'coalition_user_score',
					'coalition_rank',
				],
			)

		self.stdout.write('Sincronizacion de coalition links completada')
		self.stdout.write(f'Coalitions users obtenidos: {len(coalition_info["coalitions_users"])}')
		self.stdout.write(f'CampusUser actualizados: {len(updated_users)}')
