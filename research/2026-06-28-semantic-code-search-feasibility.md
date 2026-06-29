# Feasibility of Semantic Search over Magento Code (class/interface descriptions)

**Date:** 2026-06-28
**Status:** Research snapshot — point-in-time findings, not a maintained document.
**Context:** Pre-implementation investigation for a possible second vector index over the
**code graph** (Neo4j), complementing the existing `store_config_search` (vector index over
`system.xml`) and `graph_search` (structural Cypher). Measurements were taken against a live,
fully-indexed Magento graph and the bundled `magentic_embedder` service.

---

## 1. Goal

The graph answers **structural** questions ("what plugins target class X?") but requires knowing
the symbol name and writing Cypher. An agent often knows the **intent** ("where is shipping rate
calculation handled?") but not the class name. A semantic index over **natural-language class
descriptions** (derived from graph facts) gives a semantic entry point: search by meaning → get
candidate classes (keyed by FQCN) → pivot into the graph for exact structure.

It **complements**, not replaces, the graph: the description is a denormalized projection of graph
facts, keyed by the class FQCN so results join straight back to the graph.

---

## 2. What would be stored

A new pgvector table, mirroring `config_embeddings`, keyed by the class FQCN:

```sql
CREATE TABLE code_embeddings (
  fqcn        text PRIMARY KEY,          -- e.g. "Magento\Customer\Model\Session" (joins back to the graph node id)
  description text NOT NULL,             -- the built natural-language description
  embedding   vector(768) NOT NULL,      -- same model/dim as config_embeddings
  kind        text NOT NULL,             -- class | interface | trait | enum
  module      text,                      -- e.g. "Magento_Customer"
  model       text NOT NULL,             -- embedding model used
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

The embedding layer is already provider-agnostic (`createVectorStore` takes a `VectorTable`), so this
slots in next to the config pipeline with no new infrastructure. A new MCP tool `code_search` would
wrap it, alongside `graph_search`.

---

## 3. Description-building logic

For each `PHPClass` node, the description is assembled deterministically from the node metadata **plus
its connections** (not just node properties). Sections (only emitted when non-empty):

1. **Identity** — FQCN, kind (class/interface/trait/enum), modifiers (readonly/final/abstract), module.
2. **Inheritance** — `EXTENDS` (parent), `IMPLEMENTS` (interfaces), `USES` (traits).
3. **Public methods** — name + parameters (type + name) + return type, **excluding `__construct`**
   (its info duplicates the dependency list).
4. **Dependencies** — `INJECTS` (constructor dependencies), with two resolutions (see §5):
   - virtual types resolved to their real class via `EXTENDS`,
   - `\Proxy` / `\Interceptor` wrappers unwrapped to the real target.
5. **Consumers** — incoming `INJECTS` (which classes depend on this one), de-duplicated.
6. **Plugins** — incoming `PLUGIN_FOR`, grouped by plugin class with their **areas** (per-area edges).
7. **DI preference** — incoming `PREFERENCE_FOR` (this class is the configured impl for an interface).
8. **Events** — outgoing `OBSERVES` (events this class observes).
9. **Cron / WebAPI** — `SCHEDULED_IN` (cron groups), `SERVED_BY` (REST routes).

All references use the **full FQCN** (the graph stores it; an early prototype lost it by shortening to
the last namespace segment, which collapsed `…\Customer\Proxy`, `…\Url\Proxy`, etc. to a meaningless
"Proxy, Proxy").

---

## 4. Cypher queries (per class `$id`)

Edge directions (verified): `INJECTS` consumer→dep; `PLUGIN_FOR` plugin→target; `OBSERVES` class→event;
`PREFERENCE_FOR` interface→class; `SCHEDULED_IN` method→cronGroup; `SERVED_BY` webapiRoute→method;
`DECLARED_IN_PACKAGE` class→package.

```cypher
// identity + module
MATCH (c:PHPClass {id:$id}) RETURN c.kind, c.abstract, c.final, c.readonly;
MATCH (c:PHPClass {id:$id})-[:DECLARED_IN_PACKAGE]->(p) RETURN coalesce(p.magentoModuleName, p.name);

// inheritance
MATCH (c:PHPClass {id:$id})-[:EXTENDS]->(x)    RETURN x.id;
MATCH (c:PHPClass {id:$id})-[:IMPLEMENTS]->(x) RETURN x.id;
MATCH (c:PHPClass {id:$id})-[:USES]->(x)       RETURN x.id;   // traits

// public methods with param/return types (signature built in Cypher), excluding the constructor
MATCH (c:PHPClass {id:$id})-[:HAS_METHOD]->(m:PHPMethod)
WHERE m.visibility = 'public' AND m.name <> '__construct'
WITH m, [i IN range(0, size(coalesce(m.paramNames,[]))-1) |
         trim((CASE WHEN coalesce(m.paramTypes[i],'')='' THEN '' ELSE m.paramTypes[i]+' ' END)
              + '$' + m.paramNames[i])] AS ps
RETURN m.name + '(' + reduce(s='', p IN ps | CASE WHEN s='' THEN p ELSE s+', '+p END) + ')'
       + CASE WHEN coalesce(m.returnType,'')<>'' THEN ': '+m.returnType ELSE '' END
ORDER BY m.name;

// dependencies, resolving virtual types to their real class
MATCH (c:PHPClass {id:$id})-[:INJECTS]->(d)
OPTIONAL MATCH (d)-[:EXTENDS]->(rt)
RETURN DISTINCT d.id, (d:VirtualType) AS isVirtual,
       CASE WHEN d:VirtualType THEN rt.id ELSE '' END AS realClass;

// consumers (incoming INJECTS), de-duplicated
MATCH (x)-[:INJECTS]->(c:PHPClass {id:$id}) RETURN DISTINCT x.id;

// plugins grouped by class, with areas (PLUGIN_FOR is per-area)
MATCH (x)-[r:PLUGIN_FOR]->(c:PHPClass {id:$id}) RETURN x.id, collect(DISTINCT r.area);

// DI preference / events / cron / webapi
MATCH (i)-[:PREFERENCE_FOR]->(c:PHPClass {id:$id}) RETURN DISTINCT i.id;
MATCH (c:PHPClass {id:$id})-[:OBSERVES]->(e:Event) RETURN DISTINCT e.id;
MATCH (c:PHPClass {id:$id})-[:HAS_METHOD]->(m)-[:SCHEDULED_IN]->(g) RETURN DISTINCT g.id;
MATCH (r:WebapiRoute)-[:SERVED_BY]->(m)<-[:HAS_METHOD]-(c:PHPClass {id:$id}) RETURN DISTINCT r.id;
```

> Note: the prototype ran ~10 queries **per class**. For a full index this must be collapsed into a
> few batched/streamed passes (aggregate per class), or the Neo4j read time dominates the run
> (~45K classes × 10 queries ≈ 450K queries).

---

## 5. Graph-quality findings (surfaced during the test)

- **Virtual types must be resolved.** `Magento\Customer\Model\Session` injects `SessionValidator`,
  which is a `:VirtualType` (labels `["VirtualType","PHPClass"]`). Its real class is reached via
  `EXTENDS` → `Magento\Framework\Session\CompositeValidator` (Magento's di.xml `type` attribute
  becomes `EXTENDS`). The description should detect `:VirtualType` and trace back. (`OF_TYPE` is
  unrelated — it is `ExtensionAttribute → Interface`.)
- **`\Proxy` / `\Interceptor` are generated wrappers,** not real dependencies — unwrap to the target
  (`…\ResourceModel\Customer\Proxy` → depends on `…\ResourceModel\Customer`).
- **`PLUGIN_FOR` is per-area.** The two `SessionPlugin` edges are **not** a bug: the same plugin class
  is registered in `webapi_soap` and `webapi_rest` (edge props: `area`, `sourceFile`, `identity`).
  Group by plugin class and list areas.
- **One real gap:** `SessionValidator` is itself a virtual type whose *bare* name has no namespace —
  so any place that surfaces it without the EXTENDS resolution looks unqualified. This is the
  resolution step above, not a missing node.

---

## 6. Example descriptions (built from live data)

**Rich class** — `Magento\Customer\Model\Session` (25 public methods, 6 deps, 7 consumers, 3 plugin
registrations):

> Magento\Customer\Model\Session is a class in the Customer module. It extends
> Magento\Framework\Session\SessionManager. It exposes 24 public methods (excluding the constructor):
> authenticate(bool|null $loginUrl): bool; checkCustomerId(int $customerId): bool;
> getCustomerGroupId(): int; getCustomerId(): int|null; isLoggedIn(): bool; loginById(int
> $customerId): bool; logout(); setCustomerId(int|null $id); … . It constructor-injects:
> Magento\Customer\Model\ResourceModel\Customer (via proxy), Magento\Customer\Model\Url (via proxy),
> **Magento\Framework\Session\CompositeValidator [virtual type: SessionValidator]**,
> Magento\Customer\Model\Session\Storage, Magento\Customer\Model\Config\Share (via proxy),
> Magento\Customer\Api\CustomerRepositoryInterface (via proxy). It is injected into 7 classes:
> Magento\Captcha\Observer\CheckUserLoginObserver, … , Magento\Vault\Model\Ui\VaultConfigProvider.
> It is intercepted by plugins: Magento\Customer\Model\Plugin\ClearSessionsAfterLogoutPlugin
> (frontend), Magento\Customer\Plugin\Model\SessionPlugin (webapi_soap, webapi_rest).

**Typical class** — `Magento\Catalog\Helper\Product\Configuration` (4 methods, implements an
interface, 2 plugins):

> Magento\Catalog\Helper\Product\Configuration is a class in the Catalog module. It extends
> Magento\Framework\App\Helper\AbstractHelper. It implements
> Magento\Catalog\Helper\Product\Configuration\ConfigurationInterface. It exposes 3 public methods:
> getCustomOptions($item): array; getFormattedOptionValue(string|array $optionValue, array $params):
> array; getOptions($item): array. It is injected into 1 class:
> Magento\Catalog\Helper\Product\ConfigurationPool. It is intercepted by plugins:
> Magento\ConfigurableProduct\Helper\Product\Configuration\Plugin (global),
> Magento\GroupedProduct\Helper\Product\Configuration\Plugin\Grouped (global).

---

## 7. Description size (measured)

Token estimate uses the project estimator `max(ceil(chars/4), ceil(words/0.75))`.

| Class | chars | words | est. tokens |
|---|---|---|---|
| `Customer\Model\Session` (rich, full FQCN) | ~1,700 | ~99 | **~425** |
| `Catalog\Helper\Product\Configuration` (typical) | ~692 | ~49 | **~173** |

**Key result:** even a heavily-connected class is **~400 tokens** — far below the originally assumed
1,000–1,500, under the 1,800-token guard, and under embeddinggemma's 2,048 context. Because the model
uses **mean pooling**, keeping descriptions in the ~150–450 range is also *better* for retrieval than
very long text (long inputs dilute the pooled vector). Working average for estimation: **~250–300
tokens/class**.

---

## 8. Corpus scale (measured against the live graph)

Node labels (a node may carry multiple labels; `PHPClass` is a source-indexed subset that overlaps
`Class`):

| Label | Count |
|---|---|
| Class | 41,467 |
| Interface | 3,830 |
| PHPClass (source-indexed subset) | 1,879 |
| VirtualType | 964 |
| Trait | 287 |
| Enum | 35 |

- **All real PHP types (class + interface + trait + enum, excluding virtual types): ~45,617.**
  (Overlap `Class ∩ VirtualType` is only 2.)
- **~41,540 of them have method data** (i.e. not shallow stubs — ~91%).
- Virtual types (~964) are intentionally **excluded** — they are DI aliases whose `INJECTS`/`EXTENDS`
  already point at real classes.

Relationship volumes (context): HAS_METHOD 224,922; PARAM_TYPE 89,454; RETURNS_TYPE 44,907;
DECLARED_IN_PACKAGE 38,769; EXTENDS 27,711; IMPLEMENTS 12,941; INJECTS 3,453; USES 2,911;
PREFERENCE_FOR 1,874; PLUGIN_FOR 888; SERVED_BY 547; OBSERVES 467; HAS_EXTENSION_ATTRIBUTE 168;
OF_TYPE 103; SCHEDULED_IN 66.

**Full-corpus token volume:** ~45,617 × ~250–300 tokens ≈ **~11–13.5M tokens per full reindex.**

---

## 9. Models & stack used for testing

- **Embedding model:** `embeddinggemma-300m` (768 dims), QAT/Q8_0 GGUF
  (`ggml-org/embeddinggemma-300m-qat-q8_0-GGUF`).
- **Local embedder:** bundled `magentic_embedder` — llama.cpp server, CPU-only (NEON), 10 threads,
  OpenAI-format `/v1/embeddings`. (No GPU: Docker on macOS — Docker Desktop *or* OrbStack — cannot
  pass the Apple Metal GPU to a Linux container.)
- **Remote embedder:** LM Studio on the host (native, Metal GPU) via `EMBEDDER_TYPE=remote`.
- **Graph:** Neo4j (`magentic_graphdb`), queried with `cypher-shell`.
- **Benchmark harness:** a `python:3.12-slim` sidecar on the `magentic_default` network POSTing
  batched `/v1/embeddings` requests; description builder was a throwaway Python script shelling out to
  `cypher-shell` (a real builder would use the `neo4j-driver` for typed results).
- **Host:** Apple M4, 10 cores (4 performance + 6 efficiency); OrbStack VM sees all 10 cores.

---

## 10. Performance estimations

**Measured embedding throughput** (batched, ~250–350-token texts):

| Provider | Throughput | Source |
|---|---|---|
| Local llama.cpp (CPU) | **3,070 tok/s** | measured (200 texts / ~71K tokens / 23.1s) |
| LM Studio (Metal GPU) | ~6–9K tok/s | estimated (≈2–3× from a config-index A/B: 16s vs ~24–44s) |

**Extrapolated full index (~11–13.5M tokens):**

| Provider | Pure embedding time |
|---|---|
| Local (CPU) | **~60–75 min** |
| LM Studio (GPU) | **~25–40 min** |

Total index time also includes **description building** (Neo4j reads — must be batched or it
dominates) and **pgvector upsert** (~45K rows — minor). Concurrency with the graph index slows
embedding further (CPU contention: the local CPU embedder competes with the PHP analyzer + Neo4j;
LM Studio does not, because it runs on the GPU).

---

## 11. Index choice (pgvector)

- The config index uses **no ANN index** (exact KNN via `<=>`), which is correct at ~1,300 rows.
- A code index at **~45K rows** would make exact search noticeably slower, so it **should use HNSW**
  (`USING hnsw (embedding vector_cosine_ops)`) — additive, no query-code change since `<=>` works with
  or without the index. HNSW is approximate (recall ~99%, not 100%) but the right trade at this scale.
- Scoping to just `PHPClass` (~1,879) or `app/code` custom modules keeps exact search viable and the
  reindex in the **minutes** range.

---

## 12. Open questions / recommendations

- **Scope:** index all ~45K real types, or only `PHPClass` / `app/code`? An agent usually wants *your*
  code, not framework internals — strong argument for scoping down (cheaper, faster, exact search OK).
- **Description quality** is the whole game: full FQCN, virtual-type resolution, proxy unwrap, area-
  grouped plugins, drop the constructor, skip `N/A` metadata. Deterministic-from-graph is the cheap
  v1; LLM-generated summaries would be richer but add cost/non-determinism.
- **Incremental updates are mandatory** at full scale — re-embed only changed classes, wired into the
  existing graph delta/watcher pipeline. A full 45K reindex is a one-off, not a per-change cost.
- **Model ceiling:** whether a 300M sentence model captures code-structure prose well enough is
  unvalidated — run a scoped retrieval-quality spike (one module, realistic "where is X?" queries)
  before committing. The `EMBEDDER_TYPE` seam allows swapping to a larger/code-specific model later.
- **Two genuine graph-quality items** (independent of this feature): virtual-type dependencies need
  resolution at description time; `PLUGIN_FOR` per-area edges need grouping/dedupe.

---

## 13. Bottom line

Architecturally clean (reuses the abstract vector layer; new table + builder + `code_search` tool).
Descriptions are **cheap** (~250–400 tokens) and the **structural connections** carry the semantic
value, as hypothesized. The real costs are **scale** (~45K types, ~11–13.5M tokens, ~1 h local / ~30 m
GPU one-off, HNSW, incremental updates) and **description quality**. Recommended next step: a scoped
spike (one module, short deterministic descriptions) to validate retrieval quality before building the
full pipeline.
