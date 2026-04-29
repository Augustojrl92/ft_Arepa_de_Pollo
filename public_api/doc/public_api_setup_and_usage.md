# Public API Setup And Usage

## Start the api

```bash
make full-up
```

This starts:
- `db`
- `backend`
- `frontend`
- `public_api`

If you want the `public_api` service together with its shared backend and database stack, use:

```bash
make api-up
```

This starts:
- `backend`
- `db`
- `public_api`

The `api-*` targets are the public API-specific rules in the root `Makefile`.
They run inside Docker, so teammates only need `make`, not direct `docker compose` commands.

## API Make rules

### `make api-up`
Builds and starts the dependency chain for the public API service.

Use it when you want to work on `public_api` together with its shared backend/db stack.

### `make api-stop`
Stops the `public_api` container if it is running.

### `make api-down`
Removes the `public_api` container.

### `make api-re`
Recreates the `public_api` container by running `api-down` followed by `api-up`.

### `make api-logs`If you need a real key for testing:

```bash
make api-create-key NAME="bootstrap_key"
Streams logs for the `public_api` container.

### `make api-alembic-init`
Initializes Alembic scaffolding inside `public_api`.

Use this only once if the Alembic directory is missing in the repository. Usually, first time.

### `make api-migrate`
Applies all pending Alembic migrations for `public_api`.

Typical use after pulling the repository:

```bash
make full-up
make api-migrate
```

### `make api-revision MSG="..."`
Creates a new Alembic migration revision from SQLAlchemy models.

`MSG` is required.

Example:

```bash
make api-revision MSG="initial api keys schema"
```

### `make api-history`
Shows the Alembic revision history for `public_api`.

### `make api-current`
Shows the current applied Alembic revision.

### `make api-downgrade REV="..."`
Downgrades the schema to a previous Alembic revision.

`REV` is required.

Example:

```bash
make api-downgrade REV="-1"
```

### `make api-syncdb`
Shortcut for `make api-migrate`.

Use it when you want to keep the schema up to date without typing the longer command.

### `make api-create-key NAME="..." [EXPIRES_AT=...] [RPM=...]`
Creates a real API key inside the running `public_api` container.

`NAME` is required.
`EXPIRES_AT` is optional.
`RPM` is optional and defaults to `60`.

Example:

```bash
make api-create-key NAME="bootstrap_key" RPM=60
```

The command prints:
- the database id
- the key name
- the key prefix
- the raw one-time key value

## Current endpoints

Base URL (local Docker): `http://localhost:8001`

### `GET /api/v1/health`
- Auth: none
- Purpose: service readiness check
- Success response: `200`

Example:

```bash
curl -i http://localhost:8001/api/v1/health
```

### `POST /api/v1/api-keys`
- Auth: required header `X-API-Key: <valid_key>`
- Purpose: create a new API key
- Body:
	- `name` (string, required)
	- `expires_at` (datetime, optional)
	- `requests_per_minute` (int, optional)
- Success response: `201`
- Returns one-time raw key in `key` plus metadata in `api_key`

Example:

```bash
curl -i -X POST http://localhost:8001/api/v1/api-keys \
	-H "Content-Type: application/json" \
	-H "X-API-Key: <bootstrap_key>" \
	-d '{"name":"team_key","requests_per_minute":60}'
```

### `GET /api/v1/api-keys/{api_key_id}`
- Auth: required header `X-API-Key: <valid_key>`
- Purpose: get one key metadata by id
- Success response: `200`
- Not found: `404`

Example:

```bash
curl -i http://localhost:8001/api/v1/api-keys/<uuid> \
	-H "X-API-Key: <bootstrap_key>"
```

### `PUT /api/v1/api-keys/{api_key_id}`
- Auth: required header `X-API-Key: <valid_key>`
- Purpose: update key name/expiry/rate limit
- Body:
	- `name` (string, required)
	- `expires_at` (datetime, optional)
	- `requests_per_minute` (int, optional)
- Success response: `200`
- Not found: `404`

Example:

```bash
curl -i -X PUT http://localhost:8001/api/v1/api-keys/<uuid> \
	-H "Content-Type: application/json" \
	-H "X-API-Key: <bootstrap_key>" \
	-d '{"name":"team_key_updated","requests_per_minute":120}'
```

### `DELETE /api/v1/api-keys/{api_key_id}`
- Auth: required header `X-API-Key: <valid_key>`
- Purpose: revoke key (set inactive)
- Success response: `200`
- Not found: `404`

Example:

```bash
curl -i -X DELETE http://localhost:8001/api/v1/api-keys/<uuid> \
	-H "X-API-Key: <bootstrap_key>"
```

### `GET /api/v1/users`
- Auth: required header `X-API-Key: <valid_key>`
- Purpose: list users with filtering, sorting, and pagination
- Query params:
	- `page` (optional, default `1`)
	- `per_page` (optional, default `50`, max `200`)
	- `coalition` (optional, coalition slug)
	- `level_min` (optional float)
	- `level_max` (optional float)
	- `is_active` (optional boolean)
	- `sort_by` (optional, default `-coalition_user_score`)
- Success response: `200`
- Bad request: `400` (invalid sort field or `level_min > level_max`)

Example:

```bash
curl -i "http://localhost:8001/api/v1/users?page=1&per_page=10&coalition=the-alliance&is_active=true&sort_by=-level" \
	-H "X-API-Key: <bootstrap_key>"
```

### `GET /api/v1/users/{intra_id}`
- Auth: required header `X-API-Key: <valid_key>`
- Purpose: fetch one user by 42 intra id
- Success response: `200`
- Not found: `404`

Example:

```bash
curl -i "http://localhost:8001/api/v1/users/12345" \
	-H "X-API-Key: <bootstrap_key>"
```

### `GET /api/v1/coalitions`
- Auth: required header `X-API-Key: <valid_key>`
- Purpose: list coalitions with pagination and sorting
- Query params:
	- `page` (optional, default `1`)
	- `per_page` (optional, default `50`, max `200`)
	- `sort_by` (optional, default `-total_score`)
- Success response: `200`
- Bad request: `400` (invalid sort field)

Example:

```bash
curl -i "http://localhost:8001/api/v1/coalitions?page=1&per_page=10&sort_by=-total_score" \
	-H "X-API-Key: <bootstrap_key>"
```

### `GET /api/v1/coalitions/{coalition_id}`
- Auth: required header `X-API-Key: <valid_key>`
- Purpose: fetch coalition details including trends and top members
- Success response: `200`
- Not found: `404`

Example:

```bash
curl -i "http://localhost:8001/api/v1/coalitions/45" \
	-H "X-API-Key: <bootstrap_key>"
```

### Common auth failures
- Missing `X-API-Key` header: `401` (`Missing API key`)
- Invalid, expired, or revoked key: `401` (`Invalid or expired API key`)

## api_test_key.py usage

Script path: `public_api/tests/api_test_key.py`

This script runs a test against the current endpoints.

Coverage includes:
- health endpoint
- API key lifecycle (create/read/update/revoke + revoked key guard)
- users list/detail checks
- coalitions list/detail checks

### CLI options
- Positional `name` (required): name used for `POST /api/v1/api-keys`
- `--base-url` (optional, default `http://localhost:8001`): target API URL
- `--api-key` (optional): bootstrap key for protected lifecycle tests
	- if omitted, script reads `PUBLIC_API_KEY` from environment
- `--timeout` (optional, default `8.0`): request timeout in seconds

### Missing required `name`
If `name` is not provided, argparse prints usage and exits with an error.

