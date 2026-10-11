# Dessert Kitchen Manager

## Implementation plan

The repository started with a README only. Sprint 1 establishes a local, authenticated application; it does not manufacture operational sales or stock records.

1. **Foundation (Sprint 1 and 1.1):** suppliers, ingredient catalogue, append-only supplier quotes, versioned recipes with ordered methods and explicit internal/sellable types, price snapshots, costing/scaling, documented allergen reviews and variants, protected archive/delete operations, persistent scenarios, staffing/channel assumptions, planning dashboard, SQLite migrations, backup/restore and tests. Sprint 1.1.1 was accepted before Sprint 2.
2. **Inventory:** purchase invoices and lots (separate from quotes), unit-normalised movement ledger, stocktake adjustments, production transactions and finished goods. Implemented in Sprint 2: inventory-changing operations have an idempotency key and compensating reversal, never deletion of ledger entries. Date corrections append review operations.
3. **Orders:** channels, manual orders, immutable financial/recipe snapshots, finished-goods versus make-to-order consumption, independently modelled refunds/cancellations/disposal, imports with staging/preview and mapping based on actual supplied exports, reconciliation and reports.
4. **Accounting:** effective-dated UK tax rules, product-specific VAT, expenses/capital assets, P&L, cash flow and accountant exports. Verify rules against HMRC before implementation. No filing claims.
5. **Expansion:** authorised platform adapters, synchronisation/retry logs, multi-user roles and staffing. No merchant scraping or invented API connections.

## Architecture

- `client`: React + TypeScript, Vite. Responsive single-page application; all authoritative costing happens on the server.
- `server/Domain`: pure C# decimal calculations and validation. Pounds use decimal, rounding away from zero to two places only at financial boundaries. Recipe unit and intermediate costs retain precision.
- `server/Infrastructure`: Microsoft.Data.Sqlite, numbered transactional SQL migrations, parameterised queries and versioned JSON documents. Prices and recipe versions are append-only; entity revisions prevent silent concurrent overwrites.
- `server/Program.cs`: authenticated HTTP API and static SPA hosting, validation errors, logging, anti-forgery origin/header checks, password hashing and rate-limited login.
- `tests`: xUnit domain and HTTP/SQLite integration tests. Inventory joins migration 004; sales remain deferred.

SQLite stores decimal values inside JSON as decimal number text; C# reads them directly into decimal. No monetary SQL arithmetic or binary floating-point server calculations. The browser formats returned results, but does not calculate costs. Every recipe version embeds its input prices and cost result, including sub-recipe version references. Repricing is explicit and produces a new version. Ingredient catalogue edits and quote additions cannot rewrite an old recipe cost.

Migration 002 adds default fields without rewriting original values, a foreign-key-protected dependency index for current and historical references, and immutable dietary reviews. A populated database is backed up before pending migrations. Schema 1–4 backups can be restored; older databases migrate on next startup.

Current allergen assessments recursively use current ingredient and child-recipe revisions, independently of historical cost snapshots. Fingerprints bind approvals to the reviewed dependency tree and current effective supplier/product reference. Supplier changes mark verification stale; source changes withdraw claims until reviewed again. Approved claims are returned only when the latest explicit approval still matches and all checks pass. Historical cost snapshots remain unchanged. Every declared optional/topping/packaging component participates; omitted components require a separate variant. The public ordering site is not implemented.

Prices are supplier quotes, not purchases. Purchase ledger and FIFO stock valuation are implemented separately in Sprint 2. Recipes include packaging as ingredient lines with type Packaging. Compatible conversions: g/kg, ml/l, each. Mass-to-volume conversions require a specific density and are rejected. Sub-recipes are used by their declared output unit (portions for each, g or ml for batch components), with cycles prohibited.

## Hosting and security

The application binds to `127.0.0.1:5080` by default. First-run password setup is loopback-only; passwords use PBKDF2 with random salts and constant-time verification. HttpOnly, SameSite=Strict cookies require same-origin JSON writes. Production serves the built client and API from one origin. Host validation restricts local operation; explicit network configuration is required. HTTPS and a current supported runtime are required before IIS/network exposure. Multi-user roles are deferred, but the single-owner login is real.

The initial build targets .NET 8 so it runs on the installed SDK/runtime. .NET 8 support ends 10 November 2026: upgrade to .NET 10 LTS before network deployment (https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core). Package versions and lockfile are retained.

## Modelling conventions

Planning values never represent actual sales, cash, profit or tax liabilities. Opening days and service hours are configurable. Average month = 52/12 weeks. Commission is calculated on discounted gross customer sales. Commission VAT is an expense unless recoverable; explicit recoverability is only allowed when VAT registered. Variable costs are entered net of any recoverable input VAT; sales VAT is a scenario-specific assumed blended rate, not a food tax classification. Owner compensation is displayed separately from operating profit (drawings are not automatically deductible expenses). Capital recovery is a planning allocation, not depreciation or a cash flow statement.

The first eight example products and all initial prices are illustrative. No sample sales are created. Users can edit examples or create their own records. A recipe remains illustrative if any underlying cost is illustrative. Incomplete recipes cannot be saved as costed products.

## Inventory implementation

See [Sprint 2](SPRINT-2.md) for schema, valuation rules, migration evidence and acceptance. The authenticated inventory endpoints post one immutable operation plus lots/movements in a single SQLite transaction. Working draft completion belongs to the same transaction. Duplicate keys return the original result; mismatched payloads conflict. Reversals are compensating movements. Stock is the C# decimal sum of signed lot/location movements, with FIFO allocation over usable receipts and recursive traceability. Stocktake snapshots compare each counted lot’s last movement sequence before applying differences. No sales or reservations have been implemented.


## Sprint 2.1 presentation layer

`client/src/theme.css` owns the Apiary-derived brand primitives and semantic roles. Layout styles and `redesign.css` consume variables; application CSS contains no colour literals outside the token file. Home, Recipes (with ingredients and suppliers), Stock, and Money are the four primary sections. Recipe reading/editing uses dedicated page content; working drafts and immutable publication remain distinct.

The only backend additions are an authenticated, read-only `/prices/preview` endpoint using the existing decimal calculation, and the `ingredient-setup` draft publication transaction. It inserts an optional supplier, ingredient, initial quote, audit entries and draft receipt atomically. Existing CAS, dependency triggers and publication idempotency apply. There is no database migration and no change to FIFO, recipes, financial modelling or inventory posting. See [Sprint 2.1](SPRINT-2.1.md).


## Sprint 2.1.1 existing stock and valuation

`ExistingStockInput` posts through the same immutable inventory transaction and draft-confirmation machinery as purchases/production. Additive JSON fields retain provenance, prepared date and valuation status; no SQL migration is needed. `StockLot.UnitCost`, movement/balance values and production actual costs are nullable. Any unknown-cost allocation makes the actual production total unknown; estimated inputs retain estimated status. Old serialized lots default to known status. API consumers must preserve nullable actual costs rather than coalescing them to zero. Decimal arithmetic is unchanged. Historical receipts do not synthesize ingredient consumption or allergen evidence. See [the Sprint 2.1.1 handover](SPRINT-2.1.1.md).
