# public_api/app/db/session.py

## Purpose
This file creates the SQLAlchemy database engine and the session factory used by the public_api service.

## What it defines
- `engine`: the low-level connection manager to PostgreSQL.
- `SessionLocal`: the session factory used to create database sessions.

## Why it matters
The ORM model defines what the database table looks like, but this file defines how the application actually talks to the database.

Without a session factory, routes and services would have no way to query, insert, update, or delete records.

## Deep explanation
### `create_engine(settings.database_url, future=True)`
This creates the SQLAlchemy engine.
The engine is the component that knows how to communicate with the database using the connection string built in `config.py`.

The engine is not a session itself.
It is the reusable connection configuration object that sessions will use underneath.

### `future=True`
This tells SQLAlchemy to use the newer 2.x style behavior.
That is the modern API and is the recommended direction for new projects.

### `sessionmaker(...)`
This builds a factory that creates session objects.
A session is the unit of work you use in code when talking to the database.
You normally do not keep one global session forever.
Instead, you create one per request or per operation.

### `bind=engine`
This connects the session factory to the engine, so every session knows which database to use.

### `autoflush=False`
SQLAlchemy will not automatically push pending changes to the database before every query.
That keeps behavior more explicit and predictable.

### `autocommit=False`
Changes are not written permanently unless you explicitly call `commit()`.
That is safer because accidental changes do not silently persist.

## How it fits in the project
- `config.py` provides the database URL.
- `session.py` turns that URL into a working engine and session factory.
- Service classes and route dependencies will use `SessionLocal()` to talk to the database.
- Later, an `get_db()` dependency will likely wrap session creation and cleanup.

## Typical lifecycle of a session
1. Create the session.
2. Perform queries or writes.
3. Commit if successful.
4. Roll back if something fails.
5. Close the session.

That pattern prevents connection leaks and keeps transactions predictable.

## Current scope
This file is the connection layer. It does not define tables or business logic.
It is one of the core building blocks needed before API key CRUD and authentication can be implemented.
