# Member Indexing — Mapping Logic (DRAFT)

> Status: **DRAFT / temporary.** Working notes for the next analyzer phase (methods,
> traits, enums). Fold the agreed parts into `docs/architecture_world_mapping.md`
> once implemented, then delete this file.

This phase extends source indexing from class/interface declarations and their
`extends`/`implements` references to also cover **methods**, **traits**, and
**enums**, with signature-level fields on methods.

## Scope

In scope:

- New symbol kinds: `trait`, `enum`, `method`.
- New relations: `HAS_METHOD` (owner to method), `USES` (class/enum to trait).
- Class modifier fields: `abstract`, `final`, `readonly`.
- Method fields: `visibility`, `static`, `abstract`, `final`, `hasBody`, native
  `returnType`, and `parameters` (each with native `type` only).

Deferred (not this phase):

- Free functions (`php-function` nodes). Rare in Magento and have no owner; they
  would attach to a file or namespace node, or stand alone. Revisit later.
- Docblock-derived types (`@param`/`@return`). The AST exposes only the raw
  docblock text; tag/type parsing needs `phpstan/phpdoc-parser`.
- Method descriptions (docblock plain text).
- `IMPLEMENTS_METHOD` / override edges between method nodes (derivable at query
  time, see "Querying without override edges").
- Property, constant, and enum-case nodes.
- Type-reference edges (`RETURNS_TYPE`, `PARAM_TYPE`) and the call graph. These
  are the indexed way to search "what takes/returns type X"; until then, parameter
  and return types are searchable via list/string properties (see Fields).

## Node taxonomy

All nodes keep the existing `:Symbol` base label and the `defined` flag (`true`
when the file declares the symbol, `false` for referenced-only anchors).

| Kind | id scheme | Neo4j label |
| --- | --- | --- |
| class | `php-class:<FQN>` | `:Symbol:PHP:Class` |
| interface | `php-interface:<FQN>` | `:Symbol:PHP:Interface` |
| trait | `php-trait:<FQN>` | `:Symbol:PHP:Trait` |
| enum | `php-enum:<FQN>` | `:Symbol:PHP:Enum` |
| method | `php-method:<FQN>::<name>` | `:Symbol:PHP:Method` |

Methods are nodes (not properties of the owner) so they have stable identity, are
queryable, and can become edge endpoints later (override edges, call graph).

## Relations

| Relation | From | To | Source |
| --- | --- | --- | --- |
| `EXTENDS` | class / interface | class / interface | existing |
| `IMPLEMENTS` | class | interface | existing |
| `HAS_METHOD` | class / interface / trait / enum | method | new |
| `USES` | class / enum | trait | new (`ReferenceKind::Uses` already exists) |

## Fields

Modifiers follow PHP semantics. Only classes carry type-level modifiers;
interfaces and traits have none, and `static` is never a type-level modifier.

| Node | Fields |
| --- | --- |
| class | `fqcn`, `defined`, `file`, `abstract`, `final`, `readonly` |
| interface | `fqcn`, `defined`, `file` |
| trait | `fqcn`, `defined`, `file` |
| enum | `fqcn`, `defined`, `file` (implicitly final) |
| method | `name`, `visibility`, `static`, `abstract`, `final`, `hasBody`, `returnType`, `parameters` |

Method `parameters` is an ordered list; each entry has `name`, native `type`,
`optional`, `variadic`, `byRef`, `promoted`. Neo4j cannot store a list of objects
as a property, so it is split:

- `paramNames` and `paramTypes` are stored as parallel string lists (aligned by
  index; untyped parameters use `""` since lists cannot hold null). These are
  Cypher-searchable now, e.g. `WHERE 'Vendor\\Catalog\\ProductInterface' IN m.paramTypes`,
  and correlatable by index with `UNWIND range(0, size(m.paramNames)-1)`.
- The full structured detail (`optional`, `variadic`, `byRef`, `promoted`) is kept
  in a JSON string (`parametersJson`, via the existing `properties.ts` fallback).

List-membership search is not indexed (it scans `:Method` nodes), which is fine for
analysis queries. The indexed "what takes type X" search is the deferred `PARAM_TYPE`
edge work. `returnType` stays a plain queryable string.

### Declaration vs definition

No separate `DECLARES`/`DEFINES` relations. A single `HAS_METHOD` plus the method
node's `hasBody` flag (`true` when `$method->stmts !== null`) and `abstract` flag
captures the distinction and keeps it filterable.

### Type rendering

Types are stored as exact strings, no information dropped:

- builtin (`int`, `string`, `array`, `void`, ...) rendered as-is.
- class/interface types rendered as the resolved FQN (`NameResolver` runs first).
- nullable `?T` is expanded to the canonical `T|null`; unions `T|U|null` and
  intersections `T&U` are preserved verbatim.

## Querying without override edges

Even without `IMPLEMENTS_METHOD` edges, implementations of an interface method are
resolvable at query time from `IMPLEMENTS` + `EXTENDS` + `USES` + `HAS_METHOD`:

```cypher
MATCH (i:Interface {fqcn: $interfaceFqcn})-[:HAS_METHOD]->(:Method {name: $method})
MATCH (impl:Class)-[:IMPLEMENTS]->(i)
MATCH (c:Class) WHERE c = impl OR (c)-[:EXTENDS*1..]->(impl)
MATCH (owner)-[:HAS_METHOD]->(m:Method {name: $method})
WHERE owner = c OR (c)-[:EXTENDS*0..]->(owner) OR (c)-[:USES]->(owner)
RETURN c.fqcn, owner.fqcn, m
```

Matching is by method name (unambiguous within a class in PHP) and must reach
inherited and trait-provided methods. A future `IMPLEMENTS_METHOD` edge would just
materialize this for performance; it requires a cross-file resolution pass over the
completed graph and is not needed to answer the question.

## Implementation plan

### PHP analyzer (`packages/php-analyzer`)

1. Replace the manual top-level iteration in `FileParser` with a `NodeVisitor`
   (`enterNode`) that handles every `ClassLike` (`Class_`, `Interface_`, `Trait_`,
   `Enum_`) and `Function_`. This recurses naturally and drops the namespace
   special-casing. Keep `NameResolver` first.
2. Emit symbol facts for `trait` and `enum` (the `defined` flag already exists).
3. Add class modifier fields (`abstract`, `final`, `readonly`) via `isAbstract()`,
   `isFinal()`, `isReadonly()`.
4. For each `ClassLike`, iterate `getMethods()`: emit a method symbol fact with its
   fields and a `HAS_METHOD` reference from owner to method. Visibility/flags via
   `isPublic()/isProtected()/isPrivate()/isStatic()/isAbstract()/isFinal()`,
   `hasBody` from `stmts`, `returnType` and `parameters[].type` via a type-render
   helper, `parameters` from `Node\Param` (`var`, `type`, `default`, `variadic`,
   `byRef`, `flags` for promotion).
5. For class/enum, iterate `getTraitUses()` and emit `USES` references (plus the
   trait anchor symbol).
6. Extend the `Fact::symbol` payload with an optional `properties` map so method
   facts can carry their extra fields without a separate fact type. Add a
   `ReferenceKind::HasMethod` case.

### Worker (`packages/core`)

1. `types.ts`: add the new `kind` values and an optional `properties` map on
   `SymbolFact`. Reference kinds flow through generically (`kind.toUpperCase()`).
2. `map-records.ts`: merge `symbol.properties` into the node fields. New labels
   (`Symbol:PHP:Method`, `:Trait`, `:Enum`) flow through `Symbol:PHP:${kind}`
   automatically. No change to the clear logic: methods are `defined: true` within
   their file, so `HAS_METHOD` edges are cleared and rebuilt on re-index.

### Schema (`packages/core/schema/neo4j`)

- Add `004_create_member_constraints.cypher` with relationship identity uniqueness
  for `HAS_METHOD` and `USES` (same pattern as `EXTENDS`/`IMPLEMENTS`). The
  `Symbol.id` uniqueness constraint already covers method/trait/enum nodes.

### Performance and known limits

- Methods multiply node and edge counts roughly 5-10x. Re-tune `GRAPH_BATCH_SIZE`
  and watch Neo4j memory; analyzer CPU rises with deeper AST walking.
- `MERGE` never deletes nodes. A method removed from a class between indexings
  loses its `HAS_METHOD` edge (cleared via the owner) but leaves an orphan method
  node. Pre-existing limitation, amplified by member nodes; a sweep/garbage step
  can be added later if it matters.

## Resolved decisions

- Free functions: **deferred** (see Deferred).
- Nullable spelling: **`T|null`**.
- Method parameters: **parallel `paramNames[]` / `paramTypes[]` lists** (searchable)
  plus `parametersJson` for the remaining per-parameter detail.
