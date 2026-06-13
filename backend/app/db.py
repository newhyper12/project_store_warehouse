"""Single async Database connection shared by all routers."""
from databases import Database

from .config import get_settings

settings = get_settings()

# `databases` understands the plain postgres scheme; strip the +asyncpg part.
_url = settings.database_url.replace("postgresql+asyncpg", "postgresql")
db = Database(_url)
