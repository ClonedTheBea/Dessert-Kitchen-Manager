CREATE TABLE IF NOT EXISTS documents (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_prices_ingredient ON prices(ingredient_id, recorded_at);
CREATE TABLE IF NOT EXISTS recipe_versions (
  recipe_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY(recipe_id, version)
);
CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL);
