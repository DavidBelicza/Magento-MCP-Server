---
name: clean-code-pass
description: Use when asked to clean up, refactor, or improve code quality without changing behavior — making dependencies mockable for unit testing, flattening nested control flow inside loops, and removing comments in favor of self-documenting code. Offers to commit the result afterwards.
---

# Clean Code Pass

A behavior-preserving cleanup pass with three checks, then verification, then an
offer to commit. Apply only what is relevant to the files in scope; do not
rewrite working code that already follows these rules.

## 1. Make dependencies mockable without implementing classes

Inject collaborators so a unit test can supply a fake, but do not introduce a
class hierarchy or a DI framework to do it. Use a plain function-bag port.

- Define a **port type**: an object whose properties are the functions the
  module calls (the side-effecting ones — filesystem, network, clock, random).
- Provide a **default implementation** bound to the real dependency.
- Accept the port as an **optional last parameter defaulting to the real
  implementation**, so production callers stay unchanged and tests pass a plain
  object literal.
- Keep the port thin: it wraps the raw call. Error-handling and branching stay
  in the module so they are testable.

```ts
export type FileSystemPort = {
  readFile: (path: string) => Promise<string>;
  statIsFile: (path: string) => Promise<boolean>;
};

export const nodeFileSystem: FileSystemPort = {
  readFile: (path) => readFile(path, "utf8"),
  statIsFile: async (path) => (await stat(path)).isFile()
};

export async function process(path: string, fs: FileSystemPort = nodeFileSystem) {
  /* ... */
}
```

Do **not** wrap a collaborator that is already injected. If a function already
receives a driver, client, or pool as an argument (e.g. a Neo4j `Driver`), it is
already mockable — leave it alone.

## 2. Flatten functions — no nested ifs inside a loop

A loop body should not contain an `if` whose body contains another `if`. Flatten
with these moves, in order of preference:

- **Guard clauses.** Replace an `if (ok) { work }` wrapper with
  `if (!ok) continue;` then the work at the top level.
- **Extract per-iteration work** into a named helper that returns a value or
  `null`; the loop body becomes a single call plus one guard.
- **Build collections functionally.** Replace an accumulating loop with
  `map` / `flatMap` / `filter`, using a small mapper that returns the item or
  `null` and a type-guard filter (`(x): x is T => x !== null`).
- **Classify, then branch flat.** Replace a nested `if/else-if` selection with a
  helper that returns a discriminated category, then a single flat `if/else-if`
  chain (or a `switch`) over that category.

The goal is one level of decision per scope. A loop containing a loop is fine;
a loop containing nested conditionals is what this removes.

## 3. Remove comments — let the code describe itself

This project forbids source comments; ESLint enforces it. The only allowed
comment is a `/** */` doc block, and only for type information a native type
cannot express (generics, array shapes).

- Delete `//` and inline comments. If a comment was explaining *what* code does,
  that is a signal to **rename a variable or extract a well-named helper**, not
  to keep the comment.
- Keep a `/** */` doc block only when it carries type information the signature
  cannot. If a doc block is present, document every such parameter and the
  return so it is not partial.
- Follow the rest of the project conventions in `AGENTS.md` (dash-case
  filenames, early returns, `match`/`switch` over long if-chains, enums over
  magic strings).

## 4. Verify

Run the project checks and confirm they pass before offering to commit:

```bash
npm run typecheck
npm run lint
npm test
```

Do not add test files unless explicitly requested; the mockability change exists
so tests *can* be written later.

## 5. Offer to commit

Once the checks pass, offer to run the **git-commit-and-push** skill to commit
the cleanup. Do not commit automatically — propose it and let the user decide.
