# test_db.py
import asyncio
import asyncpg

async def test():
    try:
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            user='store_user',
            password='store123',
            database='warehouse_store_db'
        )
        print("✅ Подключение успешно!")
        await conn.close()
    except Exception as e:
        print("❌ Ошибка:", e)

asyncio.run(test())