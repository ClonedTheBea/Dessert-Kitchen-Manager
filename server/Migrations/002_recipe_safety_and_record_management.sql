-- Additive JSON migration. Never attempt to split or reinterpret the owner's existing prose.
UPDATE documents SET body=json_set(body,'$.methodSteps',json('[]'),'$.isSellable',json(CASE WHEN json_extract(body,'$.category')='Sub-recipes' THEN 'false' ELSE 'true' END)) WHERE kind='recipe';
UPDATE recipe_versions SET body=json_set(body,'$.recipe.methodSteps',json('[]'),'$.recipe.isSellable',json(CASE WHEN json_extract(body,'$.recipe.category')='Sub-recipes' THEN 'false' ELSE 'true' END));
UPDATE documents SET body=json_set(body,'$.archived',json('false')) WHERE kind IN ('ingredient','supplier');
-- Legacy allergen prose is retained as supplier information, with UNKNOWN verification.
UPDATE documents SET body=json_set(body,'$.allergenInfo',json_object('contains',json('[]'),'mayContain',json('[]'),'verification','unknown','supplierText',coalesce(json_extract(body,'$.allergens'),''),'source','','crossContactNotes','','reviewer','')) WHERE kind='ingredient';
CREATE TABLE record_dependencies (
 source_kind TEXT NOT NULL, source_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, description TEXT NOT NULL,
 PRIMARY KEY(source_kind,source_id,target_kind,target_id),
 FOREIGN KEY(target_kind,target_id) REFERENCES documents(kind,id) ON DELETE RESTRICT
);
CREATE INDEX ix_dependency_target ON record_dependencies(target_kind,target_id);
INSERT OR IGNORE INTO record_dependencies SELECT 'price',id,'ingredient',ingredient_id,'Price history: '||id FROM prices;
INSERT OR IGNORE INTO record_dependencies SELECT 'price',id,'supplier',json_extract(body,'$.supplierId'),'Supplier price history: '||id FROM prices;
INSERT OR IGNORE INTO record_dependencies SELECT 'recipe',d.id,json_extract(l.value,'$.kind'),json_extract(l.value,'$.referenceId'),'Recipe: '||json_extract(d.body,'$.name') FROM documents d,json_each(d.body,'$.lines') l WHERE d.kind='recipe';
INSERT OR IGNORE INTO record_dependencies SELECT 'version',v.recipe_id||':'||v.version,json_extract(l.value,'$.kind'),json_extract(l.value,'$.referenceId'),'Historic recipe: '||json_extract(v.body,'$.recipe.name')||' v'||v.version FROM recipe_versions v,json_each(v.body,'$.recipe.lines') l;
CREATE TRIGGER price_dependencies AFTER INSERT ON prices BEGIN
 INSERT INTO record_dependencies VALUES('price',NEW.id,'ingredient',NEW.ingredient_id,'Price history: '||NEW.id);
 INSERT INTO record_dependencies VALUES('price',NEW.id,'supplier',json_extract(NEW.body,'$.supplierId'),'Supplier price history: '||NEW.id);
END;
CREATE TRIGGER recipe_dependencies_insert AFTER INSERT ON documents WHEN NEW.kind='recipe' BEGIN
 INSERT OR IGNORE INTO record_dependencies SELECT 'recipe',NEW.id,json_extract(value,'$.kind'),json_extract(value,'$.referenceId'),'Recipe: '||json_extract(NEW.body,'$.name') FROM json_each(NEW.body,'$.lines');
END;
CREATE TRIGGER recipe_dependencies_update AFTER UPDATE ON documents WHEN NEW.kind='recipe' BEGIN
 DELETE FROM record_dependencies WHERE source_kind='recipe' AND source_id=NEW.id;
 INSERT OR IGNORE INTO record_dependencies SELECT 'recipe',NEW.id,json_extract(value,'$.kind'),json_extract(value,'$.referenceId'),'Recipe: '||json_extract(NEW.body,'$.name') FROM json_each(NEW.body,'$.lines');
END;
CREATE TRIGGER version_dependencies AFTER INSERT ON recipe_versions BEGIN
 INSERT OR IGNORE INTO record_dependencies SELECT 'version',NEW.recipe_id||':'||NEW.version,json_extract(value,'$.kind'),json_extract(value,'$.referenceId'),'Historic recipe: '||json_extract(NEW.body,'$.recipe.name')||' v'||NEW.version FROM json_each(NEW.body,'$.recipe.lines');
END;
CREATE TABLE dietary_reviews(id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL, recipe_kind TEXT NOT NULL DEFAULT 'recipe' CHECK(recipe_kind='recipe'), body TEXT NOT NULL,
 FOREIGN KEY(recipe_kind,recipe_id) REFERENCES documents(kind,id) ON DELETE RESTRICT);
