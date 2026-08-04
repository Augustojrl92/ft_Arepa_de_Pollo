from django.http import JsonResponse


SERVICE_NAME = 'pollo-backend'


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


def server_message(request):
	return JsonResponse({'message': 'esto es una respuesta del servidor'})
