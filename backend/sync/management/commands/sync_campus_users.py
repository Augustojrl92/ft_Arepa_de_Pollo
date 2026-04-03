import logging
import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from sync.services import (
	get_request_count,
	reset_request_count,
	run_coalitions_only_sync,
	run_full_sync,
	run_users_only_sync,
)


logger = logging.getLogger(__name__)


class Command(BaseCommand):
	help = 'Sincroniza campus_users desde la API de 42 y los guarda en DB.'

	def add_arguments(self, parser):
		parser.add_argument(
			'--mode',
			choices=['full', 'users', 'coalitions'],
			default='full',
			help='Flujo a ejecutar: full (default), users o coalitions.',
		)
		parser.add_argument(
			'--request-interval',
			type=float,
			default=0.25,
			help='Segundos de espera entre peticiones (default: 0.25).',
		)
		parser.add_argument(
			'--max-pages',
			type=int,
			default=None,
			help='Limitar paginas del endpoint de usuarios (solo aplica a full/users).',
		)

	def handle(self, *args, **options):
		mode = options['mode']
		request_interval = options['request_interval']
		max_pages = options['max_pages']
		start = time.perf_counter()
		started_at = timezone.now().isoformat()

		reset_request_count()
		self.stdout.write(
			f"[SYNC-CRON][START] at={started_at} mode={mode} request_interval={request_interval:.2f} max_pages={max_pages}"
		)
		logger.info(
			'Sync cron started | mode=%s | request_interval=%.2f | max_pages=%s',
			mode,
			request_interval,
			max_pages,
		)

		try:
			if mode == 'users':
				result = run_users_only_sync(
					request_interval=request_interval,
					max_pages=max_pages,
				)
			elif mode == 'coalitions':
				result = run_coalitions_only_sync(
					request_interval=request_interval,
				)
			else:
				result = run_full_sync(
					request_interval=request_interval,
					max_pages=max_pages,
				)
		except Exception as exc:
			elapsed_seconds = time.perf_counter() - start
			logger.exception(
				'Sync cron failed | mode=%s | elapsed=%.2fs | requests=%s',
				mode,
				elapsed_seconds,
				get_request_count(),
			)
			raise CommandError(str(exc)) from exc

		elapsed_seconds = time.perf_counter() - start
		result['requests_count'] = get_request_count()
		result['elapsed_seconds'] = elapsed_seconds
		finished_at = timezone.now().isoformat()
		self.stdout.write(
			f"[SYNC-CRON][END] at={finished_at} mode={mode} elapsed={elapsed_seconds:.2f}s requests={result['requests_count']}"
		)

		logger.info(
			'Sync cron finished | mode=%s | elapsed=%.2fs | requests=%s | fetched=%s | created=%s | updated=%s | skipped=%s',
			mode,
			elapsed_seconds,
			result['requests_count'],
			result['total_fetched'],
			result['created_count'],
			result['updated_count'],
			result['skipped_count'],
		)

		self.stdout.write(self.style.SUCCESS('Sincronizacion completada'))
		self.stdout.write(f"Duracion (s): {result['elapsed_seconds']:.2f}")
		self.stdout.write(f"Peticiones HTTP realizadas: {result['requests_count']}")
		self.stdout.write(f"Campus: {result['campus_id']}")
		self.stdout.write(f"Total traidos: {result['total_fetched']}")
		self.stdout.write(f"Coaliciones: {result['total_coalitions']}")
		self.stdout.write(f"Usuarios con Coaliciones: {result['total_coalitions_users']}")
		self.stdout.write(f"Coaliciones creadas: {result.get('coalitions_created', 0)}")
		self.stdout.write(f"Coaliciones actualizadas: {result.get('coalitions_updated', 0)}")
		self.stdout.write(f"Creados: {result['created_count']}")
		self.stdout.write(f"Actualizados: {result['updated_count']}")
		self.stdout.write(f"Omitidos (inactivos/invalidos): {result['skipped_count']}")