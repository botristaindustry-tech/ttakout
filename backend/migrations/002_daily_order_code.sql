-- Change daily_order_code from SERIAL to plain INTEGER
-- so it can be set manually per-day by the webhook handler
ALTER TABLE orders ALTER COLUMN daily_order_code DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN daily_order_code TYPE INTEGER;
DROP SEQUENCE IF EXISTS orders_daily_order_code_seq;
