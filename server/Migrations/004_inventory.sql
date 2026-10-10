-- Inventory is additive: no demonstration quantities, changes to prices or old snapshots.
CREATE TABLE inventory_locations(id TEXT PRIMARY KEY, body TEXT NOT NULL);
INSERT INTO inventory_locations VALUES('home','{"id":"home","name":"Home Test Kitchen","mode":"testing"}');
CREATE TABLE inventory_operations(id TEXT PRIMARY KEY, type TEXT NOT NULL, request_hash TEXT NOT NULL, recorded_at TEXT NOT NULL, actor TEXT NOT NULL, body TEXT NOT NULL, result TEXT NOT NULL, reverses TEXT UNIQUE REFERENCES inventory_operations(id));
CREATE TABLE inventory_lots(id TEXT PRIMARY KEY, item_kind TEXT NOT NULL, item_id TEXT NOT NULL, recipe_version INTEGER, operation_id TEXT NOT NULL REFERENCES inventory_operations(id), body TEXT NOT NULL,
 FOREIGN KEY(item_kind,item_id) REFERENCES documents(kind,id) ON DELETE RESTRICT,
 FOREIGN KEY(item_id,recipe_version) REFERENCES recipe_versions(recipe_id,version) ON DELETE RESTRICT);
CREATE TABLE inventory_movements(sequence INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL REFERENCES inventory_operations(id), lot_id TEXT NOT NULL REFERENCES inventory_lots(id), location_id TEXT NOT NULL REFERENCES inventory_locations(id), body TEXT NOT NULL);
CREATE INDEX ix_inventory_lot ON inventory_movements(lot_id,location_id);
CREATE TRIGGER inventory_lot_dependencies AFTER INSERT ON inventory_lots BEGIN
 INSERT INTO record_dependencies VALUES('inventory-lot',NEW.id,NEW.item_kind,NEW.item_id,'Inventory lot: '||NEW.id);
END;
CREATE TABLE inventory_stocktakes(id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TRIGGER inventory_operations_no_update BEFORE UPDATE ON inventory_operations BEGIN SELECT RAISE(ABORT,'Inventory operations are immutable'); END;
CREATE TRIGGER inventory_operations_no_delete BEFORE DELETE ON inventory_operations BEGIN SELECT RAISE(ABORT,'Reverse inventory operations instead of deleting'); END;
CREATE TRIGGER inventory_lots_no_update BEFORE UPDATE ON inventory_lots BEGIN SELECT RAISE(ABORT,'Inventory lots are immutable'); END;
CREATE TRIGGER inventory_lots_no_delete BEFORE DELETE ON inventory_lots BEGIN SELECT RAISE(ABORT,'Inventory lots are retained for traceability'); END;
CREATE TRIGGER inventory_movements_no_update BEFORE UPDATE ON inventory_movements BEGIN SELECT RAISE(ABORT,'Stock movements are immutable'); END;
CREATE TRIGGER inventory_movements_no_delete BEFORE DELETE ON inventory_movements BEGIN SELECT RAISE(ABORT,'Reverse stock movements instead of deleting'); END;
CREATE TRIGGER inventory_stocktakes_no_update BEFORE UPDATE ON inventory_stocktakes BEGIN SELECT RAISE(ABORT,'Stocktake snapshots are immutable'); END;
CREATE TRIGGER inventory_stocktakes_no_delete BEFORE DELETE ON inventory_stocktakes BEGIN SELECT RAISE(ABORT,'Stocktake snapshots are retained'); END;
