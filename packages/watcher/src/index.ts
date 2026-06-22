import chokidar, { type FSWatcher } from "chokidar";
import { readFileSync, watch as fsWatch } from "node:fs";
import { posix } from "node:path";

type WatcherConfig = {
  watcherEnabled: boolean;
  projectRoot: string;
  sourceSubpaths: string[];
};

const mountPath = process.env.MAGENTIC_ANALYZED_SOURCE_PATH ?? "/mnt/analyzed-source";
const configPath = process.env.MAGENTIC_CONFIG_PATH ?? "/app/data/config.json";
const backendUrl = process.env.MAGENTIC_BACKEND_URL ?? "http://magentic_backend:3000";
const usePolling = process.env.MAGENTIC_WATCH_POLLING === "true";
const debounceMs = 1500;

let watcher: FSWatcher | null = null;
const pending = new Map<string, string>();
let flushTimer: NodeJS.Timeout | null = null;

function log(...args: unknown[]): void {
  console.log(new Date().toISOString(), "[watcher]", ...args);
}

function logError(...args: unknown[]): void {
  console.error(new Date().toISOString(), "[watcher]", ...args);
}

async function sendDelta(operation: "upsert" | "delete", paths: string[]): Promise<void> {
  log(`delta ${operation}: ${paths.length} path(s)`);

  try {
    const response = await fetch(`${backendUrl}/api/graph/index/delta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, paths })
    });

    if (response.status === 409) {
      log(`delta ${operation} skipped: a full reindex is in progress`);
    } else if (!response.ok) {
      const body = await response.text().catch(() => "");
      logError(`delta ${operation} rejected: ${response.status} ${body}`);
    }
  } catch (error) {
    logError(`delta ${operation} request failed:`, error);
  }
}

function readConfig(): WatcherConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as Partial<WatcherConfig>;

    return {
      watcherEnabled: typeof raw.watcherEnabled === "boolean" ? raw.watcherEnabled : true,
      projectRoot: typeof raw.projectRoot === "string" ? raw.projectRoot : "",
      sourceSubpaths: Array.isArray(raw.sourceSubpaths)
        ? raw.sourceSubpaths.filter((entry): entry is string => typeof entry === "string")
        : []
    };
  } catch {
    return { watcherEnabled: true, projectRoot: "", sourceSubpaths: [] };
  }
}

function buildWatchTargets(config: WatcherConfig): string[] {
  const roots =
    config.sourceSubpaths.length > 0
      ? config.sourceSubpaths.map((subpath) => posix.join(mountPath, subpath))
      : [mountPath];

  const phpGlobs = roots.map((root) => posix.join(root, "**/*.php"));
  const xmlGlobs = roots.map((root) => posix.join(root, "**/*.xml"));
  const composerLock = posix.join(mountPath, config.projectRoot, "composer.lock");

  return [...phpGlobs, ...xmlGlobs, composerLock];
}

function toRelative(path: string): string {
  return path.startsWith(mountPath) ? path.slice(mountPath.length).replace(/^\/+/, "") : path;
}

function record(event: string, path: string): void {
  pending.set(path, event);

  if (flushTimer) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = [...pending.entries()];
    pending.clear();

    const upserts: string[] = [];
    const deletes: string[] = [];

    for (const [path, event] of batch) {
      (event === "unlink" ? deletes : upserts).push(toRelative(path));
    }

    if (upserts.length > 0) {
      void sendDelta("upsert", upserts);
    }

    if (deletes.length > 0) {
      void sendDelta("delete", deletes);
    }
  }, debounceMs);
}

let config = readConfig();
let fullIndexRunning = false;

async function stopWatching(reason: string): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
    log(`stopped watching (${reason}).`);
  }
}

function startWatching(): void {
  const targets = buildWatchTargets(config);
  log(`watching ${targets.length} target(s)${usePolling ? " (polling)" : ""}:`, targets.join(", "));

  watcher = chokidar.watch(targets, {
    ignoreInitial: true,
    usePolling,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
  });

  watcher
    .on("add", (path) => record("add", path))
    .on("change", (path) => record("change", path))
    .on("unlink", (path) => record("unlink", path))
    .on("error", (error) => log("watch error:", error));
}

async function reconcile(): Promise<void> {
  const shouldWatch = config.watcherEnabled && !fullIndexRunning;

  if (shouldWatch && !watcher) {
    startWatching();
  } else if (!shouldWatch && watcher) {
    pending.clear();
    await stopWatching(config.watcherEnabled ? "full reindex in progress" : "disabled via config");
  }
}

async function reloadConfig(): Promise<void> {
  config = readConfig();
  await stopWatching("config changed");
  await reconcile();
}

async function pollIndexLock(): Promise<void> {
  try {
    const response = await fetch(`${backendUrl}/api/status`);
    const data = (await response.json()) as { indexing?: { locked?: boolean } };
    const running = data.indexing?.locked === true;

    if (running !== fullIndexRunning) {
      fullIndexRunning = running;
      log(running ? "full reindex started — pausing." : "full reindex finished — resuming.");
      await reconcile();
    }
  } catch {
    return;
  }
}

await reconcile();
setInterval(() => void pollIndexLock(), 4000);

try {
  fsWatch(configPath, { persistent: true }, () => {
    setTimeout(() => void reloadConfig(), 200);
  });
} catch (error) {
  log("could not watch the config file for changes:", error);
}

process.on("SIGTERM", async () => {
  await stopWatching("shutting down");
  process.exit(0);
});
