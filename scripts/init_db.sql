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


-- 1. Обновляем роли в таблице users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('store', 'warehouse', 'customer', 'supplier', 'admin'));

-- Делаем entity_id необязательным для customers и suppliers
ALTER TABLE users ALTER COLUMN entity_id DROP NOT NULL;

-- 2. Добавляем цену в products
ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;

-- 3. Таблица 7: Категории товаров
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- 4. Таблица 8: Покупатели (клиенты магазина)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Таблица 9: Заказы покупателей
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'shipped', 'delivered', 'cancelled')),
    total_amount DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Таблица 10: Товары в заказе
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL
);

-- 7. Таблица 11: Поставщики
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Таблица 12: Поставки от поставщиков на склад
CREATE TABLE IF NOT EXISTS shipments (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')),
    expected_date DATE,
    received_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Связующая таблица: Товары в поставке
CREATE TABLE IF NOT EXISTS shipment_items (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL
);

-- 10. Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_supplier_id ON shipments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_warehouse_id ON shipments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
