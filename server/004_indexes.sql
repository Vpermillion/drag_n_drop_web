BEGIN IMMEDIATE;
CREATE INDEX IF NOT EXISTS orders_expiry ON orders(status,expires);
CREATE INDEX IF NOT EXISTS catalog_site ON catalog(site_id,archived);
CREATE INDEX IF NOT EXISTS bookings_resource_time ON bookings(site_id,status,starts,ends);
CREATE INDEX IF NOT EXISTS audit_workspace ON audit(workspace_id);
CREATE INDEX IF NOT EXISTS messages_workspace ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS inquiries_workspace ON inquiries(workspace_id);
INSERT INTO schema_migrations(version) VALUES(4);
COMMIT;
