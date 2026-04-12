from django.core.management.base import BaseCommand

from sync.models import CampusUser
from sync.projects import sync_users_projects_delivered


# Objective:
# Provide a management command to sync approved delivered-project counters from 42 into `CampusUser`.
# Expects:
# - CLI options controlling request pacing, batch size, offset, and auto-batch mode.
# Returns:
# - Prints a processing summary to stdout after the sync finishes.
class Command(BaseCommand):
	help = 'Sincroniza el numero de proyectos entregados y aprobados para CampusUser.'

	# Objective:
	# Declare the CLI arguments supported by this command.
	# Expects:
	# - Django's argument parser for management commands.
	# Returns:
	# - No explicit return value; it mutates the parser in place.
	def add_arguments(self, parser):
		parser.add_argument('--request-interval', type=float, default=0.6)
		parser.add_argument('--limit', type=int, default=100)
		parser.add_argument('--offset', type=int, default=0)
		parser.add_argument('--auto-batch', action='store_true')
		parser.add_argument('--max-batches', type=int, default=None)

	# Objective:
	# Execute the delivered-project sync for one slice or for the whole dataset in automatic batches.
	# Expects:
	# - Parsed CLI options coming from `add_arguments`.
	# Returns:
	# - No explicit return value; writes progress and summary information to stdout.
	def handle(self, *args, **options):
		request_interval = options['request_interval']
		limit = options['limit']
		offset = options['offset']
		auto_batch = options['auto_batch']
		max_batches = options['max_batches']

		base_queryset = CampusUser.objects.exclude(login='').order_by('id')

		if auto_batch:
			batches_run = 0
			total_processed = 0
			total_updated = 0
			executed_batches = 0
			current_offset = offset

			while True:
				if max_batches is not None and batches_run >= max_batches:
					break

				batch = list(base_queryset[current_offset:current_offset + limit])
				if not batch:
					break

				executed_batches += 1
				result = sync_users_projects_delivered(
					queryset=batch,
					request_interval=request_interval,
				)
				total_processed += result['processed']
				total_updated += result['updated']

				self.stdout.write(
					f'Bloque {executed_batches} | offset {current_offset} | procesados {result["processed"]} | actualizados {result["updated"]} | acumulado {total_processed}'
				)

				current_offset += limit
				batches_run += 1

			self.stdout.write('Sincronizacion de proyectos completada')
			self.stdout.write(f'Usuarios procesados: {total_processed}')
			self.stdout.write(f'Usuarios actualizados: {total_updated}')
			self.stdout.write(f'Bloques ejecutados: {executed_batches}')
			self.stdout.write(f'Tamano de bloque: {limit}')
			return

		queryset = base_queryset[offset:offset + limit]
		result = sync_users_projects_delivered(
			queryset=queryset,
			request_interval=request_interval,
		)

		self.stdout.write('Sincronizacion de proyectos completada')
		self.stdout.write(f'Usuarios procesados: {result["processed"]}')
		self.stdout.write(f'Usuarios actualizados: {result["updated"]}')
