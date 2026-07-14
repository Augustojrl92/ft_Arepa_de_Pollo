from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.utils import timezone
from sync.models import SyncMetadata


SERVICE_NAME = 'pollo-backend'


def _check_database():
	try:
		with connection.cursor() as cursor:
			cursor.execute('SELECT 1')
			cursor.fetchone()
	except DatabaseError as exc:
		return 'error', str(exc)

	return 'ok', None


def _get_last_sync_time():
	metadata = SyncMetadata.objects.filter(key='campus_sync').only('last_time_update').first()
	if metadata is None or metadata.last_time_update is None:
		return None
	return metadata.last_time_update.isoformat()


def api_root(request):
	return JsonResponse(
		{
			'service': SERVICE_NAME,
			'status': 'ok',
			'available_endpoints': {
				'admin': '/admin/',
				'health': '/api/health/',
				'status': '/api/status/',
				'message': '/api/message/',
			},
		}
	)


def health_check(request):
	database_status, error = _check_database()
	status = 'ok' if database_status == 'ok' else 'error'
	payload = {
		'service': SERVICE_NAME,
		'status': status,
		'database': database_status,
	}
	if error:
		payload['error'] = error

	return JsonResponse(payload, status=200 if status == 'ok' else 503)


def status_check(request):
	database_status, error = _check_database()
	status = 'ok' if database_status == 'ok' else 'error'
	payload = {
		'service': SERVICE_NAME,
		'status': status,
		'database': database_status,
		'last_sync': _get_last_sync_time() if database_status == 'ok' else None,
		'timestamp': timezone.now().isoformat(),
	}
	if error:
		payload['error'] = error

	return JsonResponse(payload, status=200 if status == 'ok' else 503)

def server_message(request):
	return JsonResponse({'message': 'esto es una respuesta del servidor'})
