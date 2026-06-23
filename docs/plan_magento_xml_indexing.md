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

Two handlers in `magento-xml`. Both files are **global-only** (`etc/webapi.xml`,
`etc/extension_attributes.xml`) — so these edges carry **no `area`**, only
`sourceFile`. Adds two node kinds (`WebapiRoute`, `ExtensionAttribute`) and three
edges (`SERVED_BY`, `HAS_EXTENSION_ATTRIBUTE`, `OF_TYPE`).

**webapi.xml** (root `<routes>`; handler reads `routes.route`). A URL is the
entity; the HTTP verbs are operations on it, each served by a different method:

- `WebapiRoute` node — id = the **url** (e.g. `/V1/products/:sku`); one per URL.
- `<route url method><service class method/></route>` →
  `(WebapiRoute)-[:SERVED_BY { httpMethod, secure?, soapOperation? , sourceFile }]->(PHPMethod)`
  where the method is the service `class::method`. `httpMethod` folds into the
  edge identity, so the several verbs on one URL are distinct edges.
- `<resources>`/`<resource ref>` (ACL) and `<data>`/`<parameter>` (param binding)
  are ignored.

**extension_attributes.xml** (root `<config>`). An extension attribute is a field
added to a data interface; it gets its **own node** so no attribute is ever lost
(the `for` interface is source-owned and extended by many files, so it cannot
hold a per-file attribute list). The node mirrors a method exactly — scalar type
as a property, class type as an edge:

- `ExtensionAttribute` node — id = `<for FQN>::<code>`, properties `code`,
  `is_array`, and `type` (scalar spelling only; empty when class-like).
- `<extension_attributes for=I><attribute code type/>` →
  `(I:PHPClass)-[:HAS_EXTENSION_ATTRIBUTE]->(ExtensionAttribute)`.
- class/interface `type` → `(ExtensionAttribute)-[:OF_TYPE]->(PHPClass)` (the
  `[]` suffix sets `is_array`); **scalar `type`** (`int`, `string[]`, …) → kept in
  the `type` property, **no `OF_TYPE`** (same rule as a method's scalar
  `returnType`). `<join>`/`<field>` (DB joins) are ignored.

Example: `<attribute code="supplier_id" type="int"/>` on `ProductInterface` →
`ProductInterface -[:HAS_EXTENSION_ATTRIBUTE]-> {id:"…ProductInterface::supplier_id",
code:"supplier_id", type:"int"}` (no `OF_TYPE`). A class type instead adds
`-[:OF_TYPE]->` the type class with `type:""`.

**Schema reconstruction:** the REST contract is a traversal, no types re-stored —
`WebapiRoute -SERVED_BY-> method -RETURNS_TYPE-> DTO`, then the DTO's getters
(`HAS_METHOD` → `RETURNS_TYPE`, recursively) plus its `HAS_EXTENSION_ATTRIBUTE` →
`OF_TYPE` fields. Magento declares the contract in docblocks, already stored as
`source: "docblock"` type edges. Getter→field-name (`getSku` → `sku`) is a
query-time convention; formatted OpenAPI is app-side.

**Build footprint:** handlers `webapi-xml.ts` + `extension-attributes-xml.ts`,
their basenames in `discovery.ts`/`registry.ts`, `SERVED_BY`/
`HAS_EXTENSION_ATTRIBUTE`/`OF_TYPE` added to `magentoXmlRelationshipTypes`, schema
`012` (`WebapiRoute.id`, `ExtensionAttribute.id`, and the three edge identities),
and the MCP schema. The `record-builder` already takes per-edge endpoint labels.

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
