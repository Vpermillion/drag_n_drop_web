BEGIN IMMEDIATE;
CREATE TABLE reply_requests(workspace_id TEXT NOT NULL REFERENCES workspaces(id),request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(workspace_id,request_key));
INSERT INTO schema_migrations(version) VALUES(5);
COMMIT;
