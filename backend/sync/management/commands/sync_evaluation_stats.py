from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from sync.evaluations import (
	sync_users_evaluations_done_total,
	sync_users_evaluations_done_total_in_batches,
)
from sync.models import CampusUser


# Objective:
# Provide a management command to sync evaluation counters from 42 into `CampusUser`.
# Expects:
# - CLI options controlling request pacing, batch size, offset, and auto-batch mode.
# Returns:
# - Prints a processing summary to stdout after the sync finishes.
class Command(BaseCommand):
	help = 'Sincroniza el numero de evaluaciones realizadas como corrector para CampusUser.'

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
		parser.add_argument('--stale-hours', type=float, default=None)
		parser.add_argument('--only-unsynced', action='store_true')

	# Objective:
	# Execute the evaluation sync for one slice or for the whole dataset in automatic batches.
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
		stale_hours = options['stale_hours']
		only_unsynced = options['only_unsynced']

		base_queryset = CampusUser.objects.exclude(login='').order_by('id')
		if only_unsynced:
			base_queryset = base_queryset.filter(evaluations_synced_at__isnull=True)
		elif stale_hours is not None:
			stale_before = timezone.now() - timedelta(hours=stale_hours)
			base_queryset = base_queryset.filter(
				Q(evaluations_synced_at__isnull=True) | Q(evaluations_synced_at__lt=stale_before)
			)

		if auto_batch:
			batches_run = 0

			# Objective:
			# Print one progress line per processed batch.
			def report_progress(batch_index, offset, processed, updated, total_processed, total_updated):
				self.stdout.write(
					f'Bloque {batch_index} | offset {offset} | procesados {processed} | actualizados {updated} | acumulado {total_processed}'
				)

			# Objective:
			# Iterate through the full queryset in fixed-size slices without loading every user at once.
			# Expects:
			# - `base_queryset` already ordered in a stable way.
			# - `offset` as the first row to process.
			# - `limit` as the batch size.
			# - `max_batches` as an optional hard stop for partial runs.
			# Returns:
			# - A generator yielding `(batch, current_offset)` tuples.
			# Notes:
			# - `current_offset` starts from the CLI offset and moves forward by `limit` after each yield.
			# - `batches_run` is shared with the outer scope so the loop can stop when `max_batches` is reached.
			# - Converting each slice to `list(...)` freezes that batch before processing it.
			def limited_queryset():
				nonlocal batches_run
				current_offset = offset
				while True:
					if max_batches is not None and batches_run >= max_batches:
						break
					batch = list(base_queryset[current_offset:current_offset + limit])
					if not batch:
						break
					yield batch, current_offset
					current_offset += limit
					batches_run += 1

			# These counters accumulate the global command result across all yielded batches.
			total_processed = 0
			total_updated = 0
			executed_batches = 0

			# Process one batch at a time, update the cumulative counters, and print progress after each batch.
			for batch, batch_offset in limited_queryset():
				executed_batches += 1
				result = sync_users_evaluations_done_total(queryset=batch, request_interval=request_interval)
				total_processed += result['processed']
				total_updated += result['updated']
				report_progress(
					batch_index=executed_batches,
					offset=batch_offset,
					processed=result['processed'],
					updated=result['updated'],
					total_processed=total_processed,
					total_updated=total_updated,
				)

			self.stdout.write('Sincronizacion de evaluaciones completada')
			self.stdout.write(f'Usuarios procesados: {total_processed}')
			self.stdout.write(f'Usuarios actualizados: {total_updated}')
			self.stdout.write(f'Bloques ejecutados: {executed_batches}')
			self.stdout.write(f'Tamano de bloque: {limit}')
			return

		# Non auto-batch mode processes only one explicit slice defined by offset + limit.
		queryset = base_queryset[offset:offset + limit]
		result = sync_users_evaluations_done_total(
			queryset=queryset,
			request_interval=request_interval,
		)

		self.stdout.write('Sincronizacion de evaluaciones completada')
		self.stdout.write(f'Usuarios procesados: {result["processed"]}')
		self.stdout.write(f'Usuarios actualizados: {result["updated"]}')
