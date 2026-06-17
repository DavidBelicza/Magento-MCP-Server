# End-to-end tests

These tests drive a **running Magentic stack** over HTTP and assert against the
real backend, MCP endpoint, and Neo4j graph. They are deliberately separate from
the unit tests (`packages/*/__tests__/`) and are not part of `npm test`.

## Running

Start a stack, then run the suite:

```bash
npm run docker:up
npm run test:e2e
```

By default the tests target `http://localhost:8080`. Override the target with an
environment variable:

```bash
MAGENTIC_E2E_BASE_URL=http://localhost:9090 npm run test:e2e
```

The source/links suite indexes a single real module from the mounted source
rather than the whole vendor tree (scoped via the `directories` body of
`/api/graph/index/source`, so no config changes are needed). It defaults to
`vendor/magento/module-catalog`; override it for a different source layout:

```bash
MAGENTIC_E2E_SOURCE_MODULE=vendor/magento/module-cms npm run test:e2e
```

## Fixture stack (deterministic, CI-ready)

For exact assertions without a real Magento checkout, an isolated stack mounts
the synthetic fixture in `fixtures/sample-project/` (a tiny hand-authored package —
not a real Composer install) as the analyzed source. It runs alongside the dev
stack on its own ports and volumes:

```bash
npm run e2e:stack:up        # bring up the fixture stack on :8090
npm run test:e2e:fixture    # run against it (MAGENTIC_E2E_FIXTURE=1, :8090)
npm run e2e:stack:down      # tear down + remove volumes
```

In fixture mode the real-module source suite is skipped and
`index-source.fixture.test.ts` runs instead, asserting exact node/edge counts
against the known fixture graph.

## Design

The suite is **environment-driven**: it makes no assumptions about which stack it
talks to beyond the base URL. This is what lets the same tests run against either
the local dev stack or an isolated test stack without code changes.

- Running against the **dev stack** (default) treats its graph as disposable. The
  tests are additive — they trigger package indexing and read the graph, but
  never reset or wipe it.
- For an **isolated stack**, a developer can bring up a second Compose project
  (e.g. a `magentictest`-prefixed env file with its own volumes, ports, and a
  small fixture mounted as the analyzed source) and point `MAGENTIC_E2E_BASE_URL`
  at it. Users who only run the tool never need any of this.

## Current coverage

- `health.test.ts` — backend and backing services are up; graph stats respond.
- `graph-search.test.ts` — read-only Cypher runs; write/admin queries are
  rejected end-to-end by the validation guard.
- `mcp.test.ts` — the `/mcp` endpoint lists the tools and executes
  `graph_search` / `get_graph_schema`.
- `package-indexing.test.ts` — the package indexing job runs queue → worker →
  Neo4j and produces queryable `Package` nodes.
- `source-indexing.test.ts` — scopes source indexing to one module, runs the
  analyzer → worker → Neo4j source path plus `index/links`, and asserts
  version-resilient facts: the module's classes (incl. a known stable class) are
  indexed with methods, inheritance edges, and param/return type edges; the
  composer `Package` node exists with a version; and the module's declared
  symbols are linked to that package via `DECLARED_IN_PACKAGE`.

- `source-indexing.fixture.test.ts` — deterministic source + links assertions
  against the sample fixture (exact class/interface/method counts, the
  single `EXTENDS`/`IMPLEMENTS`/`PARAM_TYPE`/`RETURNS_TYPE` edges, all three
  declared symbols linked to the package, and the composer `require` edge). Runs
  only in fixture mode.

## Two tiers

- **Real module** (dev stack, default): version-resilient assertions against real
  Magento. Good local realism; needs a real source mounted.
- **Fixture** (`magentictest` stack, CI): exact assertions against the committed
  synthetic fixture. Self-contained, no real Magento or Composer auth required —
  this is the tier intended for the GitHub Actions workflow.
