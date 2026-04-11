# Custom Major Module: Campus Data Sync and Temporal Snapshot Engine

## 1. Why We Chose This Module
Our project depends on external 42 campus data that changes continuously (users, ranks, coalition scores, activity status). We needed a reliable way to ingest, normalize, version, and expose this data for product features.

Instead of a simple one-shot import, we implemented a full synchronization and temporal snapshot engine to support both operational reliability and historical analysis.

## 2. Technical Challenges Addressed

### A. External API Reliability and Throughput
- OAuth machine-to-machine token lifecycle with cache and expiration guard.
- Paged ingestion of large datasets.
- Retry with backoff for transient errors and rate-limit scenarios.
- Request pacing to avoid API abuse.

### B. Consistent Data Modeling and Upsert Strategy
- Normalization of external entities into local domain models.
- Upsert pipelines for coalitions and campus users.
- Filtering/validation logic for invalid or non-eligible rows.
- Rank recomputation over synchronized data.

### C. Temporal Persistence for Historical Intelligence
- Daily snapshots for coalition scores and user scores.
- Integrity constraints and indexed snapshot queries.
- Delta-based views (24h, weekly, monthly) used by coalition analytics.

### D. Operability and Execution Modes
- Command-based execution with multiple modes:
  - full
  - users-only
  - coalitions-only
- Runtime metrics (duration, request count, created/updated/skipped rows).
- Sync metadata for last successful update.

## 3. Value Added to the Project
- Enables stable ranking and coalition features even when upstream API is unstable.
- Provides historical trend data that powers progression and comparison views.
- Reduces coupling between UI/API responses and external provider availability.
- Creates a scalable foundation for future analytics, anomaly detection, and recommendations.

## 4. Why It Deserves Major Module Status (+2)
This module is substantial and technically complex because it combines:
- external integration reliability,
- non-trivial data engineering pipelines,
- temporal data architecture,
- operational command workflows,
- and product-facing analytics outcomes.

It is not a cosmetic or trivial feature. It is a core subsystem that required architecture, resilience patterns, data modeling, and performance-aware implementation.

## 5. Implementation Evidence (Repository)
- Sync domain models: backend/sync/models.py
- Sync pipeline services: backend/sync/services.py
- Sync command entrypoint: backend/sync/management/commands/sync_campus_users.py
- Sync periodic cron scheduler: backend/cron_scheduler/apps.py
- Snapshot migration: backend/sync/migrations/0010_coalitionscoresnapshot_campususerscoresnapshot.py
- Coalition analytics using snapshots: backend/coalitions/services.py
