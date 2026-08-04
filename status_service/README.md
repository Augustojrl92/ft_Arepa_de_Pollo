# AEDLPH Status Service

FastAPI microservice responsible for `/api/health/` and `/api/status/`.
It checks PostgreSQL directly, reads the latest campus synchronization time,
and probes Django through the internal Docker network.

The service is not published directly. Nginx exposes its endpoints through the
same HTTPS origin as the frontend and the other APIs.

```bash
make status-up
make status-logs
make status-test
```
