import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import "./styles.css";

type HealthState =
  | { status: "loading" }
  | { status: "ready"; payload: unknown }
  | { status: "error"; message: string };

function useBackendHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health check failed with ${response.status}`);
        }

        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (active) {
          setState({ status: "ready", payload });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error"
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

function Dashboard() {
  const health = useBackendHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Local Docker Environment
        </p>
        <h1 className="text-4xl font-semibold text-slate-950">Magentic</h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          Frontend traffic enters through Nginx. API calls stay same-origin and
          are proxied to the private Fastify backend.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Frontend" value="Nginx + React" />
        <StatusCard label="Backend" value="Fastify on /api" />
        <StatusCard label="Worker" value="BullMQ indexing" />
      </section>

      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-950">API Health</h2>
          <Link className="text-sm font-medium text-emerald-700" to="/deep/link">
            Test deep link
          </Link>
        </div>
        <pre className="overflow-auto rounded bg-slate-950 p-4 text-sm text-slate-100">
          {formatHealth(health)}
        </pre>
      </section>
    </main>
  );
}

function DeepLink() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-5 px-6">
      <Link className="text-sm font-medium text-emerald-700" to="/">
        Back home
      </Link>
      <h1 className="text-4xl font-semibold text-slate-950">Deep Link Route</h1>
      <p className="text-base leading-7 text-slate-600">
        This route is handled by React. Refreshing this URL should still load
        because Nginx falls back to <code>index.html</code> for non-API paths.
      </p>
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </article>
  );
}

function formatHealth(health: HealthState): string {
  if (health.status === "loading") {
    return "Loading /api/health...";
  }

  if (health.status === "error") {
    return health.message;
  }

  return JSON.stringify(health.payload, null, 2);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/deep/link" element={<DeepLink />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
