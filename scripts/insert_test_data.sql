-- Создаём пользователей
INSERT INTO users (username, password_hash, role, entity_id) VALUES
('store1', '$2b$12$...', 'store', 101),      -- хэш пароля "password1"
('store2', '$2b$12$...', 'store', 102),
('warehouseA', '$2b$12$...', 'warehouse', 101), -- тот же entity_id = 101 → обслуживает store1
('warehouseB', '$2b$12$...', 'warehouse', 102);