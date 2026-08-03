# public_api/app/main.py

## Purpose
This file is the entry point of the public_api FastAPI application. It creates the ASGI app object that Uvicorn imports and serves, and it currently exposes a minimal health endpoint.

## What it defines
- `app`: the FastAPI application instance.
- `GET /api/v1/health`: a simple endpoint used to confirm the service is alive.
- Public API routers for API keys, users, and coalitions.

## Why it matters
Every FastAPI service needs a central application object. Uvicorn does not run the project folder by itself; it imports the `app` object from this file. That is why the Docker command points to `app.main:app`.

## Deep explanation
### `from fastapi import FastAPI`
This imports FastAPI’s main application class. Creating an instance of this class gives you:
- routing support
- automatic request/response validation
- OpenAPI generation
- interactive Swagger docs

### `app = FastAPI(...)`
This creates the actual application object. The parameters define metadata that appears in the docs.
- `title`: the name of the API shown in Swagger.
- `version`: semantic version of the API.
- `description`: human-readable summary of what the service does.

This is not business logic. It is application metadata and bootstrapping.

### `@app.get("/api/v1/health")`
This decorator registers an HTTP GET route. FastAPI associates the following function with that URL path and method.

The route lives under `/api/v1` because this service is versioned from the start. That makes future breaking changes easier to manage.

### `def health(): return {"status": "ok"}`
This endpoint returns a tiny JSON object. It exists for operational checks:
- container health
- load balancer or monitoring probes
- quick manual verification during development

It does not touch the database or any other service. That is intentional. Health endpoints should be fast and reliable.

## How it fits in the project
- Docker starts this file through Uvicorn.
- Swagger docs are automatically generated from this app.
- API key, users, and coalitions routers are included from here.
- This file will remain the composition root for the public API.

## Current scope
This file composes the FastAPI service. The route modules provide API key
authentication, Redis-backed rate limiting, and read endpoints over the shared
database.
