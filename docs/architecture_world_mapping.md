# World Mapping Architecture

Magentic maps a Magento codebase into a single property graph in Neo4j so an AI
agent can reason over it. This document is the source of truth for the **graph
structure** — its node families, relationships, and identity rules. The slim,
machine-readable version served to agents lives in
`packages/mcp/resource/graph-schema.json`; keep the two in sync.

## The graph at a glance

```
EXTENDS / IMPLEMENTS / USES / PREFERENCE_FOR / PLUGIN_FOR / INJECTS : PHPClass    → PHPClass
HAS_METHOD                                                          : PHPClass    → PHPMethod
PARAM_TYPE / RETURNS_TYPE                                           : PHPMethod   → PHPClass
DECLARED_IN_PACKAGE                                                 : PHPClass    → Package
OBSERVES                                                            : PHPClass    → Event
SCHEDULED_IN                                                        : PHPMethod   → CronGroup
SERVED_BY                                                           : WebapiRoute → PHPMethod
HAS_EXTENSION_ATTRIBUTE                                             : PHPClass    → ExtensionAttribute
OF_TYPE                                                             : ExtensionAttribute → PHPClass
```

Composer dependency edges complete the picture:

```
PACKAGE_REQUIRES_PACKAGE / PACKAGE_REQUIRES_DEV_PACKAGE /
PACKAGE_SUGGESTS_PACKAGE / PACKAGE_REPLACES_PACKAGE /
PACKAGE_PROVIDES_PACKAGE / PACKAGE_CONFLICTS_WITH_PACKAGE            : Package → Package
PACKAGE_AUTHORED_BY                                                 : Package → Author
```

Everything below explains how those nodes and edges are identified, produced, and
written without colliding.

## Node families

There are two families, distinguished by **how they are identified**.

### Code symbols (identified by fully-qualified name)

| Label | Holds | id | Key example |
| --- | --- | --- | --- |
| `PHPClass` | class, interface, trait, enum, **virtualType**, and any referenced-but-undeclared type | the FQN | `Magento\Catalog\Model\ProductRepository` |
| `PHPMethod` | methods | `<owner FQN>::<name>` | `Magento\Catalog\Model\ProductRepository::save` |

- **`PHPClass` is the identity label** (it carries the `id` and the uniqueness
  constraint). A reference (a parameter type, a `<preference type=…>`, an injected
  argument) does not say whether the target is a class, interface, enum, or
  virtualType — so they all share `PHPClass`, which makes a reference and its
  later declaration the **same node by id alone** (no neutral base label needed).
- **The kind is carried two ways, both purely descriptive:**
  - a **secondary label** (`:PHPClass:Interface`, `:PHPClass:Trait`,
    `:PHPClass:Enum`, `:PHPClass:VirtualType`; a plain class is `:PHPClass:Class`)
    for fast, index-free categorical filtering — `MATCH (:Interface)`;
  - a **`kind` property** (`class` / `interface` / … / `virtualType`) for easy
    aggregation and for returning the value in result rows.
  The secondary kind label **never carries a uniqueness constraint** — identity is
  always `PHPClass.id`. It is painted on safely: an anchor is `:PHPClass` (kind
  unknown) and the declaration adds the kind label later; `MERGE (:PHPClass {id})`
  still unifies them because the match is on the base label, not the kind label.
- **VirtualType is a `PHPClass`** (`kind:'virtualType'`) that `EXTENDS` its base
  class — so inheritance and DI queries traverse it exactly like a class.
- A referenced-but-undeclared symbol is a `PHPClass`/`PHPMethod` with
  `defined:false` (just `fqcn`/`id`); it gains its real properties when its file
  is indexed.

### Config entities (identified by name, per kind)

| Label | Holds | id |
| --- | --- | --- |
| `Event` | a Magento event (dispatch hook) | event name (`catalog_product_save_after`) |
| `CronGroup` | a cron group | group id (`default`) |
| `WebapiRoute` | a REST/SOAP endpoint URL | the url (`/V1/products/:sku`) |
| `ExtensionAttribute` | an extra API field on a data interface | `<for FQN>::<code>` |
| `Package` | a Composer package | `package:<vendor>/<name>` |
| `Author` | a Composer author | `author:<name>|<email>|<homepage>` |

These are **never referenced kind-agnostically**, so each gets its **own label
and its own `<Label>.id` uniqueness constraint**. That is what keeps, e.g., the
event named `default` and the cron group named `default` as two separate nodes —
the label is part of the identity, the id stays a clean name (no prefixes), and
no global key forces them to collide.

## Identity and write invariants

- **Uniqueness is per label**: `PHPClass.id`, `PHPMethod.id`, `Event.id`,
  `CronGroup.id`, `Package.id`, `Author.id`. There is no shared base label and no
  global id key.
- **Nodes** are written with `MERGE (n:<Label> {id}) SET n += props`. Re-indexing
  a symbol upgrades the same node (anchor → full declaration) without clobbering
  unrelated properties; multiple files contributing to one node (e.g. a cron
  group described by both `crontab.xml` and `cron_groups.xml`) accumulate.
- **Edges** are written with `MATCH (from:<FromLabel> {id}), (to:<ToLabel> {id})
  MERGE (from)-[r:<TYPE> {identity}]->(to)`. Each relationship carries an
  `identity` hash so re-indexing cannot duplicate it; per-area or per-parameter
  variants fold a discriminator into the hash.
- **Clearing is ownership-scoped.** The source pipeline only clears the edge
  types it owns (`EXTENDS`, `IMPLEMENTS`, `USES`, `HAS_METHOD`, `PARAM_TYPE`,
  `RETURNS_TYPE`) off the symbols it re-indexes, so XML- and Composer-owned edges
  on the same node survive. XML edges are cleared by their `sourceFile`.
- **Scalars and constants are never nodes.** Fundamental scalar types
  (`int`, `string`, `array`, …) stay as string properties; di `string` /
  `boolean` / `number` / `const` / `init_parameter` arguments produce no edge.

## What produces what

Three independent pipelines write into the same graph.

### PHP source (`index-source`)

The PHP analyzer parses files with `nikic/php-parser` and streams newline-
delimited JSON facts; the Node worker batches them and writes:

- `PHPClass` / `PHPMethod` nodes (with `kind`, `file`, modifiers, method
  signature fields).
- `EXTENDS`, `IMPLEMENTS`, `USES`, `HAS_METHOD`.
- `PARAM_TYPE` / `RETURNS_TYPE` from the method's native signature and docblock
  (`source: native | docblock`; array element types carry `is_array`; class-like
  types become edges, scalars stay fields).

Worker entry `src/worker/index-source-worker.ts` → `consumeFactStream` →
`map-records` → batched `MERGE` writes (`src/modules/graph/upsert.ts`).

### Composer (`index-packages`, `index-links`)

`composer.lock` becomes `Package`/`Author` nodes and the composer edges
(merge-and-prune writes). `index-links` then connects each declared `PHPClass` to
its `Package` with `DECLARED_IN_PACKAGE`, matched by longest-prefix PSR-4 against
each package's `psr4Namespaces` — entirely in Cypher.

### Magento XML config (`index-xml`)

One pipeline, one handler per config file, dispatched by filename
(`src/modules/processing/magento-xml/`). All edges carry `area`
(`global`/`frontend`/`adminhtml`/…) and `sourceFile`.

| File | Produces |
| --- | --- |
| `di.xml` | `PREFERENCE_FOR` (interface→concrete), `PLUGIN_FOR` (plugin→target), `INJECTS` (constructor wiring, object + array items), virtualType `PHPClass` + `EXTENDS` |
| `events.xml` | `Event` node + `OBSERVES` (observer class→event) |
| `crontab.xml` + `cron_groups.xml` | `CronGroup` node + `SCHEDULED_IN` (method→group); `cron_groups.xml` adds the group's settings |
| `webapi.xml` | `WebapiRoute` node (url) + `SERVED_BY` (route→service method; HTTP verb on the edge) |
| `extension_attributes.xml` | `ExtensionAttribute` node + `HAS_EXTENSION_ATTRIBUTE` (interface→attribute) + `OF_TYPE` (attribute→class; scalar types stay in the node's `type` property) |

Plugin→method interception is **not** stored; the plugin's target method is
derivable at query time from `PLUGIN_FOR` + `HAS_METHOD` and the
`before`/`after`/`around` naming convention.

`SCHEDULED_IN` is emitted from a synthesized `<instance>::<method>` `PHPMethod`
node. When the cron `instance` is a real class that declares the method, that id
matches the real method node, so `HAS_METHOD` already links it to its class. When
the `instance` is a **virtualType** (or the method is inherited), it is a
referenced-only anchor with no `HAS_METHOD` — the real class is resolved at query
time by splitting the id and following `EXTENDS`:

```cypher
MATCH (m:PHPMethod)-[:SCHEDULED_IN]->(g:CronGroup)
MATCH (instance:PHPClass {id: split(m.id, '::')[0]})
OPTIONAL MATCH (instance)-[:EXTENDS*0..]->(owner:PHPClass)
              -[:HAS_METHOD]->(real:PHPMethod {name: split(m.id, '::')[1]})
RETURN g, m, instance, owner, real
```

The model stays clean (no synthetic bridge edge); the virtualType/inheritance
case is exactly what the `EXTENDS` edges resolve.

## Worked example (new label scheme)

Each node is keyed by id and lists its outbound edges; `area`/`sourceFile`/
`identity` are omitted for brevity.

```json
{
  "Magento\\Catalog\\Model\\ProductRepository": {
    "labels": ["PHPClass", "Class"], "kind": "class", "defined": true,
    "out": [
      { "EXTENDS": "Magento\\Catalog\\Model\\AbstractRepository" },
      { "IMPLEMENTS": "Magento\\Catalog\\Api\\ProductRepositoryInterface" },
      { "USES": "Magento\\Framework\\Cache\\CacheAwareTrait" },
      { "HAS_METHOD": "Magento\\Catalog\\Model\\ProductRepository::save" },
      { "DECLARED_IN_PACKAGE": "package:magento/module-catalog" }
    ]
  },
  "Magento\\Catalog\\Model\\ProductRepository::save": {
    "labels": ["PHPMethod"], "kind": "method", "defined": true,
    "out": [
      { "PARAM_TYPE": "Magento\\Catalog\\Api\\Data\\ProductInterface", "name": "product", "source": "native" },
      { "RETURNS_TYPE": "Magento\\Catalog\\Api\\Data\\ProductInterface", "source": "native" }
    ]
  },
  "virtualCachedProductRepository": {
    "labels": ["PHPClass", "VirtualType"], "kind": "virtualType", "defined": true,
    "out": [
      { "EXTENDS": "Magento\\Catalog\\Model\\ProductRepository" },
      { "INJECTS": "Magento\\Catalog\\Model\\Cache\\Frontend", "name": "cache" }
    ]
  },
  "Magento\\Catalog\\Api\\ProductRepositoryInterface": {
    "labels": ["PHPClass", "Interface"], "kind": "interface", "defined": true,
    "out": [
      { "PREFERENCE_FOR-inbound": "Magento\\Catalog\\Model\\ProductRepository (area=global)" }
    ]
  },
  "Magento\\Sales\\Observer\\Backend\\CatalogProductSaveAfterObserver": {
    "labels": ["PHPClass", "Class"], "kind": "class", "defined": true,
    "out": [ { "OBSERVES": "catalog_product_save_after", "area": "adminhtml" } ]
  },
  "catalog_product_save_after": { "labels": ["Event"], "kind": "event" },
  "Magento\\Cron\\Cron\\CleanOldJobs::execute": {
    "labels": ["PHPMethod"], "kind": "method", "defined": true,
    "out": [ { "SCHEDULED_IN": "default", "jobName": "clean_cron_schedule", "schedule": "0 0 * * *" } ]
  },
  "default": { "labels": ["CronGroup"], "kind": "cronGroup", "schedule_generate_every": 15 }
}
```

## Scope and non-goals

- The **method-call graph** (method calls method) is permanently out of scope —
  signature and docblock types are the substitute.
- **Member nodes** (properties, class constants, enum cases) are not modeled;
  constructor dependencies are captured by `PARAM_TYPE` / `INJECTS`.
- **Override edges** are not stored; interface/plugin method resolution is a
  query-time match on name.
- Out-of-scope XML: layout, ui_component, acl, menu, module, config, db_schema,
  and the queue/indexer/widget set. `system.xml` is a deferred final step whose
  plain-English config search likely needs a vector index, not the graph. See
  `docs/plan_magento_xml_indexing.md`.
