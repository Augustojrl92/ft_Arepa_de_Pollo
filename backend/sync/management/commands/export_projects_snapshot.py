import csv

from django.core.management.base import BaseCommand

from sync.models import CampusUser


# Objective:
# Export delivered-project counters from `CampusUser` into a CSV snapshot.
# Expects:
# - CLI option `--path` with the output file path.
# Returns:
# - Writes the CSV file and prints the exported row count.
class Command(BaseCommand):
	help = 'Exporta un snapshot CSV de proyectos entregados.'

	def add_arguments(self, parser):
		parser.add_argument('--path', default='projects_delivered_snapshot.csv')

	def handle(self, *args, **options):
		path = options['path']
		rows = CampusUser.objects.exclude(login='').order_by('id').values_list(
			'login',
			'intra_id',
			'user_id',
			'coalition_name',
			'projects_delivered_total',
			'projects_delivered_current_season',
			'projects_delivered_synced_at',
		)

		count = 0
		with open(path, 'w', newline='', encoding='utf-8') as csv_file:
			writer = csv.writer(csv_file)
			writer.writerow([
				'login',
				'intra_id',
				'user_id',
				'coalition_name',
				'projects_delivered_total',
				'projects_delivered_current_season',
				'projects_delivered_synced_at',
			])
			for row in rows:
				writer.writerow(row)
				count += 1

		self.stdout.write(f'Snapshot de proyectos exportado: {path}')
		self.stdout.write(f'Usuarios exportados: {count}')
