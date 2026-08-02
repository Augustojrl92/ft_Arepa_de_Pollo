# Email / password authentication — implementation checkpoint

Status as of 2026-08-01. Flow A ("email/password as a second, independent
credential provider") is implemented and **confirmed working against real 42
accounts** — see "Proven in the running app" below.

**Git state:** the implementation is committed as `2f570c0` *(Implement email and
password login system. TRELLO: GCC-84)*. Everything under "Post-commit fixes" is
**uncommitted working-tree state and has already been lost once** to a
`git reset --hard` — commit it before any rebase or reset.

## What this is

Two independent authentication providers feeding one credential-agnostic
session layer:

- **42 OAuth** — unchanged, still works exactly as before.
- **Email / password** — never contacts 42. Registration, email verification,
  login, password reset and password change all authenticate against a password
  we store and verify ourselves.

Both issue the same JWT HttpOnly cookies through `_set_auth_cookies`, and both
converge on the same `User` row (`username` is always the 42 login, which is what
`OAuth42CallbackView` looks accounts up by).

Matching the email against the campus roster is an **authorisation** rule about
who may hold an account — not part of authentication.

## Done

### Backend

| File | Contents |
|---|---|
| `authentication/serializers.py` | Register / Login / VerifyEmail / SetPassword / PasswordReset(+Confirm). Runs `validate_password` against `AUTH_PASSWORD_VALIDATORS` |
| `authentication/tokens.py` | Stateless `EmailVerificationTokenGenerator`; `is_active` in the hash makes links single-use |
| `authentication/emails.py` | Verification, reset and "you already have an account" emails |
| `authentication/views.py` | `RegisterView`, `VerifyEmailView`, `EmailLoginView`, `PasswordSetView`, `PasswordResetRequestView`, `PasswordResetConfirmView`. OAuth callback now also activates unverified accounts |
| `authentication/models.py` | `RegistrationInvite` (email → campus_login), so every account still resolves to a `CampusUser` |
| `authentication/migrations/0012_…` | Invite model + partial unique index on `LOWER(auth_user.email)` |
| `authentication/urls.py`, `admin.py` | Routes grouped by provider; invite admin |
| `config/settings/*` | Argon2id first, min password length 10, scoped throttles, email backends, 24h link timeout |
| `.env.example` | SMTP + `PASSWORD_RESET_TIMEOUT` vars |

**Session revocation** (`token_blacklist`, added 2026-08-01): refresh tokens
rotate on every use and the replaced one is blacklisted. `AuthLogoutView`
blacklists the presented refresh token, and both password-change paths revoke
every outstanding session for the user before issuing a new one. Logout and
"change my password" now actually end sessions instead of only clearing cookies.

**Tests: `authentication/tests.py` — 20 passing** (`manage.py test authentication`).
Covers cold signup without OAuth, Argon2 hashing + distinct salts, generic
responses for ineligible emails, weak-password rejection, single-use links,
login blocked until verified, identical errors for wrong-password vs
unknown-email, rate limiting, complete profile for a password account, reset
round trip, password change requiring the current password, logout revocation,
refresh rotation burning the previous token, and password change killing
sessions on other devices.

### Frontend

- `app/login/page.tsx` — email/password form **first**, 42 button below.
- `app/register/`, `app/verify-email/`, `app/reset-password/`, `app/reset-password/confirm/`
- `app/users/_components/PasswordSettings.tsx` — add/change password, wired into the config modal.
- `components/AuthForm.tsx` — shared shell/field/submit/feedback.
- `lib/passwordRules.ts` — client mirror of the backend policy.
- `lib/authApi.ts` — new endpoints + DRF field-error surfacing.
- `components/AuthLayout.tsx` — new routes added to `PUBLIC_ROUTES` (without this the
  registration flow is unreachable for logged-out visitors).

`npx tsc --noEmit` clean; `npx next build` succeeds with all four new routes.

## Two repo fixes made along the way

1. **Deleted** `backend/authentication/migrations/0010_merge_20260403_1632.py` —
   untracked, empty, duplicated `0010_merge_20260330_1307`, and created a second
   leaf node.
2. **Added** `backend/sync/migrations/0017_merge_20260731_2025.py` — `main`
   already had two leaf migrations in `sync` (`0016_campususer_last_active_time`
   and `0016_merge_projects_evaluations`, both committed via PRs #32/#34), which
   made `manage.py migrate` **fail on any clean checkout**. This is a
   pre-existing bug, not caused by this work.

## Live verification (2026-08-01) — all passing

Run against the dev stack over real HTTP, no test client. A demo `CampusUser` is
seeded for this: `intra_id=999001`, `login=demostudent`,
`email=demostudent@student.42madrid.com`.

| # | Check | Result |
|---|---|---|
| 1 | Cold register, no OAuth | `202` generic response |
| 2 | Weak password via curl, bypassing the UI | `400` listing all three backend rules |
| 3 | Login before verification | `403 email_not_verified` |
| 4 | Verify email | `200 Email verified` |
| 5 | Login with email + password only | `200`, `access_token` + `refresh_token` set **HttpOnly** |
| 6 | Authenticated `/api/auth/profile/` with that session | `200`, full profile: `login=demostudent`, `intra_id=999001`, `campus_user_rank=1` |
| 7 | Wrong password vs unknown email | byte-identical `{"error":"Invalid email or password"}` |
| 8 | Replay the verification link | `400` — single use confirmed |
| 9 | 15 rapid login attempts | `401`×7 then `429`×8 |
| 10 | Two accounts, identical password | different Argon2id hashes — salting confirmed |
| 11 | `get_or_create(username='demostudent')` as the OAuth callback does | **no new row**; found the registered account with its usable password — convergence confirmed |

Stored hash format: `argon2$argon2id$v=19$m=102400,t=2,p=8$<salt>$<digest>`.

## Post-commit fixes (UNCOMMITTED — commit these first)

Five defects found by running the app for real, plus the mail and LAN setup.
All of this was destroyed once by a `git reset --hard` and re-applied by hand.

### 1. "Add a password" was broken for every OAuth account — the important one

`OAuth42CallbackView` creates accounts with `User.objects.get_or_create(...)`,
leaving `password=''`. Django's `is_password_usable('')` returns **True** — only
`None` and `'!'`-prefixed hashes count as unusable. So `has_usable_password()`
claimed the account had a password while `check_password()` could never match.

`SetPasswordSerializer` branched on exactly that, demanding a `current_password`
no input could satisfy. Every account created through 42 — all of them — was
permanently unable to add a password.

- `serializers.py` — new `has_password_set()`; a blank password means "none set".
- `views.py` — the callback calls `set_unusable_password()` on blank accounts, so
  existing rows self-heal on the next 42 login.
- `tests.py` — the test used `set_unusable_password()`, which is **not** what the
  callback produces, which is why it passed. It now reproduces the real
  empty-string state and pins the quirk with an explicit assertion.

**Verified live:** `fvizcaya` now shows `password='!vCFfuF7uvVLaqmC'` and
`has_password_set=False`, i.e. the account can add a password from Settings.

### 2. Failed OAuth logins were invisible

`_redirect_with_error` produced a bare `302`, and the login page recognised only
three error codes — everything else hit `default: break` and rendered nothing.
Now logged server-side, and the frontend shows unrecognised errors verbatim.

### 3. Rejected registrations were invisible

An ineligible email returns the same generic `202` as success (deliberate — it
stops roster enumeration), but nothing was logged either. `RegisterView` now logs
a warning. **This is what finally diagnosed the "no confirmation email" report.**

### 4. A failed send left an orphaned account

Registration committed the user, then sent the email. A delivery failure left an
inactive account whose owner could never re-register. The send now happens inside
the transaction, so a failure rolls the registration back.

### 5. `AuthTokenRefreshView` returned 500 instead of 401

`serializer.is_valid()` was called without catching `TokenError`, which simplejwt
raises (it is not a DRF `ValidationError`) for expired, malformed or blacklisted
tokens. Exposed by enabling the blacklist. Now caught.

## Email in development — no MTA required

The `mailpit` compose service is a catch-all SMTP server: Django performs a real
SMTP conversation against it and every message is captured rather than delivered.
No mail transfer agent, no third-party account, nothing leaves the machine.

**Inbox: http://localhost:8025**

`config/settings/dev.py` points at `mailpit:1025`, every value overridable from
`.env`. Production swaps `EMAIL_HOST` to a real relay with no code change.
Set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` to read
emails in the container logs instead.

Mailpit keeps messages in memory — a container restart empties the inbox.

## External / LAN access

Testing from another machine needs four things aligned. Three are code, one is
`.env`:

| Piece | Where |
|---|---|
| `ALLOWED_HOSTS=*` | `.env` (repo root) |
| `CORS_ALLOW_ALL_ORIGINS=True` | `.env` (repo root); read by `settings.py` (also `CORS_EXTRA_ORIGINS` for a named list) |
| `allowedDevOrigins` | `frontend/next.config.ts` — Next rejects cross-origin dev requests without it |
| `NEXT_PUBLIC_API_URL` | repo-root `.env` (compose substitutes it) — must be the **server's LAN IP** |

Plus `FRONTEND_URL` and `FT_REDIRECT_URI` in `.env` (repo root) pointing at the LAN IP.

**Open the frontend on the same host as the API** (`http://<lan-ip>:3000`, not
localhost). The API address is compiled into the browser bundle; serving the page
from localhost while calling a LAN API makes the auth cookies cross-site and
`SameSite=Lax` refuses to store them.

**The LAN IP changes** (campus DHCP — it moved from `10.19.253.96` to
`10.19.200.165` mid-session). Three places to update: root `.env`,
`FRONTEND_URL`, `FT_REDIRECT_URI`. The LAN callback URI must also be registered
on the 42 intra application, or 42 rejects the authorize request.

`ALLOWED_HOSTS=*` and `CORS_ALLOW_ALL_ORIGINS=True` are testing-only and must not
reach production. Both are commented as such in `.env`.

## Proven in the running app (2026-08-01)

Not test-client — real requests from a browser against the dev stack:

```
20:07:24  POST /api/auth/register/      202   -> "Confirm your AEDLPH account" delivered
20:07:46  POST /api/auth/verify-email/  200   <- link clicked, account activated
20:07:46  POST /api/auth/verify-email/  400   <- replay correctly rejected (single use)
```

The account ended up `is_active=True` with an `argon2$argon2id$` password. The
duplicate `400` is React StrictMode double-firing the effect in dev; the
`hasRunRef` guard catches most of it and the first request wins, so the user sees
success. It does not happen in production.

**42 OAuth is confirmed working** after the credential repair — two `CampusUser`
rows were created by successful callbacks.

## Operational incidents worth remembering

**The database was wiped three times.** `make back-re` is safe
(`BACK_RM_VOLUMES` defaults to empty, so only containers are removed). The
destructive one is **`make fclean`** → `docker compose down --volumes --rmi all`.
Consider adding a confirmation prompt to it.

**After any wipe you must re-sync the roster:**

```bash
make back-syncapi MODE=full     # ~2 min, 2286 users, 4 coalitions, 56 API requests
```

Otherwise `CampusUser` is empty, every registration is silently rejected as
ineligible, and the only symptom is "confirmation emails stopped working". This
cost an hour before the logging in fix #3 made it obvious.

**Restoring from backup works and was used in anger.** The automated backups saved
a full roster; `make db-restore BACKUP_FILE=...` recovered 2288 users with ~6
minutes of data loss. Backup file size is the quickest health signal — a real
dump is ~216K, an empty database ~526 bytes. This is the health-check/backup
module doing its job on real data, which is a far better evaluation story than a
staged demo.

**Migrations:** `sync` accumulated two competing `0017` merge migrations (two
people fixed the same `0016` conflict independently). `0018_merge_20260801_1940`
reconciles them and `migrate --check` is clean. Leave it alone.

## To pick up next

- [ ] **COMMIT THE WORKING TREE FIRST.** Nine files are modified and two
      untracked (`.env.example`, `sync/migrations/0018_merge_20260801_1940.py`).
      This exact set was already destroyed once by a `git reset --hard`, and the
      reflog shows several rebase attempts. Uncommitted work is not recoverable.
- [ ] **Browser click-through** — the one thing not machine-verifiable here. All
      five routes return `200`, but the app renders client-side only
      (`AuthLayout` returns `null` until the zustand store hydrates), so SSR
      output is an empty body for every page including the original `/login`.
      Needs a human to confirm layout and **no console errors** (mandatory
      requirement).
- [ ] `SECRET_KEY` is **absent** from `.env` (repo root), so Django uses the
      `"insecure-dev-key"` fallback committed in `settings.py` — the source of
      the 16-byte PyJWT warning on every request. Adding it invalidates every
      session and any pending verification/reset links, so pick the moment.
- [ ] Add `mailpit` to the relevant `Makefile` targets. It is in the compose
      file so plain `docker compose up` starts it, but targets naming services
      explicitly will skip it. Host port **8025** is now in use.
- [ ] Consider a confirmation prompt on `make fclean`, and a Mailpit volume if
      losing the inbox on restart becomes annoying.
- [ ] Watch for multi-tab refresh races. With rotation on, if two tabs refresh
      at once the loser gets a `401` and is signed out. `authApi.ts` de-duplicates
      concurrent refreshes, but only within a single tab. Not observed in
      practice; worth knowing if anyone reports random logouts.
- [ ] Remove or keep the seeded `demostudent` fixture (`intra_id=999001`,
      `demostudent@student.42madrid.com`) depending on whether you want it for
      the evaluation demo. It currently has a registered, unverified account.
- [ ] README: there is still **no `README.md` at the repo root**, which the
      subject requires. Draft sections are in `doc/README-auth-sections.md`,
      including a scoring warning: **email/password auth is mandatory, not a
      module, and earns 0 points.** 42 OAuth is the 1-point minor module.
- [ ] Team walkthrough — everyone must be able to explain this at evaluation.

## Defending it

**Opening line:** two independent authentication providers, one
credential-agnostic session layer.

**Demo order — email/password FIRST, OAuth second.** Leading with the 42 button
concedes the argument before you speak.

1. Fresh incognito, network tab open. Show the login page: two doors.
2. Register cold → verification link from the logs → verify → dashboard.
   **Show the network tab: zero requests to `api.intra.42.fr`.** That frame is
   the whole defense.
3. Log out, clear cookies, log in with email + password only.
4. `manage.py shell` → print `user.password` → `argon2$argon2id$v=19$m=…`.
   Print two users with the *same* password → different hashes. That is the salt.
5. Reject a weak password in the UI, then repeat with curl to prove the backend
   is the authority.
6. Hammer the login endpoint → `429`.
7. Register as X, then OAuth as X → one `User` row.

**Anticipated questions**

| Attack | Answer |
|---|---|
| "OAuth comes first, this isn't a real login system" | Run the cold demo. Authentication vs authorisation: the roster check decides eligibility, not identity proof. Slack/GitHub Enterprise/invite-only betas all work this way |
| "Why can't I register any email?" | Product scope. Not architectural — show `RegistrationInvite`, add an email live, register |
| "Where is the hashing?" | `set_password()` → Argon2id via `PASSWORD_HASHERS`. Name the hash segments: algorithm / version / params / salt / digest |
| "What stops brute force?" | Scoped throttles (show the `429`), generic errors, dummy-hash timing equalisation in `EmailLoginView` |
| "What if I steal the JWT?" | HttpOnly + Secure + SameSite, 15-min access lifetime. Be honest: XSS is the residual risk, which is why nothing is in localStorage |
| "Can you kill a session?" | Yes. Refresh tokens rotate and the replaced one is blacklisted; logout blacklists the presented token; a password change revokes every outstanding session. Demo it: log in, log out, replay the refresh token → `401` |
| "Is the verification token guessable?" | HMAC over `SECRET_KEY`, pk, password hash, `last_login`, `is_active`, timestamp. Time-limited and single-use |
| "Two people register the same email at once?" | DB-level partial unique index, not just a serializer check |
| "How do you send email without a mail server?" | We don't run an MTA. Mailpit is a catch-all SMTP server in the compose stack — a real SMTP conversation, captured rather than delivered, inbox at :8025. Production swaps `EMAIL_HOST` to a relay via `.env` with no code change. Delivering to Gmail from a laptop would be refused anyway (residential IP, no PTR/SPF/DKIM) |
| "User enumeration?" | Generic responses everywhere — a deliberate trade-off against UX, stated as such |
| "Why is `username` the 42 login, not the email?" | Convergence. Show `OAuth42CallbackView`'s `get_or_create(username=login)` — using the email would silently create duplicate identities |

**Prepare for the live modification.** Likely asks: change the minimum password
length (`AUTH_PASSWORD_VALIDATORS` in `config/settings/settings.py` +
`PASSWORD_MIN_LENGTH` in `frontend/lib/passwordRules.ts`), change a throttle rate
(`DEFAULT_THROTTLE_RATES`), or add a registration field (`RegisterSerializer`).
