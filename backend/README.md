# Backend Django base (GGC-23)

Este backend es la base de infraestructura del proyecto:
- Django con settings separados (`dev` y `prod`).
- Postgres en Docker.
- Endpoint mínimo de salud para verificar que todo arranca.

## Guía comentada (general)

Orden recomendado para probar:
1. Levantar contenedores.
2. Ejecutar migraciones.
3. Probar endpoint de salud.
4. Revisar logs si algo falla.
5. Apagar entorno.

## Guía comentada (línea a línea)

### 1) Levantar servicios

```bash
cd backend
```
- Entras en la carpeta donde están `docker-compose.yml` y `Makefile`.

```bash
make up
```
- Construye imagen de Django y levanta `web` + `db` en segundo plano.

### 2) Aplicar migraciones

```bash
make migrate
```
- Ejecuta `python manage.py migrate` dentro del contenedor `web`.
- Crea tablas internas de Django en Postgres.

### 3) Probar que el backend responde

```bash
curl http://localhost:8000/api/health/
```
- Llama al endpoint mínimo de salud.
- Si todo está bien, devuelve:

```json
{"status": "ok"}
```

### 4) Ver logs (si hay errores)

```bash
make logs
```
- Muestra logs en tiempo real de los servicios Docker.

### 5) Apagar todo al terminar

```bash
make down
```
- Detiene y elimina contenedores/red del entorno local.

## Nota rápida de configuración

- Variables base en `.env.example`.
- `DJANGO_SETTINGS_MODULE=config.settings.dev` para desarrollo.
- Puerto backend: `8000`.
