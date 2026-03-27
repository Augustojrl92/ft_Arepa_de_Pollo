from django.core.management.base import BaseCommand, CommandError

from sync.services import run_coalitions_only_sync, run_full_sync, run_users_only_sync


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
			raise CommandError(str(exc)) from exc

		self.stdout.write(self.style.SUCCESS('Sincronizacion completada'))
		self.stdout.write(f"Campus: {result['campus_id']}")
		self.stdout.write(f"Total traidos: {result['total_fetched']}")
		self.stdout.write(f"Coaliciones: {result['total_coalitions']}")
		self.stdout.write(f"Usuarios con Coaliciones: {result['total_coalitions_users']}")
		self.stdout.write(f"Coaliciones creadas: {result.get('coalitions_created', 0)}")
		self.stdout.write(f"Coaliciones actualizadas: {result.get('coalitions_updated', 0)}")
		self.stdout.write(f"Creados: {result['created_count']}")
		self.stdout.write(f"Actualizados: {result['updated_count']}")
		self.stdout.write(f"Omitidos (inactivos/invalidos): {result['skipped_count']}")