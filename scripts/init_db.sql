-- Создание таблиц
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0)
);

CREATE TABLE delivery_requests (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    rejectreason TEXT
);

CREATE TABLE delivery_request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
    approved_quantity INTEGER CHECK (approved_quantity >= 0)
);

 	-- db-scripts/add_users_table.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,  -- bcrypt hash
    role VARCHAR(20) NOT NULL CHECK (role IN ('store', 'warehouse')),
    entity_id INTEGER NOT NULL  -- ссылка на store_id или warehouse_id
);

ALTER TABLE delivery_requests
ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Индексы (опционально, но полезно)
CREATE INDEX idx_delivery_requests_store_id ON delivery_requests(store_id);
CREATE INDEX idx_delivery_request_items_request_id ON delivery_request_items(request_id);