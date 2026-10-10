import {
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChefHat,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Wheat,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";
import { flushEdits } from "./autoSave";
import type { State } from "./types";

import { ErrorBox, type Page } from "./components/ui";
import Ingredients from "./features/Ingredients";
import Login from "./features/Login";
import Overview from "./features/Overview";
import Planner from "./features/Planner";
import Recipes from "./features/Recipes";
import SettingsPage from "./features/SettingsPage";

export default function App() {
  const [auth, setAuth] = useState<{
    configured: boolean;
    authenticated: boolean;
  }>();
  const [state, setState] = useState<State>();
  const [page, setPage] = useState<Page>("Overview");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const refresh = async () => {
    setState(await api<State>("/state"));
  };
  useEffect(() => {
    api<{ configured: boolean; authenticated: boolean }>("/auth")
      .then(setAuth)
      .catch((e) => setError(e.message));
    const expired = () => {
      setAuth({ configured: true, authenticated: false });
      setState(undefined);
    };
    window.addEventListener("kitchen-session-expired", expired);
    return () => window.removeEventListener("kitchen-session-expired", expired);
  }, []);
  useEffect(() => {
    if (auth?.authenticated) refresh().catch((e) => setError(e.message));
  }, [auth]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const navigate = async (p: Page) => {
    if (!(await flushEdits())) return;
    await refresh();
    setPage(p);
    setMenu(false);
  };
  if (!auth)
    return (
      <div className="loading">
        <ChefHat />
        <p>{error || "Opening your kitchen…"}</p>
        {error && <button onClick={() => location.reload()}>Try again</button>}
      </div>
    );
  if (!auth.authenticated)
    return (
      <Login
        configured={auth.configured}
        done={() => setAuth({ configured: true, authenticated: true })}
      />
    );
  const pages = [
    { name: "Overview" as Page, icon: LayoutDashboard },
    { name: "Ingredients" as Page, icon: Wheat },
    { name: "Recipes" as Page, icon: BookOpen },
    { name: "Financial planner" as Page, icon: ChartNoAxesCombined },
  ];
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "expanded" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <span className="brand-icon">
            <ChefHat size={25} />
          </span>
          <span>
            Dessert Kitchen<small>THE BUSINESS BEHIND THE BAKE</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">DK</span>
          <div>
            Your kitchen<small>Planning & recipe testing</small>
          </div>
          <span className="status-dot" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {pages.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              {name}
              {page === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="coming">
          <p className="nav-label">GROWING WITH YOUR KITCHEN</p>
          <p>
            Inventory <span>Sprint 2</span>
          </p>
          <p>
            Orders & reporting <span>Sprint 3</span>
          </p>
          <p>
            Tax & accounting <span>Sprint 4</span>
          </p>
        </div>
        <div className="sidebar-bottom">
          <div className="private-note">
            <ShieldCheck size={19} />
            <div>
              Private by design<small>Your recipes. Your business.</small>
            </div>
          </div>
          <button
            className={page === "Settings" ? "active" : ""}
            onClick={() => navigate("Settings")}
          >
            <Settings size={18} />
            Settings & backups
          </button>
          <button
            onClick={async () => {
              try {
                if (!(await flushEdits())) return;
                await api("/auth/logout", {});
                setAuth({ configured: true, authenticated: false });
                setState(undefined);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={17} />
            Lock kitchen
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} /> <strong>{page}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="planning-pill">
              <span className="status-dot" />
              Planning mode
            </span>
            <span className="avatar">MK</span>
          </div>
        </header>
        <main>
          <ErrorBox error={error} />
          {!state ? (
            <p>Loading saved records…</p>
          ) : (
            <>
              {page === "Overview" && (
                <Overview state={state} navigate={navigate} />
              )}
              {page === "Ingredients" && (
                <Ingredients
                  state={state}
                  refresh={refresh}
                  notify={setToast}
                />
              )}
              {page === "Recipes" && (
                <Recipes state={state} refresh={refresh} notify={setToast} />
              )}
              {page === "Financial planner" && (
                <Planner state={state} refresh={refresh} notify={setToast} />
              )}
              {page === "Settings" && <SettingsPage state={state} />}
            </>
          )}
          <footer className="page-footer">
            <span>DESSERT KITCHEN MANAGER</span>
            <span>Made for the way your kitchen grows.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
