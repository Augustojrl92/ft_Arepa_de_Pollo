from datetime import date

from django.core.management.base import BaseCommand, CommandError

from sync.models import Coalition
from sync.score_snapshots_backfill import backfill_daily_score_snapshots
from sync.season import CURRENT_SEASON_START_DATE


class Command(BaseCommand):
	help = 'Reconstruye snapshots diarios de puntos de coaliciones y usuarios desde score events historicos.'

	def add_arguments(self, parser):
		parser.add_argument('--start-date', default=CURRENT_SEASON_START_DATE.isoformat())
		parser.add_argument('--end-date', default=None)
		parser.add_argument('--request-interval', type=float, default=0.25)
		parser.add_argument('--coalition', type=str, default=None)

	def handle(self, *args, **options):
		try:
			start_date = date.fromisoformat(options['start_date'])
		except ValueError as exc:
			raise CommandError(f'Fecha invalida para --start-date: {options["start_date"]}') from exc

		end_date_option = options['end_date']
		if end_date_option:
			try:
				end_date = date.fromisoformat(end_date_option)
			except ValueError as exc:
				raise CommandError(f'Fecha invalida para --end-date: {end_date_option}') from exc
		else:
			end_date = None

		coalition_filter = options['coalition']
		coalition_queryset = Coalition.objects.order_by('coalition_id')
		if coalition_filter:
			coalition_queryset = coalition_queryset.filter(slug=coalition_filter)
			if not coalition_queryset.exists():
				coalition_queryset = Coalition.objects.filter(name__iexact=coalition_filter).order_by('coalition_id')
			if not coalition_queryset.exists():
				raise CommandError(f'Coalicion no encontrada: {coalition_filter}')

		result = backfill_daily_score_snapshots(
			start_date=start_date,
			end_date=end_date,
			coalition_queryset=coalition_queryset,
			request_interval=options['request_interval'],
		)

		self.stdout.write('Backfill diario de snapshots completado')
		self.stdout.write(f'Rango: {result["start_date"].isoformat()} -> {result["end_date"].isoformat()}')
		self.stdout.write(f'Coaliciones procesadas: {result["processed_coalitions"]}')
		self.stdout.write(f'Usuarios procesados: {result["processed_users"]}')
		self.stdout.write(f'Score rows obtenidas: {result["fetched_score_rows"]}')
		self.stdout.write(f'Coalition snapshots upserted: {result["coalition_snapshots_upserted"]}')
		self.stdout.write(f'User snapshots upserted: {result["user_snapshots_upserted"]}')
		self.stdout.write(f'Peticiones HTTP 42: {result["request_count"]}')
