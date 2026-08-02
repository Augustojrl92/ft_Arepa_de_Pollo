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

Then open:

```
https://localhost
```

### HTTPS

Every connection from a browser, a script or an external API goes through an
nginx reverse proxy that terminates TLS. **443 is the only port published to the
host**: the frontend and the backend are reachable on the internal Docker
network only, so there is no plain-HTTP way into the application. Traffic
between containers stays unencrypted, which the subject allows.

The proxy serves everything from a single origin, which is also why the frontend
needs no API URL configured — it calls `/api/...` relative to whatever address
it was loaded from:

| Path | Served by |
|---|---|
| `/api/`, `/admin/`, `/static/`, `/media/` | Django (`backend:8000`) |
| everything else | Next.js (`frontend:3000`) |

Django itself is proxy-aware: `SECURE_PROXY_SSL_HEADER` makes it trust the
`X-Forwarded-Proto` header the proxy sets, so it treats requests as secure and
sets `Secure` cookies. That header can only come from the proxy, since nothing
else can reach the container.

#### Certificates

On first start the proxy generates a **self-signed** certificate into the
`tls_certs` volume. Browsers will warn once — choose *Advanced → Proceed*. That
bypass exists because HSTS is deliberately not enabled; turning it on with a
self-signed certificate removes the click-through and locks you out.

A certificate is only issued when none exists, and the volume survives rebuilds,
so it is not regenerated on its own. Issue a fresh one with:

```bash
make certs-reset
```

Nothing needs editing first. The target works out the names to certify at run
time and passes them to the proxy:

| Source | Example |
|---|---|
| loopback | `DNS:localhost`, `IP:127.0.0.1` |
| machine name (`hostname`) | `DNS:SamGB4Pro`, `DNS:SamGB4Pro.local` |
| current LAN address (`ip route get`) | `IP:172.16.16.112` |

The LAN address is read from the route actually used for outbound traffic, so it
picks the real interface rather than one of the Docker bridges. Override either
part when you need to:

```bash
make certs-reset HOST_IP=10.11.12.13
make certs-reset TLS_SAN=DNS:localhost,IP:127.0.0.1
```

Because the certificate changes, browsers show the warning again the first time.

#### Reaching the app from another machine

Campus addresses are handed out by DHCP and **do change** — so prefer the mDNS
name over the IP:

```
https://<hostname>.local
```

Both are in the certificate, but only the name survives a new lease. This
matters most for OAuth: `FT_REDIRECT_URI` has to match a URI registered on the
42 application byte for byte, so an IP-based one would need re-registering every
time the lease changes, possibly mid-evaluation. Register the `.local` name once
and it keeps working.

To serve the app under that name, point these at it in `.env`:

```bash
FRONTEND_URL=https://<hostname>.local
FT_REDIRECT_URI=https://<hostname>.local/api/auth/42/callback/
CORS_ALLOWED_ORIGINS=https://<hostname>.local
CSRF_TRUSTED_ORIGINS=https://<hostname>.local
```

`NEXT_PUBLIC_API_URL` stays empty — the frontend calls the API relative to
whatever address it was loaded from, so it needs no change.

mDNS resolution requires the *client* to support `.local` names: macOS and most
Linux distributions do out of the box, Windows needs Bonjour installed. The IP
is in the certificate as a fallback for clients that cannot resolve it.

The evaluation-day procedure is therefore just:

```bash
make certs-reset
```

#### Django admin

```
https://localhost/admin/
```

Create the first account with `make back-superuser`.

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

- Configuration lives in `.env` at the repository root; copy `.env.example` to get started.
- `FT_REDIRECT_URI` must be registered verbatim on the 42 application, and now uses `https://`.
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
- Real-time invitation, acceptance, move, forfeit, and rematch events.
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
