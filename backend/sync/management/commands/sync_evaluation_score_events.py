from django.core.management.base import BaseCommand

from sync.evaluations import sync_evaluations_from_coalition_scores
from sync.models import Coalition


# Objective:
# Provide a management command to increment local evaluation counters from recent coalition score events.
# Expects:
# - Optional coalition filter and request pacing options.
# Returns:
# - Prints a processing summary to stdout after the sync finishes.
class Command(BaseCommand):
	help = 'Sincroniza correcciones incrementales usando score events recientes por coalicion.'

	# Objective:
	# Declare the CLI arguments supported by this command.
	# Expects:
	# - Django's argument parser for management commands.
	# Returns:
	# - No explicit return value; it mutates the parser in place.
	def add_arguments(self, parser):
		parser.add_argument('--request-interval', type=float, default=0.25)
		parser.add_argument('--coalition', type=str, default=None)

	# Objective:
	# Execute the incremental score-event sync for every coalition or for a single coalition.
	# Expects:
	# - Parsed CLI options coming from `add_arguments`.
	# Returns:
	# - No explicit return value; writes a summary to stdout.
	def handle(self, *args, **options):
		request_interval = options['request_interval']
		coalition_filter = options['coalition']

		coalition_queryset = Coalition.objects.order_by('coalition_id')
		if coalition_filter:
			coalition_queryset = coalition_queryset.filter(slug=coalition_filter)
			if not coalition_queryset.exists():
				coalition_queryset = Coalition.objects.filter(name__iexact=coalition_filter).order_by('coalition_id')

		result = sync_evaluations_from_coalition_scores(
			coalition_queryset=coalition_queryset,
			request_interval=request_interval,
		)

		self.stdout.write('Sincronizacion incremental de correcciones completada')
		self.stdout.write(f'Coaliciones procesadas: {result["processed_coalitions"]}')
		self.stdout.write(f'Coaliciones bootstrap: {result["bootstrapped_coalitions"]}')
		self.stdout.write(f'Rows score revisadas: {result["scanned_rows"]}')
		self.stdout.write(f'Rows de correccion: {result["evaluation_rows"]}')
		self.stdout.write(f'Usuarios actualizados: {result["updated_users"]}')
