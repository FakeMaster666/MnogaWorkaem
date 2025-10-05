import psycopg2
import pandas as pd
from fastapi import FastAPI, HTTPException

app = FastAPI()

def get_conn():
    return psycopg2.connect(
        host="localhost",
        database="postgres",
        user="postgres",
        password="12345678"
    )

@app.get("/api/batteries")
def get_batteries():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name, chemistry, capacity, voltage, notes FROM batteries ORDER BY id LIMIT 50;")
                rows = cur.fetchall()
        return [
            {"id": r[0], "name": r[1], "chemistry": r[2], "capacity": r[3], "voltage": r[4], "notes": r[5]}
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(500, detail=str(e))
