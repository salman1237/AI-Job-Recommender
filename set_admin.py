import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

load_dotenv()

engine = create_async_engine(os.getenv("DATABASE_URL"))
Session = async_sessionmaker(engine, expire_on_commit=False)

async def run():
    email = "salmanahmed382.jubair@gmail.com"
    async with Session() as s:
        await s.execute(text(f"UPDATE users SET role = 'admin' WHERE email = '{email}'"))
        await s.commit()
        result = await s.execute(text("SELECT id, email, role FROM users"))
        print("\n=== Users in DB ===")
        for row in result:
            print(f"  id={row[0]}  email={row[1]}  role={row[2]}")
        print("===================\n")

asyncio.run(run())
