# backend/database.py
from databases import Database
from dotenv import load_dotenv
import os


# путь к .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "warehouse_store_db")

# Подключение для магазина
STORE_DB_URL = f"postgresql://{os.getenv('STORE_DB_USER')}:{os.getenv('STORE_DB_PASS')}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
store_db = Database(STORE_DB_URL)

# Подключение для склада
WAREHOUSE_DB_URL = f"postgresql://{os.getenv('WAREHOUSE_DB_USER')}:{os.getenv('WAREHOUSE_DB_PASS')}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
warehouse_db = Database(WAREHOUSE_DB_URL)