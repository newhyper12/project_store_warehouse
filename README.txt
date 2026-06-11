warehouse-store-project/
│
├── server/                     # ← ВСЁ, что развёртывается на ПК3 (сервер)
│   ├── main.py                 # Точка входа FastAPI
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── store_api.py        # API для магазина
│   │   ├── warehouse_api.py    # API для склада
│   │   └── database.py         # Подключения к БД (store_user, warehouse_user)
│   ├── .env                    # Переменные окружения (не коммитить!)
│   └── requirements.txt        # Зависимости Python
│
├── frontend-store/             # ← Развёртывается на ПК1 (магазин)
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── warehouse.ts    # ← нет, только store
│   │   ├── components/
│   │   │   ├── ProductList.tsx
│   │   │   ├── Cart.tsx
│   │   │   └── StoreRequests.tsx
│   │   ├── pages/
│   │   │   └── StorePage.tsx
│   │   ├── types/
│   │   │   └── index.ts        # Типы: Product, DeliveryRequest и т.д.
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.js          # Фиксированный порт: 3000
│   ├── tsconfig.json
│   └── package.json
│
├── frontend-warehouse/         # ← Развёртывается на ПК2 (склад)
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── api/
│   │   │   └── warehouse.ts
│   │   ├── components/
│   │   │   ├── RequestQueue.tsx
│   │   │   ├── RequestActions.tsx
│   │   │   └── RejectModal.tsx
│   │   ├── pages/
│   │   │   └── WarehousePage.tsx
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.js          # Фиксированный порт: 3000
│   ├── tsconfig.json
│   └── package.json
│
├── db-scripts/                 # ← Выполняется на ПК3 (вручную или через psql)
│   ├── init_db.sql             # CREATE TABLE ...
│   ├── setup_roles.sql         # CREATE ROLE + GRANT ...
│   └── alter_add_reject_reason.sql  # ALTER TABLE ... ADD COLUMN reject_reason
│
├── docs/
│   ├── network-diagram.puml    # Схема взаимодействия (PlantUML)
│   ├── report.pdf              # Пояснительная записка
│   └── presentation.pptx       # Презентация
│
└── README.md                   # Инструкция по развёртыванию