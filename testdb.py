# test_conn.py
import asyncio
import asyncpg

async def test():
    try:
        print("Попытка подключения к PostgreSQL...")
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            user='store_user',
            password='store123',
            database='warehouse_store_db'
        )
        print("✅ Успешно подключились как admin!")
        await conn.close()

        # Проверим подключение от имени store_user
        conn2 = await asyncpg.connect(
            host='localhost',
            port=5432,
            user='store_user',
            password='store123',
            database='warehouse_store_db'
        )
        print("✅ Успешно подключились как store_user!")
        await conn2.close()

    except Exception as e:
        print("❌ Ошибка подключения:", e)

asyncio.run(test())