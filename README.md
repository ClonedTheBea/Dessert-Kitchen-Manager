# Dessert Kitchen Manager

A private Windows app for recipes, stock and dessert-kitchen planning. **Sprint 3 — Orders, Sales & Payments is ready for owner review.** Start a basket from Home → New Order, or use Money → Orders, Sales, Import Sales and Payouts. The four main sections, Apiary plum shell, light cards and existing forecasts remain intact. See the [Sprint 3 screenshots, limitations and acceptance checklist](docs/SPRINT3.md), following the accepted [financial UX polish](docs/FINANCIAL-POLISH.md). Sprint 4 has not begun.

## Start

Requirements: .NET 8 runtime, .NET SDK 8 or 9, Node.js 22+ and npm. These were available on the development computer. Upgrade to .NET 10 LTS before network deployment; .NET 8 support ends 10 November 2026 ([Microsoft lifecycle](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core)).

Double-click **Start Kitchen.cmd** to build and serve the site locally. Keep its window open while using the app at **http://127.0.0.1:5080**. Close that window or press **Ctrl+C** to stop serving it; your saved kitchen data stays on disk. The launcher binds only to this computer and stops its server even if the window is closed abruptly. It refuses to start if another server is already using port 5080.

Alternatively, run from this folder:

```powershell
npm.cmd --prefix client ci
npm.cmd --prefix client run build
dotnet run --project server
```

Open **http://127.0.0.1:5080**. Create your owner password (12+ characters) on first launch. No default password is shipped. Leave the terminal running; Ctrl+C stops it. Data persists in `data/kitchen.db`, outside build outputs and excluded from Git. The eight illustrative products and one reusable biscuit base are seeded once.

## Enter your first batch

1. Choose **Home → Add ingredient**. Enter the ingredient, supplier (or create one inline), pack size, unit and purchase price together.
2. Confirm **Add ingredient & price**. Unit costs use the existing C# decimal/VAT calculation. This adds a quote; receive actual stock separately.
3. Use **Recipes → Ingredients → Update price** for a later quote. Previous prices remain in the expandable history.
4. Open **Recipes → Create a recipe**. Set the yield and ingredients, including packaging. Use **Method** for numbered preparation steps.
5. Use **Cost & pricing** to inspect calculated costs and selling-price assumptions. **Publish recipe version** creates the immutable snapshot; ordinary edits only update the working draft.
6. Enter assumptions in **Settings → Business Settings**. Open **Money → Financial Overview** for read-only results; search a dessert to open **Price Breakdown**. Permanent prices and advanced saved pricing scenarios live in **Settings → Product pricing**.

Owner hours (20/week), desired pay (£12/hour), orders (20/evening), investment (£5,000) and recovery period (24 months) are additional editable sample assumptions, not business facts.

## Record actual stock

Use **Home → Record purchase** or **Stock → Purchases** to receive real purchases against existing ingredients and suppliers. Drafts autosave without affecting stock. Confirm a receipt, then use **Production** to preview shortages and record completed batches. Review supplier/production dates and evidence before using stock. **Finished Products**, **Stocktake**, **Waste**, **Shopping Lists** and **More → Movement History** provide the rest of the workflow. Choose the appropriate testing/commercial location. All illustrative acceptance data was kept out of the live database.

## Available functionality

- Suppliers and ingredients: brand, reference, category, allergens, packaging and minimum-stock settings.
- Multiple supplier quotes with compatible units, VAT treatment, effective dates and illustrative/entered labels. Costs per g/ml/each and kg/l are calculated in C#.
- Recipe editor: packaging, waste allowance, sub-recipes, yield, portion sizes, preparation, storage, allergens and optional labour.
- Batch/portion costs, selling-price contribution and target-margin pricing. Recipe margins exclude platform fees and sales VAT; use the order planner for these.
- Immutable recipe versions and input cost history. Repricing is explicit: calculate/save a new version. Update saved sub-recipes before repricing their parents.
- Batch scaling from saved recipes, with quantities and active labour scaled proportionally. Review time assumptions before saving.
- Saved/duplicated/comparable financial scenarios, editable fixed expenses, opening schedule, owner pay, capital recovery and break-even targets.
- SQLite migrations, transactional saves, stale-edit conflicts, owner login and verified backup/restore.

The newest effective supplier quote is used, **not necessarily the cheapest supplier**. Future-dated quotes are excluded. Quotes are not purchases. Saved recipe versions retain their original prices. Unused suppliers and ingredients can be deleted with confirmation; referenced records can be archived and restored, with historical dependencies protected by database constraints.

Recipes now open in a read-only cooking view with visible numbered methods and Edit Method / Add Method. Existing ingredient, supplier and scenario forms autosave after 750 ms. Recipe, quote, new-ingredient and dietary-review forms retain working drafts; publication, finalisation and claim approval remain explicit. Check the save status before closing the browser. Failed/conflicting saves offer retry and an edits download.

Sprint 1.1 adds ordered preparation methods, explicit internal/sellable recipe types, separate variants, structured UK allergen information, documented dietary approvals and an internal printable/CSV allergen matrix. Unknown information never means confirmed suitable. Source changes invalidate affected approvals. The planner now groups assumptions, supports optional staffing and channel mixes, and compares server-calculated changes without overwriting scenarios.

Unexpected API errors are written to the console and `data/logs/errors-YYYY-MM-DD.log`. Passwords and request bodies are not logged.

## Backups and restore

Download a consistent SQLite backup from Settings. It includes the password hash and all history; keep it private. Stop the app before restoring:

```powershell
dotnet run --project server -- --restore "C:\Backups\dessert-kitchen-backup.db"
```

The command checks SQLite integrity/schema, preserves the old database as `kitchen.db.before-restore-TIMESTAMP`, and restores using SQLite's backup API. A process lock prevents restoring over a running app. Restoring also restores the owner password from that backup. Override storage using the `DatabasePath` environment variable if needed. Back up `data/` before upgrades.

## Development and verification

```powershell
dotnet test DessertKitchen.sln
npm.cmd --prefix client run build
# Optional dev frontend; run the API separately:
npm.cmd --prefix client run dev
```

Browser tests use a separate database on port 5081 and a test-only password, never your real database:

```powershell
Set-Location client
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Automated coverage: units, precision/rounding, VAT assumptions, wastage, labour, packaging, scaling, margins, commissions, break-even, negative contribution, price snapshots, stale edits, cyclic sub-recipes, authentication/origin checks, SQLite persistence/migrations and backup/restore. Browser tests cover account setup, supplier/ingredient/quote entry, recipe creation/scaling, scenario comparison, backup and mobile layout.

Manual checks: restart after saving a recipe; add a newer quote and verify historical versions remain unchanged; save a repriced version; restore a backup to a separate `DatabasePath` and compare records. Verify HTTPS/cookies in the actual IIS environment before network use. IIS deployment itself has not been tested.

## Architecture and scope

Read [the architecture and sprint plan](docs/ARCHITECTURE.md). React/TypeScript displays authoritative C# decimal results. Intermediate costing retains precision; output monetary boundaries use explicit rounding away from zero. Numbered SQL migrations run transactionally. Quotes and recipe versions preserve history.

For IIS: build the client, publish the server, install the matching ASP.NET Hosting Bundle, configure HTTPS and allowed hosts, grant the application pool access to a private absolute `DatabasePath`, and preserve Data Protection keys across deployments. Do not expose the database directory as static files. Default hosting binds to loopback only.

Known limits and scheduled work:

- **Sprint 2 implemented:** actual purchases, FIFO stock ledger, versioned production, finished stock, stocktakes, waste, date reviews, alerts and shopping lists. Inventory starts empty; no stock balances are fabricated. See the handover for valuation conventions and limits.
- **Sprint 3:** orders, sales, real-schema CSV imports/reconciliation and financial CSV/Excel reporting exports. Internal allergen CSV export is available now.
- **Sprint 4:** verified effective-dated tax modelling, P&L and cash flow. Current VAT fields are explicit assumptions, not product classifications, tax estimates or filing functionality.
- **Sprint 5:** authorised API adapters, multi-user roles and staff management. Staffing cost assumptions are available now; payroll is not. No private platform access or successful connections are simulated.
- No password recovery/change UI yet. Keep the owner password safe and retain backups.
- Child recipe labour/packaging is included in its sub-recipe line total. The top-level packaging/labour breakdown shows directly entered costs; the total includes both.
- Sample recipes, allergens and storage notes are illustrative. Verify actual recipes and supplier specifications before production.

Current usability handover: [Sprint 2.1.1](docs/SPRINT-2.1.1.md), including household stock, grouped inventory, shortage recovery, validation and the manual acceptance checklist.

Business Settings now holds the editable assumptions; Financial Overview shows results and Price Breakdown explains each product price. See the [Financial UX handover](docs/FINANCIAL-UX.md) and the [underlying accounting methods](docs/BUSINESS-PROFITABILITY.md). Sprint 3 remains pending acceptance.
