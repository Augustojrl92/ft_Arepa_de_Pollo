# Email / password authentication — implementation checkpoint

Status as of 2026-07-31. Flow A ("email/password as a second, independent
credential provider") is implemented on both backend and frontend. Nothing is
committed yet — everything below is working-tree state.

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
| `env.example` | SMTP + `PASSWORD_RESET_TIMEOUT` vars |

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

Verification links are printed to the backend container logs (console email
backend in dev):

```
make back-logs   # or: docker compose -f docker-compose.dev.yml logs backend
```

## To pick up next

- [ ] **Browser click-through** — the one thing not machine-verifiable here. All
      five routes return `200`, but the app renders client-side only
      (`AuthLayout` returns `null` until the zustand store hydrates), so SSR
      output is an empty body for every page including the original `/login`.
      Needs a human to confirm layout and **no console errors** (mandatory
      requirement).
- [ ] Watch for multi-tab refresh races. With rotation on, if two tabs refresh
      at once the loser gets a `401` and is signed out. `authApi.ts` de-duplicates
      concurrent refreshes, but only within a single tab. Not observed in
      practice; worth knowing if anyone reports random logouts.
- [ ] `SECRET_KEY` in `backend/.env` is 16 bytes; PyJWT warns it is below the
      32-byte minimum for HS256. Rotating it invalidates every existing session,
      so pick the moment deliberately.
- [ ] Remove or keep the seeded `demostudent` account depending on whether you
      want it for the evaluation demo.
- [ ] README: modules, features, individual contributions.
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
| "User enumeration?" | Generic responses everywhere — a deliberate trade-off against UX, stated as such |
| "Why is `username` the 42 login, not the email?" | Convergence. Show `OAuth42CallbackView`'s `get_or_create(username=login)` — using the email would silently create duplicate identities |

**Prepare for the live modification.** Likely asks: change the minimum password
length (`AUTH_PASSWORD_VALIDATORS` in `config/settings/settings.py` +
`PASSWORD_MIN_LENGTH` in `frontend/lib/passwordRules.ts`), change a throttle rate
(`DEFAULT_THROTTLE_RATES`), or add a registration field (`RegisterSerializer`).
