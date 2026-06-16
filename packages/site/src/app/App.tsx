import { useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { DatabaseView } from "../views/DatabaseView";
import { GraphView } from "../views/GraphView";
import { QueryHistoryView } from "../views/QueryHistoryView";
import { SettingsView } from "../views/SettingsView";
import { WelcomeView } from "../views/WelcomeView";
import { navigationItems, viewRoutes, type ViewId } from "./navigation";
import { StatusProvider } from "./StatusContext";

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const activeView = getActiveView(location.pathname);
  const activeItem = useMemo(
    () => navigationItems.find((item) => item.id === activeView) ?? navigationItems[0],
    [activeView]
  );

  return (
    <StatusProvider>
    <div className="flex h-screen overflow-hidden bg-[#f4f6f8] text-[#111827]">
      <Sidebar
        activeView={activeView}
        isCollapsed={isSidebarCollapsed}
        onNavigate={(viewId) => navigate(viewRoutes[viewId])}
        onToggle={() => setIsSidebarCollapsed((currentValue) => !currentValue)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden border-l border-[#e5e7eb] bg-white md:rounded-l-[18px]">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-[520px] bg-[radial-gradient(circle_at_70%_18%,rgba(0,255,140,0.24),transparent_54%),radial-gradient(circle_at_85%_58%,rgba(255,78,8,0.34),transparent_24%)] blur-lg" />
        <TopBar activeLabel={activeItem.label} />
        <div className="relative z-10 shrink-0">
          <nav
            className="flex shrink-0 gap-1 overflow-x-auto border-y border-[#e5e7eb] bg-white/88 px-3 py-2 backdrop-blur md:hidden"
            aria-label="Mobile navigation"
          >
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={[
                  "flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium",
                  activeView === item.id
                    ? "border-[#8ff0b1] bg-[#d8ffe8] text-[#111827]"
                    : "border-transparent text-[#374151]"
                ].join(" ")}
                onClick={() => navigate(viewRoutes[item.id])}
              >
                <span className="[&_svg]:h-4 [&_svg]:w-4">
                  <Icon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <section className="relative z-10 min-h-0 flex-1 overflow-auto px-4 md:px-6">
          <div className="flex min-h-full flex-col pt-0 pb-8 md:pt-28 md:pb-10">
            <Routes>
              <Route path="/" element={<WelcomeView />} />
              <Route path="/graph" element={<GraphView />} />
              <Route path="/history" element={<QueryHistoryView />} />
              <Route path="/database" element={<DatabaseView />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </section>
      </main>
    </div>
    </StatusProvider>
  );
}

function getActiveView(pathname: string): ViewId {
  const route = Object.entries(viewRoutes).find(([, path]) => path === pathname);

  return route ? (route[0] as ViewId) : "welcome";
}
