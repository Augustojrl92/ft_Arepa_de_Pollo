# AEDLPH Status Service

FastAPI microservice responsible for `/status`, `/api/health/`, and
`/api/status/`. It checks PostgreSQL directly, reads the latest campus
synchronization time, pings Redis, and probes Django, Next.js, and the Public
API through the internal Docker network.

The status HTML is rendered by this service rather than Next.js, so it remains
available when the frontend is down. The service has no startup dependency on
the components it monitors. Nginx is its only public entry point.

`/healthz` is the container liveness endpoint. It deliberately does not inspect
dependencies; `/api/health/` and `/api/status/` provide the aggregate result.

```bash
make status-up
make status-logs
make status-test
```
