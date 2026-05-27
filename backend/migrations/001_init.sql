CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'STAFF' CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_order_code SERIAL,
    vapi_call_id VARCHAR(255) UNIQUE NOT NULL,
    restaurant_name VARCHAR(255),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    subtotal DECIMAL(10, 2),
    tax_rate DECIMAL(5, 4),
    tax DECIMAL(10, 2),
    total DECIMAL(10, 2),
    pickup_eta_minutes INTEGER,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'KITCHEN_QUEUED', 'REJECTED', 'READY_FOR_PICKUP', 'PAID')),
    reject_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order Lines Table
CREATE TABLE IF NOT EXISTS order_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    line_id VARCHAR(255),
    item_id VARCHAR(255),
    name VARCHAR(255),
    quantity INTEGER,
    line_subtotal DECIMAL(10, 2),
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order Modifiers Table
CREATE TABLE IF NOT EXISTS order_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_line_id UUID REFERENCES order_lines(id) ON DELETE CASCADE,
    name VARCHAR(255),
    option_name VARCHAR(255),
    price DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session Table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
