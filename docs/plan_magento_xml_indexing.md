# Plan: Magento XML Indexing

> Status: **implemented** — `di.xml` (preferences, plugins, constructor
> injection, virtualTypes), `events.xml` (observers), and crontab
> (`crontab.xml` + `cron_groups.xml`). **Remaining:** webapi (Step 5), List view
> UI (Step 6), deferred `system.xml`. The graph model lives in
> `docs/architecture_world_mapping.md`; this doc is the design rationale and the
> roadmap for what's left.

## Goal

Parse Magento's declarative XML config and enrich the code graph with the wiring
those files describe (DI preferences/plugins/injections, observers, cron). XML
references classes by **FQN** — the `PHPClass` node id — so it mostly adds *edges
between existing nodes* (with `defined: false` anchors for not-yet-declared
classes), plus the config-entity nodes `Event` and `CronGroup`.

## Design decisions (settled)

- **Node, not PHP.** XML is declarative config with no AST need, so it is parsed
  in Node alongside `composer-lock`, not via the PHP analyzer. No new service.
- **One pipeline, handler per file type.** A single `index-xml` pipeline
  dispatches by basename to a handler (`registry.ts`); discovery, area handling,
  graph writes, incremental delete, watcher routing, and flow ordering are shared.
  Most logic lives in `packages/core/src/modules/processing/magento-xml/`; queue,
  worker, API route, and watcher are thin layers.
- **Per-subpath discovery.** XML is found under the configured `sourceSubpaths`
  (whole mount when empty), like the source pipeline.
- **Area is first-class.** The same interface can have different preferences per
  area, so `area` is an edge property and part of the edge identity hash.
- **Discovery + area classifier** (`discovery.ts`) is the single source of truth
  for "is this a config XML, and what area" (basename whitelist + walk up from the
  file to the `etc/<area>` landmark). The delta route imports it; the watcher
  stays dumb (globs all `*.xml`, the route filters).
- **Incremental delete by `sourceFile`.** Each XML edge carries `sourceFile`; a
  re-parsed/deleted file clears only its own edges.

## Remaining work

### Step 5 — webapi (`webapi.xml` + `extension_attributes.xml`)

These belong together: webapi gives the entry points, extension_attributes
completes the response DTOs, and the request/response **schema is already in the
graph** via the linked method's `PARAM_TYPE`/`RETURNS_TYPE` edges.

- `webapi.xml`: **root element is `<routes>`** (handler reads `routes.route`).
  `<route url method><service class method/></route>` → a `Route` node (config
  entity: own label + own `Route.id`, id = `<HTTP method> <url>`, `url`/`method`
  properties) with a `SERVED_BY` edge to the service `PHPMethod`. `<resources>`
  (ACL) is ignored.
- `extension_attributes.xml`: root `<config>`.
  `<extension_attributes for=I><attribute code type>` → a `HAS_ATTRIBUTE`-style
  edge to the attribute type. Same scalar-vs-class split as di injection: a
  class/interface type (often `…Interface[]` → `is_array`) becomes an edge; a
  scalar type (`int[]`, `string`) is skipped (decide whether to keep as attribute
  metadata).
- **Schema reconstruction:** the full REST schema is a recursive traversal —
  route → service method → `RETURNS_TYPE` DTO → its getter `HAS_METHOD` → each
  getter's `RETURNS_TYPE` (recursively) + extension attributes. Magento expresses
  the contract in docblocks, already stored as `source: "docblock"` type edges, so
  webapi rides on the source graph — no types are re-stored. Getter→field-name
  (`getSku` → `sku`) is a query-time convention; formatted OpenAPI is app-side.

### Step 6 — List view (UI)

A tabular **List view** as a **separate main-menu item** beside the graph view —
after webapi, before `system.xml`. It is the deliberate home for queries that
return **rows/columns** rather than graph entities. The graph view stays
graph-only (it draws node/relationship entities returned by the query); the list
view renders the tabular result of the same read-only Cypher. Backend already
returns `columns`/`rows` from `POST /api/graph/search`.

### Final (deferred) — `system.xml`

`system.xml` (admin config fields → `backend_model`/`source_model`/`frontend_model`
classes, keyed by config path) is the last step to evaluate. Its goal —
**searching configurations in plain English** — is a semantic-retrieval problem
that likely needs a **vector database**, not graph traversal. Defer until the
graph work is complete and the vector-search direction is decided.

## Out of scope

The criterion for indexing an XML file is **symbol connectivity** (it must
reference classes/methods). Not indexed:

- tier 2 (`queue_*.xml`, `communication.xml`, `indexer.xml`, `mview.xml`,
  `widget.xml`) and tier 3 (layout, ui_component, `menu.xml`, `module.xml`,
  `config.xml`, `db_schema.xml`).
- **ACL entirely** — `acl.xml` is not indexed and webapi `<resource ref>` refs
  are not captured.
