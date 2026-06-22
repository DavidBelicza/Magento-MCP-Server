# Plan: Magento XML Indexing

> Status: **planned.** This document is the implementation plan for adding Magento
> XML config (`di.xml` first; `config.xml`, `adminhtml.xml`, `events.xml` later)
> to the graph as a fourth indexing pipeline.

## Goal

Parse Magento's declarative XML config and enrich the existing `:Symbol` graph
with the wiring those files describe — DI preferences and plugins first, then
observers and area config. XML config references classes by **FQN**, which is
already the `:Symbol` node key, so this adds *edges between existing nodes* (with
`defined: false` anchors where a referenced class is not yet declared) rather
than a new node space.

## Design decisions (settled)

- **Node, not PHP.** XML is declarative config with no AST need. It belongs with
  the `composer-lock` family (parsed in Node), not the `php-analyzer` family
  (which exists only for the PHP AST). No new service, no analyzer protocol.
- **One pipeline for all XML kinds.** A single `index-xml` pipeline handles every
  config-XML file, dispatching to a **per-file-type handler** by basename — the
  same way the source pipeline handles many PHP files with one pipeline. The four
  files differ only in parse shape; discovery, area handling, graph writes,
  incremental delete, watcher triggering, and flow ordering are all shared.
- **Most logic lives in `modules/processing/magento-xml/`.** The queue, worker,
  API route, and watcher changes are thin layers that wire into this module.
- **Per-subpath discovery.** XML is discovered under the configured
  `sourceSubpaths` (whole mount when empty), like the source pipeline.
- **Area is first-class.** The same interface can have different preferences per
  area (`adminhtml` overrides `global`), so the area is an **edge property** and
  part of the edge identity hash.

## Module layout — `packages/core/src/modules/processing/magento-xml/`

This is where the work lives. Mirror the shape of `composer-lock/`.

```
modules/processing/magento-xml/
  discovery.ts          # glob patterns + isConfigXml() predicate + area classifier + Area enum
  registry.ts           # basename -> handler map
  handlers/
    di-xml.ts           # di.xml      -> PREFERENCE_FOR, PLUGIN_FOR, DI argument edges
    events-xml.ts       # events.xml  -> observer edges          (later)
    config-xml.ts       # config.xml  -> (evaluate graph value)  (later)
    adminhtml-xml.ts    # adminhtml.xml                          (later)
  build-records.ts      # parsed XML + area -> { nodes, edges } (delegates to handler)
  create-record-hash.ts # edge identity hashing (includes area + sourceFile)
  save-graph.ts         # write + clear-by-sourceFile (incremental-safe)
  types.ts
```

### `discovery.ts` — the shared, dependency-free helper

Must stay pure (string/path only, **no neo4j/fastify**) so the watcher can import
it. Exposes:

- **Glob patterns** (fast-glob): `**/etc/di.xml` and `**/etc/*/di.xml`, extended
  per basename as handlers are added.
- **`isConfigXml(path)`** — basename whitelist predicate.
- **Area classifier** — walk *up* from the file (independent of subpath depth):
  - parent is `etc` → `global`
  - grandparent is `etc`, parent is a known area → that area
  - otherwise → `null` (reject; not a Magento config location)
- **`Area` enum** — `global`, `frontend`, `adminhtml`, `crontab`, `webapi_rest`,
  `webapi_soap`, `graphql`, `setup`. A segment not in this set is rejected.

This is the single source of truth for "is this a config XML, and what area",
imported by the worker, the delta route, and the watcher.

### Handlers (strategy per file type)

Each handler is `(filePath, area, parsedXml) -> { nodes, edges }`. `registry.ts`
maps basename → handler. Adding a new XML kind later is purely additive: add a
handler, register it, add its basename + glob to `discovery.ts`, add an edge
constraint. No queue/worker/flow/watcher change beyond the shared whitelist.

`di.xml` (first handler) emits, with `defined: false` anchors for unknown FQNs:

- `<preference for=I type=C>` → `(I)-[:PREFERENCE_FOR { area, sourceFile }]->(C)`
- `<type name=T><plugin .../></type>` → plugin → target edge with `area`
- `<type>`/`virtualType` constructor `<argument>` object refs → DI wiring edges

## Thin layers

### Queue — `packages/core/src/queue/index-xml.ts`

Mirror `queue/index-source.ts`. `IndexXmlJob` carries `analyzedSourcePath`,
`directories` (snapshotted subpaths), `operation: "index" | "delete"`,
`requestedAt`, `fullIndexFlow?`. Queue name `index-xml`, job `index-xml-job`.

### Worker — `packages/core/src/worker/index-xml-worker.ts`

Thin entrypoint. Resolves each snapshotted directory against the mount, **globs
the discovery patterns**, parses each match, dispatches via `registry`,
accumulates records, calls `save-graph`. For `operation: "delete"`, clears edges
whose `sourceFile` is the path or under it. No parsing logic here.

### API route — `packages/core/src/api/graph/index-xml.ts`

`POST /api/graph/index/xml` ({ "directories": [...] } optional) and
`DELETE /api/graph/index/xml`. Snapshots `sourceSubpaths`/`projectRoot` into job
data at enqueue time (the worker never reads config). Returns `202`.

### Flow ordering — `packages/core/src/api/graph/build-index-flow.ts`

Insert `index-xml` between source and links (xml references symbols, so it runs
after source; links is package-side and stays last). New nested order:

```
reindex:            packages -> source -> xml -> links
reset-and-reindex:  delete-graph -> packages -> source -> xml -> links
```

Concretely: `index-links` (parent) ← `index-xml` ← `index-source` ← ...

### Delta route — `packages/core/src/api/graph/index-delta.ts`

`routeDeltaPaths` currently sends every `.xml` to `skipped`
([index-delta.ts:86](../packages/core/src/api/graph/index-delta.ts:86)). Replace
with `isConfigXml(path)` from `discovery.ts`: matches route to the `index-xml`
pipeline (upsert → re-parse the file; delete → clear by path), everything else
still skipped.

### Watcher — `packages/watcher/src/index.ts`

`buildWatchTargets` currently globs `**/*.php` + `composer.lock`
([index.ts:66](../packages/watcher/src/index.ts:66)). Add a broad `**/*.xml`
glob. The watcher stays deliberately dumb: it does **not** import the discovery
predicate from core (it never has imported core, and doing so would drag core's
runtime deps into the watcher build). It forwards every `.xml` change to the
delta route, which applies `isConfigXml` as the single authority and ignores the
rest. The cost is a few extra paths per batch that the route filters out —
cheap, debounced, and it keeps the predicate in exactly one place.

### Schema — `packages/core/schema/neo4j/007_create_magento_xml_constraints.cypher`

Edge `identity` uniqueness for the new edge types (`PREFERENCE_FOR`,
`PLUGIN_FOR`, ... ), following the existing `001`–`006` pattern. Identity hash =
`hash(from + ":" + TYPE + ":" + to + ":" + area + ":" + sourceFile)` so per-area
edges coexist and a re-parse of one file replaces only its own edges.

## Incremental delete semantics

Each XML edge carries a `sourceFile` property. A re-parsed or deleted file clears
only the edges with that `sourceFile`, so `etc/adminhtml/di.xml` never wipes
edges from `etc/di.xml`. This is the XML analogue of the source pipeline's
"clear outbound edges of `defined` symbols" rule.

## MCP

No code change. `graph_search` exposes the new edges automatically. Update
`packages/mcp/resource/graph-schema.json` with the new edge types, edge
properties (`area`, `sourceFile`), and area enum so agents know they exist.

## Content caveat — `config.xml`

`di.xml` and `events.xml` reference class FQNs and produce real `:Symbol` edges.
`config.xml` is mostly scalar default config and may yield few/no symbol edges —
structurally similar to the scalars/member-nodes the project deliberately
dropped. Decide its graph value when its handler is built; the registry design
lets that be an independent, per-file decision without touching the pipeline.

## Implementation order

1. `magento-xml/discovery.ts` (pure: globs, predicate, area classifier, enum).
2. `magento-xml/` parse/build/save + the `di-xml` handler + `registry`.
3. Queue + worker entrypoint; register the worker in `worker.ts`.
4. API route `POST/DELETE /api/graph/index/xml`.
5. Wire into `build-index-flow.ts` (reindex + reset-and-reindex).
6. Schema `007_*.cypher` (edge identity constraints).
7. Delta route: replace the `.xml` skip with `isConfigXml` routing.
8. Watcher: add a broad `**/*.xml` glob (no core import; the delta route filters).
9. Update `packages/mcp/resource/graph-schema.json`.
10. Later: `events-xml`, `adminhtml-xml`, `config-xml` handlers (additive).
```
