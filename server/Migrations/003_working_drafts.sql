CREATE TABLE working_drafts (
 kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL,
 body TEXT NOT NULL, request_id TEXT NOT NULL, updated_at TEXT NOT NULL,
 result TEXT, PRIMARY KEY(kind,id)
);
