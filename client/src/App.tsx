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
import Inventory from "./features/Inventory";
import Ingredients from "./features/Ingredients";
import Login from "./features/Login";
import Home from "./features/Home";
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
  const [action, setAction] = useState("");
  const [navSeq, setNavSeq] = useState(0);
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
  const navigate = async (p: Page, nextAction = "") => {
    if (!(await flushEdits())) return;
    await refresh();
    setPage(p);
    setAction(nextAction);
    setNavSeq((n) => n + 1);
    window.scrollTo(0, 0);
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
    { name: "Overview" as Page, label: "Home", icon: LayoutDashboard },

    { name: "Recipes" as Page, label: "Recipes", icon: BookOpen },
    { name: "Inventory" as Page, label: "Stock", icon: Wheat },
    {
      name: "Financial planner" as Page,
      label: "Money",
      icon: ChartNoAxesCombined,
    },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
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
            Your kitchen<small>Recipes, stock & possibilities</small>
          </div>
          <span className="status-dot" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {pages.map(({ name, label, icon: Icon }) => (
            <button
              key={name}
              aria-current={
                page === name || (page === "Ingredients" && name === "Recipes")
                  ? "page"
                  : undefined
              }
              className={
                page === name || (page === "Ingredients" && name === "Recipes")
                  ? "active"
                  : ""
              }
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              {label}
              {page === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
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
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} />{" "}
              <strong>
                {page === "Ingredients"
                  ? "Recipes / Ingredients"
                  : (pages.find((p) => p.name === page)?.label ?? page)}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="planning-pill">
              <span className="status-dot" />
              Private kitchen
            </span>
            <span className="avatar">MK</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <ErrorBox error={error} />
          {!state ? (
            <p>Loading saved records…</p>
          ) : (
            <>
              {(page === "Recipes" || page === "Ingredients") && (
                <nav className="section-nav" aria-label="Recipe workspace">
                  <button
                    className={page === "Recipes" ? "active" : ""}
                    onClick={() => navigate("Recipes")}
                  >
                    Recipe book
                  </button>
                  <button
                    className={page === "Ingredients" ? "active" : ""}
                    onClick={() => navigate("Ingredients")}
                  >
                    Ingredients
                  </button>
                  <button onClick={() => navigate("Ingredients", "suppliers")}>
                    Suppliers
                  </button>
                </nav>
              )}
              {page === "Overview" && (
                <Home state={state} navigate={navigate} />
              )}
              {page === "Ingredients" && (
                <Ingredients
                  key={navSeq}
                  initialAction={action}
                  purchase={(id) => navigate("Inventory", `purchase:${id}`)}
                  state={state}
                  refresh={refresh}
                  notify={setToast}
                />
              )}
              {page === "Recipes" && (
                <Recipes
                  key={navSeq}
                  state={state}
                  refresh={refresh}
                  notify={setToast}
                />
              )}
              {page === "Financial planner" && (
                <Planner state={state} refresh={refresh} notify={setToast} />
              )}
              {page === "Inventory" && (
                <Inventory key={navSeq} initialAction={action} state={state} />
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
