# Authentication

> Status: **implemented.** Access control is a single static token
> (`MAGENTIC_API_TOKEN`, default `example-token`) checked directly in nginx (the
> token is `envsubst`-rendered into the config and matched with a `map`). Every
> `/api` (including the `/api/stream` SSE status route) and `/mcp` request is
> checked; there is no unauthenticated path. This
> document is the reference for the design and its rationale.

## Goal and threat model

Today every endpoint behind the nginx front door is reachable without
credentials. That is fine while the published port (`FRONTEND_HTTP_PORT`, default
`8080`) is bound to `localhost` on a single-user machine — the only "client" is
the operator and their local agent.

The risk appears the moment the port is **exposed beyond localhost** (to let a
remote agent reach `/mcp`, or because the host is on a shared network). At that
point:

- `/mcp` is open to anyone — they can read the entire code graph.
- `/api/*` is open too, including **mutating** endpoints (`/api/graph/index/*`,
  reset/reindex). These run on the same nginx and the same port as `/mcp`, so
  exposing the port for agents exposes the write endpoints as well.

The goal is therefore: **make it safe to expose the port**.

Non-goals (for v1): multi-user accounts, login sessions, per-client scopes,
token expiry/rotation automation, OAuth. See [Future](#future-db-backed-keys).

## Decision: a single static token, always enforced

- One shared secret, provided as an environment variable `MAGENTIC_API_TOKEN`,
  defaulting to `example-token`. There is always a token; there is no
  unauthenticated path.
- Every request to a protected path is checked: a matching
  `Authorization: Bearer <token>` passes, anything else gets `401`. An empty
  configured token never authorizes (it fails closed, not open).
- No database, no user table, no expiry logic. Rotation = change the variable and
  restart. This is the right size for a self-hosted, single-user tool.

### Protected surface

| Path | Protected | Why |
| --- | --- | --- |
| `/mcp` | **Yes** | the agent-facing endpoint; primary remote-access vector |
| `/api/*` | **Yes** | includes the mutating index/reset endpoints |
| `/api/health` | No | used by orchestration/health checks |
| `/` (SPA assets) | No | static HTML/JS/CSS, not sensitive (see below) |

Protecting only `/mcp` is **not** sufficient: exposing the port for agents also
exposes the `/api` write endpoints, so both must be gated.

### Rotation behavior

The token is read from the environment **once, at process/container start**, so
changing it is not a live operation:

- Editing `.env` from `abc` to `xyz` on a running stack does nothing until the
  enforcing component is recreated/restarted (`docker compose up -d`). Which
  component depends on the enforcement choice below: the **frontend** container
  for nginx-native, or the **backend** (and/or MCP) service otherwise.
- After that restart it is a **hard cutover**: `abc` is rejected (`401`)
  immediately and `xyz` is required. A single static token has **no grace
  period, no overlap, and no expiry** — that machinery is deliberately omitted.
- Every client breaks at once and must be updated: each agent's MCP client config
  (new bearer header) and the browser UI (re-enter the token in Settings; it will
  start getting `401` and prompt). There are no sessions to invalidate — auth is
  per request.

If zero-downtime rotation is ever needed (accept both `abc` and `xyz` during a
changeover window, then drop `abc`), that is exactly what the **list of tokens**
tier provides, as a clean upgrade from the single-token design.

## The token must be provided at runtime, never baked into the image

The secret is **never** compiled into any image or the frontend bundle. It is
supplied at run time as an environment variable and flows in through
`docker-compose` / the operator's `.env`, exactly like the existing
`NEO4J_PASSWORD` etc. Generate one with e.g. `openssl rand -hex 32`.

This is what keeps the token a real secret even though the browser UI needs it
(next section): nothing public ever contains it.

## How each consumer obtains the token ("token fetch")

There are two kinds of client, and the token reaches them differently.

### Machine clients (agents) — the `/mcp` consumers

MCP over Streamable HTTP is plain HTTP, so the **standard** credential mechanism
is the `Authorization` header — there is no Magentic-specific handshake and **no
new tool or endpoint**. The agent does not fetch the token from the server (that
would be circular and leak the secret); the operator provisions it out of band by
copying it from `.env` into the agent's own MCP client config. The client reads
it from that config on startup and attaches it to every `/mcp` request (the
transport is stateless, so it is validated on the very first call; a wrong or
missing token yields `401` and the agent reports the server as unavailable).

```bash
# Claude Code
claude mcp add --transport http magentic http://localhost:8080/mcp \
  --header "Authorization: Bearer <token>"
```

```json
// JSON form (Codex / Antigravity style)
{
  "mcpServers": {
    "magentic": {
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

On a `401`, the server may optionally return `WWW-Authenticate: Bearer` (the
standard HTTP convention); it is not required for a static token. The full MCP
OAuth 2.1 flow is the alternative for dynamic credentials, but is out of scope
here — see [Future](#future-db-backed-keys).

### The browser UI — the `/api` consumer

This is the subtle part. The SPA also calls `/api`, so it needs the token — but
**it is entered at run time, not embedded at build time**:

1. The SPA is served as static assets (no token inside).
2. A **Settings → API token** field lets the operator paste the token once; it is
   stored in `localStorage` on that machine.
3. The SPA attaches `Authorization: Bearer <stored-token>` to every `/api` call.

Because the token is typed in at run time and lives only in the operator's own
browser storage, an attacker who loads the exposed SPA gets the static assets and
**no token** — their `/api` calls return `401`. The token is "public" only if it
is hardcoded into the shipped bundle, which this design explicitly forbids.

### Convenience: a connection helper (proposed)

To smooth distribution, the UI can render a ready-to-copy MCP client config
snippet (endpoint + bearer header) on a connection/settings page, built from the
token the operator just entered. The backend never has an endpoint that *returns*
the secret — that would be circular and leak-prone; the UI only ever echoes what
the operator typed.

## Where the check runs — nginx compares the token directly

nginx does the whole check itself, with no backend involvement. The token is
substituted into the nginx config at container start with `envsubst`, then a
`map` matches the `Authorization` header against it:

```nginx
map $http_authorization $auth_ok {
    default 0;
    "Bearer ${MAGENTIC_API_TOKEN}" 1;
}
# in /api/ and /mcp:
if ($auth_ok = 0) { return 401; }
```

Implemented across:

- `services/frontend/nginx.conf.template` — the `map` plus `if ($auth_ok = 0)
  { return 401; }` on `/api/` and `/mcp`. `/api/health` and `/` have no check.
- `services/frontend/entrypoint.sh` — runs `envsubst '${MAGENTIC_API_TOKEN}'`
  (only that variable, so nginx's own `$host`/`$http_authorization` are left
  intact) to render the template, then execs nginx.
- `docker-compose.yml` — `MAGENTIC_API_TOKEN` is set on the **frontend** service
  (default `example-token`). No other service reads it.

The token is injected as runtime env and rendered into the config inside the
running container; it is never built into the image, so the same registry image
serves every deployment. Rotation = edit the token and recreate the frontend
container (`docker compose up -d magentic_frontend`); `restart` is not enough
(it reuses the container's original env).

nginx is in the request path in **both dev and prod**, so the gate behaves
identically everywhere. The dev frontend runs the same nginx serving built assets
kept fresh by `vite build --watch` (`services/frontend/Dockerfile` `dev` target)
instead of the Vite dev server — trading HMR for dev/prod parity and one
always-on checkpoint.

Trade-offs of doing it in nginx (vs a backend `auth_request`): the comparison is
plain string equality, not constant-time (a non-issue for a static bearer token
over the network), and there is no unit-testable function — the `e2e/core/auth.test.ts`
gate test covers the behaviour instead. In exchange there is zero backend auth
code and no per-request subrequest.

## What was implemented

- `MAGENTIC_API_TOKEN` in `.env.example` (`example-token`), set on the frontend
  service in `docker-compose.yml` (default `example-token`). No unauthenticated
  path: an unset/empty token renders `"Bearer "`, which no real request matches,
  so everything fails closed.
- nginx enforces on `/api/*` (except `/api/health`) and `/mcp`; `/` stays open.
  Dev and prod run the same nginx, so they are gated identically.
- SPA: a central `packages/site/src/lib/api.ts` (`apiFetch` + token store) sends
  the token from `localStorage`; **Settings → Activate the MCP Server** has an API
  token field and a connection snippet that includes the bearer header.
- `README.md` documents exposure guidance and the `Authorization: Bearer` header
  per client; `docs/architecture_mcp.md` cross-references the gate.
- Tests: `e2e/core/auth.test.ts` asserts `/api` + `/mcp` reject without/with a
  wrong token and accept the right one, and that `/api/health` and `/` stay open.
  The whole suite runs against a token stack:

  ```bash
  npm run e2e:stack:up    # frontend gets example-token by default
  npm run test:e2e:fixture
  ```

## Future: database-backed keys

If Magentic ever needs multiple clients, revocable per-client keys, or expiry,
the path is: a Postgres table of hashed keys + issue/revoke endpoints + a
management UI. That reintroduces a backend check (the nginx `auth_request`
pattern fits) since a `map` can't do database lookups. OAuth 2.1 (the MCP spec's
full authorization flow) is only worth it for a genuinely multi-user deployment.
