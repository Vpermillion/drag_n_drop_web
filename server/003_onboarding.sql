BEGIN IMMEDIATE;
ALTER TABLE sites ADD COLUMN business_type TEXT NOT NULL DEFAULT 'services';
ALTER TABLE sites ADD COLUMN goal TEXT NOT NULL DEFAULT 'Хүсэлт цуглуулах';
UPDATE sites SET business_type='products',goal='Борлуулалт' WHERE theme='shop';
UPDATE sites SET business_type='bookings',goal='Цаг захиалах' WHERE theme='salon';
INSERT INTO schema_migrations(version) VALUES(3);
COMMIT;
