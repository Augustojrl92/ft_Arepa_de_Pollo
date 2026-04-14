from django.core.management.base import BaseCommand

from sync.exams import sync_coalition_exams_validated_current_season
from sync.models import Coalition


# Objective:
# Provide a management command to recalculate approved exam totals per coalition for the current season.
# Expects:
# - CLI options controlling request pacing, optional coalition filtering, optional page limits, and dry-run mode.
# Returns:
# - Prints a processing summary to stdout after the sync finishes.
class Command(BaseCommand):
	help = 'Sincroniza el numero de examenes aprobados por coalicion en la temporada actual.'

	# Objective:
	# Declare the CLI arguments supported by this command.
	# Expects:
	# - Django's argument parser for management commands.
	# Returns:
	# - No explicit return value; it mutates the parser in place.
	def add_arguments(self, parser):
		parser.add_argument('--request-interval', type=float, default=0.25)
		parser.add_argument('--coalition', type=str, default=None)
		parser.add_argument('--max-pages', type=int, default=None)
		parser.add_argument('--dry-run', action='store_true')

	# Objective:
	# Execute the current-season exam total sync for every coalition or for one coalition.
	# Expects:
	# - Parsed CLI options coming from `add_arguments`.
	# Returns:
	# - No explicit return value; writes progress and summary information to stdout.
	def handle(self, *args, **options):
		request_interval = options['request_interval']
		coalition_filter = options['coalition']
		max_pages = options['max_pages']
		dry_run = options['dry_run']

		coalition_queryset = Coalition.objects.order_by('coalition_id')
		if coalition_filter:
			coalition_queryset = coalition_queryset.filter(slug=coalition_filter)
			if not coalition_queryset.exists():
				coalition_queryset = Coalition.objects.filter(name__iexact=coalition_filter).order_by('coalition_id')

		result = sync_coalition_exams_validated_current_season(
			coalition_queryset=coalition_queryset,
			request_interval=request_interval,
			max_pages=max_pages,
			dry_run=dry_run,
		)

		self.stdout.write('Sincronizacion de examenes por coalicion completada' + (' (dry-run)' if dry_run else ''))
		self.stdout.write(f'Coaliciones procesadas: {result["processed_coalitions"]}')
		self.stdout.write(f'Rows score revisadas: {result["scanned_rows"]}')
		self.stdout.write(f'Examenes aprobados temporada: {result["exam_rows"]}')
		self.stdout.write(f'Coaliciones actualizadas: {result["updated_coalitions"]}')
