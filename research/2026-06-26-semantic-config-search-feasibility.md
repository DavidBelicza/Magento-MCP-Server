# Feasibility of Semantic Search over Magento `system.xml` Configuration

**Date:** 2026-06-26
**Status:** Research snapshot — point-in-time findings, not a maintained document.
**Context:** Pre-implementation investigation for the vector config search feature
(implementation plan: `docs/plan_vector_config_search.md`).

---

## Abstract

We investigated whether plain-English search over Magento admin configuration
(`system.xml`) is achievable with a self-hosted, OpenAI-compatible embedding model
served by LM Studio, and whether the resulting semantic similarity is strong enough
to retrieve the correct configuration field from a natural-language question. Using
cosine similarity over embeddings from `text-embedding-embeddinggemma-300m-qat`
(768 dimensions), we found that the model captures conceptual relatedness
(hypernym/hyponym and paraphrase) with a clear margin over unrelated text, and that
a realistic query ranks the correct config description above an unrelated one. We
conclude the approach is viable and proceed with the planned pipeline.

## Problem

Magentic maps a Magento codebase into a symbolic property graph (classes, methods,
DI/observer/cron/webapi wiring). That graph answers *structural* questions
("what extends what", "what observes this event") but cannot answer *descriptive*
questions such as "where do I set the payment gateway URL?". Those answers live in
the human-readable labels and help text of `system.xml`, which is a
natural-language retrieval problem, not a graph traversal.

Open questions before committing engineering effort:

1. Can a **self-hosted** embedding model (no external API, no API key) be reached
   over a standard interface from our stack?
2. Does the model produce embeddings whose similarity reflects **meaning** well
   enough that loosely related terms (e.g. "fruit" ↔ "apple") and paraphrased
   queries land near the correct target?
3. What embedding **dimension** must the vector store be provisioned for?

## Hypothesis

A general-purpose sentence-embedding model will place semantically related text
closer (higher cosine similarity) than unrelated text, by a margin sufficient for
top-K nearest-neighbour retrieval to surface the correct config field from a
natural-language query.

## Method

- **Serving:** LM Studio exposing the OpenAI-compatible HTTP API at
  `http://127.0.0.1:1234`.
- **Models available:** two embedding models were loaded —
  `text-embedding-embeddinggemma-300m-qat` and
  `text-embedding-nomic-embed-text-v1.5`. Testing used the former.
- **Endpoint:** `POST /v1/embeddings` with `{ "input": [...], "model": ... }`.
  Verified the response shape and recorded the embedding vector length.
- **Metric:** cosine similarity computed directly from returned vectors.
- **Probes:**
  - Hypernym/hyponym: `"fruit"` vs `"apple"`, against an unrelated control
    (`"diesel engine maintenance"`).
  - Realistic retrieval: the query
    `"where do I configure the payment gateway URL?"` against a target config
    description (`"Set API gateway here, only for production. Field is in the
    Payment Methods group."`) and against an unrelated config description
    (`"Enable guest checkout for the storefront."`).

## Results

- **Endpoint:** functional; OpenAI request/response format confirmed.
- **Embedding dimension:** **768**.

Cosine similarities:

| Similarity | Pair |
| ---: | --- |
| 0.758 | "fruit" vs "apple" |
| 0.481 | "fruit" vs "diesel engine maintenance" (control) |
| 0.699 | query "…payment gateway URL?" vs correct API-gateway config description |
| 0.568 | query "…payment gateway URL?" vs unrelated guest-checkout description |

In both probes the relevant pair scored materially higher than the unrelated
control (0.758 vs 0.481; 0.699 vs 0.568).

## Discussion

The model captures conceptual relatedness, not just lexical overlap: "apple" scores
high for "fruit" despite sharing no words, and a paraphrased question matches the
correct config description without keyword overlap. The separation between relevant
and irrelevant pairs is the property that makes top-K retrieval viable — the correct
target is consistently ranked above unrelated text.

Caveats and limits of this snapshot:

- **Probabilistic, model-dependent.** This is ranking, not a guarantee; results
  reflect one specific model. Absolute cosine values are not comparable across
  models and should not be treated as thresholds.
- **Small, illustrative sample.** Four pairs demonstrate the mechanism; they are not
  a precision/recall evaluation over a real `system.xml` corpus.
- **Single-word queries are the weak case.** The realistic, richer query produced a
  cleaner separation than the bare "fruit" probe — encouraging for real usage.
- **Dimension is fixed at provisioning time.** The vector store must be created for
  `N = 768`; changing the model later (different `N`) requires a full re-embed and
  rebuild.

## Input length limit (silent truncation)

We also probed the maximum embeddable text length. Requests of arbitrary size
(tested up to ~224k characters) all returned `200 OK` with a 768-dim vector — i.e.
the endpoint **never errors on oversized input**. A controlled test (identical long
prefix followed by one of two semantically opposite sentences at the very end)
showed the two embeddings becoming **bit-for-bit identical (cosine = 1.0000)** once
the differing tail moved past roughly **1,000–1,400 filler words (~30k characters /
a few thousand tokens)**:

| Filler words | Chars | cos(opposite-tail A, B) |
| ---: | ---: | ---: |
| 50 | 1,100 | 0.497 |
| 200 | 4,400 | 0.818 |
| 1,000 | 22,000 | 0.988 |
| 1,400 | 30,800 | 1.0000 (tail truncated) |
| 3,000 | 66,000 | 1.0000 (tail truncated) |

**Finding:** LM Studio **silently truncates** input beyond the model's context
window — content past the cutoff is dropped with no error and no signal in the
response. The gradual rise from 0.50→0.99 is dilution; the snap to exactly 1.0000
is the truncation signature.

**Implication:** our generated descriptions (tens of words, a few hundred
characters) are far below the cutoff, so there is no risk for the planned content.
But the indexer should add a **length guard** (log/flag or explicit truncate above a
safe bound, e.g. ~4–8k characters) so a future change cannot lose description text
invisibly.

## Resolution

Semantic search over `system.xml` is **viable** with the self-hosted LM Studio
model, satisfying the goals of no external dependency and a standard interface.

Decisions carried into implementation:

- Proceed with the pipeline in `docs/plan_vector_config_search.md`.
- **Pin `text-embedding-embeddinggemma-300m-qat`** (good separation with no prompt
  prefix) and provision the vector store for **`vector(768)`**.
- Reach LM Studio from containers via `host.docker.internal:1234` (the host
  `127.0.0.1` is not reachable from inside a container).
- Before promising retrieval quality in the product, run a larger evaluation over a
  real `system.xml` corpus (Step 2 of the plan).
