-- Удаление, если существуют (для повторного запуска)
DROP ROLE IF EXISTS store_user;
DROP ROLE IF EXISTS warehouse_user;

-- Создание ролей
CREATE ROLE store_user WITH LOGIN PASSWORD 'store123';
CREATE ROLE warehouse_user WITH LOGIN PASSWORD 'warehouse123';

-- Права на таблицы

-- Магазин: может читать только часть полей из products
GRANT SELECT (id, name, description) ON products TO store_user;

-- Магазин: может создавать и читать СВОИ запросы
GRANT SELECT, INSERT ON delivery_requests TO store_user;
GRANT USAGE ON SEQUENCE delivery_requests_id_seq TO store_user;

GRANT SELECT, INSERT ON delivery_request_items TO store_user;
GRANT USAGE ON SEQUENCE delivery_request_items_id_seq TO store_user;

-- Склад: полный доступ к products
GRANT SELECT, UPDATE, INSERT, DELETE ON products TO warehouse_user;
GRANT USAGE ON SEQUENCE products_id_seq TO warehouse_user;

-- Склад: может читать и обновлять запросы
GRANT SELECT, UPDATE ON delivery_requests TO warehouse_user;
GRANT SELECT, UPDATE ON delivery_request_items TO warehouse_user;

GRANT SELECT, UPDATE ON products TO warehouse_user;
GRANT SELECT, UPDATE ON delivery_requests TO warehouse_user;
GRANT SELECT, UPDATE ON delivery_request_items TO warehouse_user;
GRANT SELECT ON users TO warehouse_user;  -- ← добавлено

-- Последовательности (если нужно INSERT)
GRANT USAGE ON SEQUENCE products_id_seq TO warehouse_user;
-- ... и другие sequences при необходимости



-- Создание новых ролей
DROP ROLE IF EXISTS customer_user;
DROP ROLE IF EXISTS supplier_user;

CREATE ROLE customer_user WITH LOGIN PASSWORD 'customer123';
CREATE ROLE supplier_user WITH LOGIN PASSWORD 'supplier123';

-- Права для customer_user (покупатель)
GRANT SELECT (id, name, description, price, category_id) ON products TO customer_user;
GRANT SELECT ON categories TO customer_user;
GRANT SELECT, INSERT ON orders TO customer_user;
GRANT USAGE ON SEQUENCE orders_id_seq TO customer_user;
GRANT SELECT, INSERT ON order_items TO customer_user;
GRANT USAGE ON SEQUENCE order_items_id_seq TO customer_user;
GRANT SELECT ON customers TO customer_user;

-- Права для supplier_user (поставщик)
GRANT SELECT ON suppliers TO supplier_user;
GRANT SELECT, INSERT ON shipments TO supplier_user;
GRANT USAGE ON SEQUENCE shipments_id_seq TO supplier_user;
GRANT SELECT, INSERT ON shipment_items TO supplier_user;
GRANT USAGE ON SEQUENCE shipment_items_id_seq TO supplier_user;
GRANT SELECT ON products TO supplier_user;
GRANT SELECT ON warehouses TO supplier_user;
