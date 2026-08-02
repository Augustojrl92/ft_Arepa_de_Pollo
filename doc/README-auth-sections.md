# README sections — authentication

Draft text ready to merge into the project `README.md`. There is currently no
`README.md` at the repo root; the subject requires one, so these are written as
sections to drop into it rather than a standalone document.

**Fill in the `<login>` placeholders** with whoever actually did each piece — the
subject requires per-member attribution, and inventing it would be worse than
leaving it blank.

---

## Scoring: read this before claiming points

Be careful not to overclaim at evaluation:

- **Email + password authentication is a mandatory requirement, not a module.**
  The subject lists it under Technical requirements ("Users must be able to sign
  up and log in securely… at minimum email and password authentication with
  proper security"). It earns **0 module points**. What it does is stop the
  project being rejected.
- **42 OAuth is the minor module** "Implement remote authentication with OAuth
  2.0" — **1 point**.
- The **Standard user management** major module (2 points) covers profile
  editing, avatar upload, friends with online status, and a profile page. Claim
  it on the strength of those features, not on the login form.

---

## Technical Stack (authentication rows)

| Layer | Choice | Why |
|---|---|---|
| Session transport | JWT in HttpOnly cookies (`djangorestframework-simplejwt`) | Tokens are never reachable from JavaScript, so an XSS bug cannot exfiltrate a session. A custom `CookieJWTAuthentication` accepts either the `Authorization` header or the cookie. |
| Password hashing | Argon2id (`argon2-cffi`) | Memory-hard, the current OWASP recommendation. Django keeps the older hashers registered so legacy hashes stay verifiable and upgrade on next login. |
| Password policy | Django `AUTH_PASSWORD_VALIDATORS` | Minimum 10 characters, plus similarity, common-password and numeric-only checks. Enforced server side on every request; the frontend mirrors the rules for immediate feedback only. |
| Rate limiting | DRF `ScopedRateThrottle` | Applied only to credential endpoints: register 5/h, login 10/min, verify 10/h, reset 5/h. |
| Email links | Django's signed token generators | Stateless HMAC over `SECRET_KEY` + user state; nothing stored server side, links expire in 24h and are single-use. |
| Session revocation | `simplejwt.token_blacklist` | Refresh tokens rotate on use and the replaced token is blacklisted, so logout and password changes genuinely end sessions. |

## Features (authentication)

| Feature | Description | Author |
|---|---|---|
| 42 OAuth sign-in | Authorization-code flow against `api.intra.42.fr` with CSRF `state` validation, restricted to campus 22 (42 Madrid). Creates and links the account on first use. | `<login>` |
| Email + password registration | Sign up with email and password. Eligibility is checked against the campus roster synced from 42, or an admin-issued invite. Always answers generically so the endpoint cannot be used to enumerate the roster. | `<login>` |
| Email verification | Signed 24h single-use link; the account stays inactive until confirmed, then is signed in automatically. | `<login>` |
| Email + password login | Independent of 42 — never contacts the intra API. Generic errors and dummy-hash timing equalisation so failures do not reveal whether an account exists. | `<login>` |
| Password reset | Request → emailed signed link → set a new password. Revokes every existing session. | `<login>` |
| Add / change password | Accounts created through 42 start without a password and can add one from settings, gaining a second independent way to sign in. | `<login>` |
| Session revocation | Logout blacklists the refresh token; changing a password revokes sessions on every device. | `<login>` |

## Database Schema (authentication)

Django's built-in `auth_user` is the single source of truth for identity. There
is no custom user model.

- **`auth_user`** — `username` always holds the **42 login**, never the email.
  This is what makes both sign-in paths converge on one row: the OAuth callback
  resolves accounts with `get_or_create(username=<42 login>)`, so an account
  created by email registration is found rather than duplicated. A partial
  unique index on `LOWER(email) WHERE email <> ''` enforces one account per
  address at the database level (Django's `User.email` is not unique, and a
  serializer check alone races).
- **`sync_campususer`** — the real profile (coalition, points, ranks, level,
  avatar), synced from 42. `django_user` is a nullable one-to-one to `auth_user`.
  Every account, however it was created, links to one of these — which is why a
  password account lands on a fully populated dashboard rather than an empty
  shell.
- **`authentication_registrationinvite`** — `email` (unique) → `campus_login`,
  with `created_by` and `used_at`. Authorises one address to register as a named
  campus identity. Covers students whose intra email is missing from the sync or
  who want to use a different address.
- **`token_blacklist_outstandingtoken` / `_blacklistedtoken`** — issued and
  revoked refresh tokens.

## Instructions (authentication setup)

Copy `.env.example` to `.env` at the repo root and fill in:

```bash
# 42 OAuth
FT_CLIENT_ID=...
FT_CLIENT_SECRET=...
FT_REDIRECT_URI=http://localhost:8000/api/auth/42/callback/

# Session cookies — set both to production values when deploying over HTTPS
JWT_COOKIE_SECURE=False
JWT_COOKIE_SAMESITE=Lax

# Email delivery for verification and password reset links.
# Development prints emails to the container logs instead of sending them.
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=...
EMAIL_PORT=587
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=AEDLPH <no-reply@aedlph.local>

# Lifetime in seconds of emailed links
PASSWORD_RESET_TIMEOUT=86400
```

In development, verification and reset links appear in the backend logs:

```bash
make back-logs
```

Run the authentication test suite:

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py test authentication
```

### API endpoints

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/register/` | public |
| `POST` | `/api/auth/verify-email/` | public |
| `POST` | `/api/auth/login/` | public |
| `POST` | `/api/auth/password/reset/` | public |
| `POST` | `/api/auth/password/reset/confirm/` | public |
| `POST` | `/api/auth/password/set/` | authenticated |
| `GET` | `/api/auth/42/login/` · `/api/auth/42/callback/` | public |
| `GET` | `/api/auth/profile/` | authenticated |
| `POST` | `/api/auth/token/refresh/` · `/api/auth/logout/` | public |

## Technical choices worth explaining

**Two providers, one session layer.** 42 OAuth and email/password are
independent authentication providers. Neither is a prerequisite for the other,
and both issue the same JWT cookies through a single code path. A user can sign
up by either door and later gain the second credential; both resolve to the same
account.

**Eligibility is authorisation, not authentication.** Registration requires the
email to be in the campus roster (or invited). That decides *who may hold an
account*, not *how an account proves who it is* — the password is stored and
verified entirely by us. This is the same pattern as a domain-restricted Slack
workspace or an invite-only beta.

**Generic responses over helpful ones.** Registration and password reset answer
identically whether or not the address exists, and login returns one error for
both a wrong password and an unknown email. This is a deliberate trade-off: it
costs some clarity for the user who mistypes their address, and buys protection
against using these endpoints to enumerate the 42 Madrid roster.

## Known limitations

- Registration is limited to 42 Madrid students. People outside the roster
  cannot create an account without an admin invite. This is intentional scope,
  but it means an evaluator from another campus cannot self-register.
- With refresh-token rotation enabled, two browser tabs refreshing
  simultaneously can sign the user out. Concurrent refreshes are de-duplicated
  within a tab but not across tabs.
