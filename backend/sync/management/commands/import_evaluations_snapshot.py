import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from sync.models import CampusUser


class Command(BaseCommand):
	help = 'Importa un snapshot CSV de correcciones y actualiza los contadores en CampusUser.'

	def add_arguments(self, parser):
		parser.add_argument('--path', required=True)
		parser.add_argument('--dry-run', action='store_true')
		parser.add_argument('--mark-synced', action='store_true')

	def handle(self, *args, **options):
		path = Path(options['path'])
		dry_run = options['dry_run']
		mark_synced = options['mark_synced']

		if not path.exists():
			raise CommandError(f'No existe el archivo CSV: {path}')

		rows_read = 0
		users_updated = 0
		users_missing = 0
		users_to_update = []
		now = timezone.now()

		with path.open('r', newline='', encoding='utf-8') as csv_file:
			reader = csv.DictReader(csv_file)
			required_columns = {
				'intra_id',
				'login',
				'evaluations_done_total',
				'evaluations_done_current_season',
			}
			missing_columns = required_columns.difference(reader.fieldnames or [])
			if missing_columns:
				raise CommandError(
					f'Faltan columnas requeridas en el CSV: {", ".join(sorted(missing_columns))}'
				)

			for row in reader:
				rows_read += 1
				intra_id = row['intra_id'].strip()
				login = row['login'].strip()

				user = None
				if intra_id:
					user = CampusUser.objects.filter(intra_id=int(intra_id)).first()
				if user is None and login:
					user = CampusUser.objects.filter(login=login).first()
				if user is None:
					users_missing += 1
					continue

				total = int(row['evaluations_done_total'] or 0)
				current_season = int(row['evaluations_done_current_season'] or 0)

				has_changed = (
					user.evaluations_done_total != total
					or user.evaluations_done_current_season != current_season
				)
				if not has_changed and not mark_synced:
					continue

				user.evaluations_done_total = total
				user.evaluations_done_current_season = current_season
				if mark_synced:
					user.evaluations_synced_at = now
				users_to_update.append(user)
				users_updated += 1

		if not dry_run and users_to_update:
			fields = ['evaluations_done_total', 'evaluations_done_current_season']
			if mark_synced:
				fields.append('evaluations_synced_at')
			CampusUser.objects.bulk_update(users_to_update, fields)

		mode_label = 'DRY RUN' if dry_run else 'IMPORT'
		self.stdout.write(f'{mode_label} completado')
		self.stdout.write(f'Filas leidas: {rows_read}')
		self.stdout.write(f'Usuarios actualizados: {users_updated}')
		self.stdout.write(f'Usuarios no encontrados: {users_missing}')
