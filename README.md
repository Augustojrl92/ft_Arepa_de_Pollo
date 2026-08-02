*This project has been created as part of the 42 curriculum by Fernando Morenilla, Augusto Jesus Rodriguez Linares, Luis Ayala, Francisco J Vizcaya and German Gasset.*

# AEDLPH

## Description

AEDLPH is a web platform for the 42 coalitions tournament. It combines OAuth login, campus data synchronization, rankings, user profiles, achievements, chat, and a PWA experience so the application remains usable even when connectivity is limited.

The project is built as a full-stack Django and Next.js application. The backend synchronizes data from the 42 API, persists local snapshots, and exposes APIs for the frontend. The frontend renders the dashboards, charts, status views, and supporting UX around authentication, offline access, and installation as a standalone app.

## Instructions

### Requirements

- Docker and Docker Compose
- GNU Make

### Run the full stack

```bash
make full-up
```

This starts the frontend, backend, database, and supporting services from `docker-compose.dev.yml`.

### Backend commands

```bash
make back-up
make back-migrate
make back-syncdb
make back-syncapi
make back-logs
```

### Frontend commands

```bash
make front-up
make front-pwa
make front-logs
```

### Useful notes

- The backend reads its development configuration from `backend/.env`.
- The cron-based sync jobs are registered through Django and executed in the backend container.
- The PWA manifest is exposed from the Next.js app router and the service worker is served from `frontend/public/sw.js`.

## Resources

### Technical references

- Django documentation: https://docs.djangoproject.com/
- Next.js documentation: https://nextjs.org/docs
- MDN Web Docs: https://developer.mozilla.org/
- web.dev PWA guide: https://web.dev/progressive-web-apps/
- 42 API documentation: https://api.intra.42.fr/apidoc

### AI usage

AI was used to draft and refine the README structure, legal-page copy, and compliance-oriented summaries of the codebase. It was also used to cross-check the PWA, offline, and README requirements against the repository contents. The application design, feature set, and implementation details remain grounded in the code present in the repository.

## Team Information

The repository history shows these main contributors. The roles below reflect the main responsibilities visible in the codebase, not necessarily a formal staffing chart.

- Fernando Morenilla - Frontend developer and PWA lead. Responsible for the app shell, routing, offline experience, and UI composition.
- Augusto Jesus Rodriguez Linares - Backend and sync lead. Responsible for the 42 data ingestion pipeline, snapshots, and cron-driven synchronization.
- GGasset - Full-stack developer. Responsible for gameplay, coalition, and product-facing features across the interface.
- Luis Ayala - Backend developer. Responsible for user data, preferences, and social/user models.
- Francisco J Vizcaya - Full-stack developer. Responsible for support features, validation, and feature integration.

## Project Management

The work was organized around shared repository branches, Markdown design documents, Docker-based environments, and iterative feature delivery. The repository itself does not include a dedicated exported issue board, so the visible process is documentation-driven and commit-driven.

- Task distribution: split by backend sync, frontend UX, social features, and supporting infrastructure.
- Meetings and coordination: not recorded in the repository.
- Tools visible in the repo: Git, Docker Compose, Makefile targets, and the documentation under `doc/`.
- Communication channels: not recorded in the repository.

## Technical Stack

### Frontend

- Next.js 16 with the App Router
- React 19
- TypeScript
- Tailwind CSS
- Zustand for client state
- Recharts for visualizations
- PWA support through a service worker and web manifest

### Backend

- Django
- Django REST Framework
- Simple JWT
- django-crontab for scheduled jobs
- Requests for API integration with 42

### Database

- PostgreSQL

PostgreSQL was chosen because the application needs relational integrity, indexed snapshots, one-to-one user settings, and time-based analytics over coalition and user history.

### Other notable technologies

- Docker and Docker Compose for local development
- Cron inside the backend container for scheduled jobs
- Pillow for avatar uploads
- WebSockets-ready app structure for realtime features

## Database Schema

The schema centers on campus users, coalitions, snapshots, preferences, and social data.

```mermaid
erDiagram
    User ||--o| CampusUser : profiles
    User ||--o| FriendsList : owns
    User ||--o| UserPreferences : owns

    Coalition ||--o{ CampusUser : contains
    Coalition ||--o{ CoalitionScoreSnapshot : snapshots
    Coalition ||--o| CoalitionProjectCursor : tracks
    Coalition ||--o| CoalitionEvaluationCursor : tracks

    CampusUser ||--o{ CampusUserScoreSnapshot : snapshots
    CampusUser ||--o{ UserAchievement : earns
    Achievement ||--o{ UserAchievement : assigned

    SyncMetadata {
        string key
        datetime last_time_update
    }

    Coalition {
        int coalition_id
        string name
        string slug
        int total_score
        datetime updated_at
    }

    CampusUser {
        int intra_id
        int user_id
        string login
        bool is_active
        int coalition_id
        int coalition_user_score
        int coalition_rank
        int general_rank
    }

    UserPreferences {
        bool show_sensitive_data
        string theme_mode
        int items_per_page
        image custom_avatar
    }

    FriendsList {
        many_to_many friends
    }

    Achievement {
        string name
        string description
        int completion_points
    }
```

Key relationships:

- `CampusUser` stores the local copy of 42 campus data and links to a Django `User` when available.
- `CoalitionScoreSnapshot` and `CampusUserScoreSnapshot` preserve historical rankings by day.
- `UserPreferences` stores per-user UI and privacy settings.
- `FriendsList` tracks social lists and friend requests.
- `SyncMetadata` stores the last successful synchronization timestamp.

## Features List

- OAuth-based login and protected application shell. Main contributors: Fernando Morenilla, Luis Ayala.
- 42 campus synchronization, coalition ingestion, ranking recomputation, and daily snapshots. Main contributors: Augusto Jesus Rodriguez Linares.
- Coalition dashboards and score visualizations. Main contributors: GGasset, Augusto Jesus Rodriguez Linares.
- User preferences, custom avatars, and profile-related storage. Main contributors: Luis Ayala.
- Achievements and gamification storage. Main contributors: Francisco J Vizcaya, GGasset.
- Chat and social surfaces in the project structure. Main contributors: GGasset, Fernando Morenilla.
- Status page and backend health visibility. Main contributors: Fernando Morenilla, Augusto Jesus Rodriguez Linares.
- PWA support with offline fallback, installability, and cached assets. Main contributors: Fernando Morenilla.

## Modules

The documented optional module implemented in this repository is:

1. Custom Major - Campus Data Sync and Temporal Snapshot Engine (+2 points)

Why it was chosen:

- The project depends on continuously changing 42 data.
- The team needed resilience against API rate limits and temporary failures.
- Historical snapshots are required for rankings and analytics.

How it was implemented:

- OAuth token handling and request pacing for the 42 API.
- Paginated sync pipelines for users and coalitions.
- Upsert-based persistence into local models.
- Daily score snapshots for users and coalitions.
- Cron-driven execution inside the backend container.

Main contributors:

- Augusto Jesus Rodriguez Linares

Repository evidence:

- `backend/sync/services.py`
- `backend/sync/management/commands/sync_campus_users.py`
- `backend/cron_scheduler/apps.py`
- `backend/sync/models.py`

2. Real-time Features - Game Events (+2 points)

The multiplayer game and its invitations use Django Channels instead of browser
polling. HTTP endpoints remain authoritative for commands, while WebSockets
broadcast state changes immediately to both players.

Implementation highlights:

- JWT authentication from the existing HttpOnly access-token cookie.
- A private channel group for each authenticated user.
- Redis-backed channel layers for multi-process event delivery.
- Real-time invitation, acceptance, move, forfeit, rematch, and friendship events.
- Heartbeats and exponential client reconnection.
- No private move choices are included in WebSocket event payloads.

Repository evidence:

- `backend/authentication/websocket.py`
- `backend/games/consumers.py`
- `backend/games/events.py`
- `backend/games/routing.py`
- `frontend/lib/gameSocket.ts`
- `frontend/components/GameNotifications.tsx`
- `frontend/app/games/page.tsx`

3. Complete Web-based Game (+2 points)

PPTLS supports live matches between two authenticated friends. Invitations,
hidden choices, scoring, win conditions, forfeits, rematches, rounds, and match
state are validated and persisted by Django.

Repository evidence:

- `backend/games/models.py`
- `backend/games/services.py`
- `backend/games/views.py`
- `backend/games/tests.py`
- `backend/games/test_websockets.py`
- `frontend/app/games/page.tsx`

## Individual Contributions

### Fernando Morenilla

- Frontend app shell and layout
- PWA registration and offline behavior
- Public legal pages and footer accessibility links
- Status and UI integration work

### Augusto Jesus Rodriguez Linares

- 42 synchronization pipeline
- Cron registration and scheduled execution
- Snapshot persistence and ranking recomputation
- Backend health and sync metadata

### GGasset

- Coalition-facing and product-facing UI work
- Feature integration across the interface
- Support for gameplay and visualization surfaces

### Luis Ayala

- User data and preferences models
- Social relationships and avatar-related persistence
- Backend support for user-facing customization

### Francisco J Vizcaya

- Achievement and supporting backend structures
- Feature integration and validation work
- Shared implementation support for the broader project

### Challenges and how they were handled

- 42 API throughput and volatility were handled with pagination, retries, and pacing.
- Historical ranking data was handled with daily snapshot tables and indexed relationships.
- Offline usability was handled with a precached app shell and a dedicated fallback page.
- Installation readiness was handled with a manifest, standalone display mode, and cached icons.

## Compliance Notes

- The repository includes public Privacy Policy and Terms of Service pages linked from the app footer.
- The application includes a web manifest and service worker for PWA installation and offline support.
- The documentation in `doc/` complements this README with architectural and functional references.
