import BusinessSettings from "./BusinessSettings";
import { Download, ShieldCheck } from "lucide-react";
import type { State } from "../types";

export default function SettingsPage({ state }: { state: State }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LOOK AFTER YOUR WORKSPACE</div>
          <h1>Settings & backups</h1>
          <p>Your business data stays with you.</p>
        </div>
      </div>
      <BusinessSettings />
      <div className="bottom-grid">
        <section className="panel">
          <span className="soft-icon">
            <Download size={23} />
          </span>
          <h2>A safe copy of your kitchen</h2>
          <p>
            Download a consistent SQLite backup including ingredients, prices,
            recipe versions, scenarios and the owner password hash.
          </p>
          <a className="primary inline" href="/api/backup">
            <Download size={17} />
            Download database backup
          </a>
          <p className="help">
            Keep backups private. To restore, stop the app and run the restore
            command documented in README.md. The existing database is preserved
            before replacement.
          </p>
        </section>
        <section className="panel">
          <span className="soft-icon">
            <ShieldCheck size={23} />
          </span>
          <h2>Private, local, persistent</h2>
          <dl className="breakdown">
            <div>
              <dt>Storage</dt>
              <dd>SQLite · on this computer</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>GBP (£)</dd>
            </div>
            <div>
              <dt>Dates & time</dt>
              <dd>United Kingdom</dd>
            </div>
            <div>
              <dt>Saved recipes</dt>
              <dd>{state.recipes.length}</dd>
            </div>
            <div>
              <dt>Supplier quotes retained</dt>
              <dd>{state.prices.length}</dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="panel roadmap">
        <h2>A foundation you can grow with</h2>
        <p>
          Sprint 1.1 supports planning, recipe testing and documented allergen
          reviews. Later modules are intentionally not shown as working business
          data.
        </p>
        <div className="roadmap-grid">
          {[
            [
              "01",
              "Recipe & finance foundation",
              "Available now",
              "Ingredients, quotes, recipe methods, allergen reviews, versioned costing, scenario planning and backups.",
            ],
            [
              "02",
              "Inventory & production",
              "Available now",
              "Purchases, lots, stocktakes, waste and finished-product stock.",
            ],
            [
              "03",
              "Orders & reporting",
              "Planned",
              "Manual orders, real-schema CSV imports, mapping and reconciliation.",
            ],
            [
              "04–05",
              "Accounting & integrations",
              "Planned",
              "Verified tax modelling, accountant exports and authorised platform access.",
            ],
          ].map(([n, title, status, body]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <small>{status}</small>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
