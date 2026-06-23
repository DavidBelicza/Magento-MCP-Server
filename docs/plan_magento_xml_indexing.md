# Plan: Magento XML Indexing

> Status: **XML indexing complete on this branch** — di.xml, events.xml, crontab
> (crontab.xml + cron_groups.xml), and webapi (webapi.xml + extension_attributes.xml),
> all on the `PHPClass`/`PHPMethod` + config-entity label model. **One UI item
> remains:** the list/row view (below). **`system.xml` is not in this branch** —
> it's a future effort paired with vector search. The graph model is documented in
> `docs/architecture_world_mapping.md`.

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

## Implemented

All on the `PHPClass`/`PHPMethod` + config-entity label model — see
`docs/architecture_world_mapping.md` for the node/edge model and
`packages/mcp/resource/graph-schema.json` for the served schema.

- **di.xml** — `PREFERENCE_FOR`, `PLUGIN_FOR`, `INJECTS`, virtualTypes (`EXTENDS`).
- **events.xml** — `Event` nodes + `OBSERVES`.
- **crontab.xml + cron_groups.xml** — `CronGroup` nodes + `SCHEDULED_IN`.
- **webapi.xml** — `WebapiRoute` nodes + `SERVED_BY` (HTTP verb on the edge).
- **extension_attributes.xml** — `ExtensionAttribute` nodes + `HAS_EXTENSION_ATTRIBUTE`
  + `OF_TYPE` (scalar type kept as the node's `type` property).

## Remaining — list/row view (UI)

The one outstanding item. A graph search (`POST /api/graph/search`) can return
**either** graph entities (a query that returns nodes/relationships) **or** plain
**rows/columns** (a query with scalar projections or aggregations, e.g.
`RETURN c.fqcn, count(*)`). The graph page only renders the entity form; a
row-returning result currently has nowhere to show. We need a way to recognise a
list/row result and display it, distinct from the graph view. (An earlier ad-hoc
table was added to the graph page and then reverted — this should be done
deliberately, not bolted onto the graph view.)

Pointers for whoever picks this up (facts, **not** prescriptions — the design is
open):

- The data already exists in the response: `POST /api/graph/search` returns
  `result.columns` + `result.rows` (the tabular shape) alongside `result.graph`
  and `structuredResult` (the entity shape). No backend change is needed to *get*
  rows.
- The graph view (`packages/site/src/views/GraphView.tsx`, `features/graph/`)
  renders only `structuredResult`; when `result.graph` is empty it shows a
  "no graph nodes/relationships" message — that is exactly the row-result case.
- Query history (`listQueryHistory` in
  `packages/core/src/modules/search/query-history.ts`) currently lists **only**
  graph-returning queries; surfacing row queries would mean revisiting that
  filter.
- Open decisions left to the implementer: separate menu item/route vs a mode on
  the existing page; how/whether row queries appear in history; how to detect
  "this result is a list"; pagination and formatting.

## Not in this branch — `system.xml`

`system.xml` (admin config fields → `backend_model`/`source_model`/`frontend_model`,
keyed by config path) is **deferred to a future, separate effort paired with
vector search** — its goal is searching configurations in plain English, a
semantic-retrieval problem better served by a vector index than by the graph. It
is intentionally **not** part of this feature branch.

## Out of scope

The criterion for indexing an XML file is **symbol connectivity** (it must
reference classes/methods). Not indexed:

- tier 2 (`queue_*.xml`, `communication.xml`, `indexer.xml`, `mview.xml`,
  `widget.xml`) and tier 3 (layout, ui_component, `menu.xml`, `module.xml`,
  `config.xml`, `db_schema.xml`).
- **ACL entirely** — `acl.xml` is not indexed and webapi `<resource ref>` refs
  are not captured.
