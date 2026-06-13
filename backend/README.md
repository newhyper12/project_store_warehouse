# Backend

FastAPI + PostgreSQL + JWT.

## Local dev

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# create DB and run migration:
createdb store_db
psql store_db < migrations/001_init.sql
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
python -m app.scripts.seed
```

Docs: <http://localhost:8000/docs>.

## Docker

```bash
docker build -t store-backend .
docker run -d --env-file .env -p 8000:8000 store-backend
```

Or use the root `docker-compose.yml` (recommended — boots Postgres too).

## Layout

```
app/
  main.py            FastAPI app + CORS + startup
  config.py          pydantic-settings (.env)
  db.py              async Database connection
  security.py        bcrypt + JWT + get_current_user / require_role
  schemas.py         Pydantic request/response models
  routers/
    auth.py
    customer.py
    store.py
    warehouse.py
    supplier.py
  scripts/
    seed.py          inserts demo users, products, categories
migrations/
  001_init.sql       full schema, indexes, status_history
```

## Production notes

- Set `SECRET_KEY` to `openssl rand -hex 32`.
- Set `CORS_ORIGINS` to your frontend domains only — never `*`.
- Run behind a reverse proxy (nginx/Caddy) terminating TLS.
- Use a managed Postgres or pin volume backups.
- `uvicorn --workers N` or use `gunicorn -k uvicorn.workers.UvicornWorker`.
