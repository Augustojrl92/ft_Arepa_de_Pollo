# Disaster Recovery Runbook - GGC-83

## 1. Objective

This runbook documents the operational procedure to **diagnose, contain, and recover** the system when there is an incident related to:

- PostgreSQL;
- the Django backend;
- `500` errors in the application;
- data loss or corruption;
- the need to restore a manual backup.

It should be used when the system stops responding correctly, when a sync or migration leaves the database in an inconsistent state, or when it is necessary to return to a previously known good state.

## 2. When to use this runbook

Use this document if any of these situations occurs:

- the database is not responding;
- the backend does not start;
- the application returns `500` errors;
- data was deleted by mistake;
- a migration left the database in a bad state;
- a sync operation left inconsistent data;
- a backup restore is required.

## 3. Main services

| Service | Role | Available health signal | Notes |
|---|---|---|---|
| `frontend` | Next.js UI | `docker compose ps` | No dedicated Docker healthcheck |
| `backend` | Django API | `GET /api/health/`, `GET /api/status/`, Docker healthcheck | Listens on `localhost:8000` |
| `db` | PostgreSQL | Docker `pg_isready` healthcheck | Main system database |
| `sync/scheduler` | cron inside the `backend` container | `last_sync` in `/api/status/`, backend logs | Not a separate container |
| `42 API` | external dependency for sync | indirect | If it fails, sync jobs may break even if backend and DB are alive |

### Note about the scheduler

In the current repo state, the scheduler:

- runs inside the `backend` container;
- starts through `cron` from [backend/entrypoint.sh](/home/aurodrig/Desktop/arepa/backend/entrypoint.sh:1);
- registers jobs from [backend/cron_scheduler/apps.py](/home/aurodrig/Desktop/arepa/backend/cron_scheduler/apps.py:1);
- executes `sync_campus_users --mode=full` every 20 minutes according to [backend/config/settings/settings.py](/home/aurodrig/Desktop/arepa/backend/config/settings/settings.py:180).

## 4. Emergency scenarios

### The database is not responding

Typical symptoms:

- `GET /api/health/` returns `503`;
- `GET /api/status/` returns `503`;
- `docker compose ps` shows `db` as `unhealthy` or `exited`;
- the backend starts returning SQL connection errors.

### The backend does not start

Typical symptoms:

- `backend` appears stopped in `docker compose ps`;
- `curl http://localhost:8000/api/health/` does not respond;
- logs show import, migration, or configuration errors.

### The application returns 500 errors

Typical symptoms:

- `/api/health/` or `/api/status/` return errors;
- business routes fail;
- backend logs show tracebacks.

### Data was deleted by mistake

Typical symptoms:

- missing records;
- incorrect values after a manual operation;
- unexpected changes after scripts or sync jobs.

### A migration or sync operation left inconsistent data

Typical symptoms:

- the backend responds, but the data is inconsistent;
- rankings, counters, or views show impossible values;
- operational status looks healthy, but the content is wrong.

### A backup restore is required

Use this flow when:

- the current database state is no longer trustworthy;
- there is a known and recent dump available;
- recovery is safer than trying to repair the data manually.

## 5. Diagnostic commands

### Overall stack status

```bash
docker compose -f docker-compose.dev.yml ps
```

### Backend logs

```bash
docker compose -f docker-compose.dev.yml logs backend
```

### PostgreSQL logs

```bash
docker compose -f docker-compose.dev.yml logs db
```

### Health endpoint

```bash
curl -i http://localhost:8000/api/health/
```

### Status endpoint

```bash
curl -i http://localhost:8000/api/status/
```

### Available backups

```bash
make db-backup-ls
```

### If the issue looks related to scheduler or sync

```bash
docker compose -f docker-compose.dev.yml logs backend | grep -i cron
```

```bash
curl -i http://localhost:8000/api/status/
```

Pay special attention to:

- `last_sync`
- errors related to the 42 API connection
- exceptions raised by cron jobs

## 6. Manual backup procedure

### When to run it

Run a manual backup:

- before a restore;
- before a destructive operation;
- before a risky migration;
- before touching local/demo data that you do not want to lose.

### Command

```bash
make db-backup
```

### Expected result

The script:

- verifies that Docker is available;
- verifies that the `db` container is running;
- runs `pg_dump` inside the container;
- compresses the result as `.sql.gz`;
- validates the gzip archive;
- stores the file in:

```text
backups/postgres/
```

Expected filename format:

```text
backups/postgres/trascendence_YYYY-MM-DD_HH-MM-SS.sql.gz
```

### List existing backups

```bash
make db-backup-ls
```

## 7. Restore procedure

### Warning

The restore process is **destructive**.

That means:

- it replaces the current database state;
- any data created after the backup is lost;
- it must not be executed unless the chosen dump is clearly identified.

### Command

```bash
make db-restore BACKUP_FILE=backups/postgres/<file>.sql.gz
```

Example:

```bash
make db-restore BACKUP_FILE=backups/postgres/trascendence_2026-05-01_20-48-54.sql.gz
```

### What the script does

The current restore flow:

- requires an explicit `BACKUP_FILE`;
- validates that the file exists;
- validates that the gzip archive is valid;
- checks that Docker and the `db` container are available;
- temporarily stops `backend` if it is running;
- restores the SQL into PostgreSQL;
- starts `backend` again if it had been stopped.

### Operational recommendation

Before restoring:

1. record which backup will be used;
2. if the current state is still valuable, create one more backup before restore;
3. confirm that the selected dump corresponds to a coherent application state.

## 8. Post-restore smoke checks

After the restore, check the system in this order:

### 1. Container status

```bash
docker compose -f docker-compose.dev.yml ps
```

Expected:

- `db` is `healthy`
- `backend` is `healthy`
- `frontend` is running

### 2. Backend health

```bash
curl -i http://localhost:8000/api/health/
```

Expected:

- `200 OK`
- `database: ok`

### 3. System status

```bash
curl -i http://localhost:8000/api/status/
```

Expected:

- `200 OK`
- `status: ok`
- `database: ok`

### 4. Login if applicable

If authentication is part of the flow you want to validate:

- open the application;
- try to log in;
- confirm that the backend responds without errors.

### 5. Main frontend pages

Open, at minimum:

- `http://localhost:3000/status`
- the main pages used by the team for demo

Check:

- that they load;
- that they do not show visible errors;
- that the backend responds behind them.

### 6. Functional validation of restored data

Check that:

- the expected data exists again;
- the changes that triggered the restore are gone;
- previous snapshots or imports are still reflected if that was the backup state.

## 9. What to do if the restore fails

If the restore does not complete successfully:

### Review logs

```bash
docker compose -f docker-compose.dev.yml logs backend
```

```bash
docker compose -f docker-compose.dev.yml logs db
```

### Confirm that the backup exists

```bash
ls -lh backups/postgres/
```

### Confirm gzip integrity

```bash
gzip -t backups/postgres/<file>.sql.gz && echo OK
```

### Confirm Docker is up

```bash
docker compose -f docker-compose.dev.yml ps
```

### Do not delete older backups

Do not remove older dumps until you have confirmed that:

- the restore completes successfully;
- `/api/health/` is back to `200`;
- `/api/status/` is back to `200`;
- the restored data is correct.

### If the backend does not start again

Review:

- backend logs;
- `db` status;
- connection errors;
- possible incompatibilities between old backups and newer migrations.

## 10. Automated backup policy

The `db-backup` Compose service creates a validated PostgreSQL backup when it starts
and repeats the operation every 6 hours. Automated files use the prefix
`auto_trascendence_`, use UTC timestamps, and are retained for 7 days. Manual backups
are never removed by the automated retention policy.

The schedule can be overridden before starting Compose:

```bash
BACKUP_INTERVAL_SECONDS=21600 BACKUP_RETENTION_DAYS=7 make up
```

Useful operational commands:

```bash
make db-backup-auto-up
make db-backup-auto-logs
make db-backup-auto-stop
```

## 11. Risks and limitations

- the current backup is **local** and **unencrypted**;
- backups may consume disk space over time;
- restore is destructive;
- old backups may not match newer migrations;
- automated backups are stored locally and should be copied off-host for production use;
- there is still no automated recovery checklist.

## 12. Relation to the subject

This runbook contributes directly to the module:

**DevOps Minor: Health check and status page system with automated backups and disaster recovery procedures**

What is already covered:

- backend and PostgreSQL health checks;
- status page / status endpoint;
- demonstrable manual backup;
- periodic automated backup every 6 hours;
- 7-day retention for automated backups;
- demonstrable manual restore;
- documented recovery procedure.

The remaining production-hardening step is copying backups to encrypted off-host
storage and exercising the recovery checklist regularly as a team.

## 13. Recovery checklist

- [ ] Confirm the nature of the incident.
- [ ] Review `docker compose ps`.
- [ ] Review `backend` and `db` logs.
- [ ] Check `GET /api/health/`.
- [ ] Check `GET /api/status/`.
- [ ] Decide whether a restart is enough or a restore is required.
- [ ] If needed, create one additional backup of the current state.
- [ ] Select the correct backup to restore.
- [ ] Run `make db-restore BACKUP_FILE=...`.
- [ ] Wait for `backend` and `db` to become operational again.
- [ ] Execute post-restore smoke checks.
- [ ] Confirm that the expected data is back.
- [ ] Do not delete previous backups until recovery is fully validated.
