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