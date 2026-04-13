import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_datetime

from sync.models import CampusUser


REQUIRED_COLUMNS = {
	'intra_id',
	'projects_delivered_total',
	'projects_delivered_current_season',
}


def _parse_int(value, field_name, line_number):
	try:
		return int(value)
	except (TypeError, ValueError) as exc:
		raise CommandError(f'Valor invalido para {field_name} en linea {line_number}: {value!r}') from exc


# Objective:
# Import delivered-project counters from a CSV snapshot into existing `CampusUser` rows.
# Expects:
# - CLI option `--path` with a CSV containing at least intra_id and project counter columns.
# - Optional `--dry-run` to validate the file without writing to the database.
# Returns:
# - Updates existing users and prints import counters.
class Command(BaseCommand):
	help = 'Importa un snapshot CSV de proyectos entregados.'

	def add_arguments(self, parser):
		parser.add_argument('--path', required=True)
		parser.add_argument('--dry-run', action='store_true')

	def handle(self, *args, **options):
		path = Path(options['path'])
		dry_run = options['dry_run']

		if not path.exists():
			raise CommandError(f'No existe el archivo CSV: {path}')

		updated = 0
		unchanged = 0
		missing = 0
		processed = 0

		with path.open(newline='', encoding='utf-8') as csv_file:
			reader = csv.DictReader(csv_file)
			fieldnames = set(reader.fieldnames or [])
			missing_columns = REQUIRED_COLUMNS - fieldnames
			if missing_columns:
				raise CommandError(f'Faltan columnas requeridas: {", ".join(sorted(missing_columns))}')

			for line_number, row in enumerate(reader, start=2):
				processed += 1
				intra_id = _parse_int(row.get('intra_id'), 'intra_id', line_number)
				total = _parse_int(row.get('projects_delivered_total'), 'projects_delivered_total', line_number)
				current_season = _parse_int(
					row.get('projects_delivered_current_season'),
					'projects_delivered_current_season',
					line_number,
				)
				synced_at = parse_datetime(row.get('projects_delivered_synced_at') or '')

				try:
					user = CampusUser.objects.get(intra_id=intra_id)
				except CampusUser.DoesNotExist:
					missing += 1
					continue

				fields_to_update = []
				if user.projects_delivered_total != total:
					user.projects_delivered_total = total
					fields_to_update.append('projects_delivered_total')
				if user.projects_delivered_current_season != current_season:
					user.projects_delivered_current_season = current_season
					fields_to_update.append('projects_delivered_current_season')
				if synced_at and user.projects_delivered_synced_at != synced_at:
					user.projects_delivered_synced_at = synced_at
					fields_to_update.append('projects_delivered_synced_at')

				if not fields_to_update:
					unchanged += 1
					continue

				updated += 1
				if not dry_run:
					user.save(update_fields=fields_to_update)

		mode = 'dry-run' if dry_run else 'aplicado'
		self.stdout.write(f'Import de proyectos completado ({mode})')
		self.stdout.write(f'Filas procesadas: {processed}')
		self.stdout.write(f'Usuarios actualizados: {updated}')
		self.stdout.write(f'Usuarios sin cambios: {unchanged}')
		self.stdout.write(f'Usuarios no encontrados: {missing}')
