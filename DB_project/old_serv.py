import os
import shutil
from typing import List, Dict, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Form
from fastapi.responses import JSONResponse
from datetime import datetime


import psycopg2
from psycopg2.pool import SimpleConnectionPool
import psycopg2.extras
import pandas as pd

from fastapi import Request
from fastapi.responses import RedirectResponse
import hashlib

# =========================
# Config (ENV)
# =========================
DB_HOST = os.getenv("PGHOST", "localhost")
DB_PORT = int(os.getenv("PGPORT", "5432"))

DB_USER = os.getenv("PGUSER", "postgres")
DB_PASSWORD = os.getenv("PGPASSWORD", "12345678")
DB_NAME = os.getenv("PGDATABASE", "batteries_v2")


# DB_USER = os.getenv("PGUSER", "roman666")
# DB_PASSWORD = os.getenv("PGPASSWORD", "12345")
# DB_NAME = os.getenv("PGDATABASE", "postgres")


# Ограничения/настройки
DATA_MAX_ROWS = int(os.getenv("DATA_MAX_ROWS", "200000"))  # максимум строк, считываемых из файла эксперимента
DEFAULT_XLSX_SHEET = os.getenv("DEFAULT_XLSX_SHEET", "cycle")  # дефолт-лист для .xlsx, если существует
ALLOWED_EXT = {".csv", ".tsv", ".xlsx", ".xls"}

# Пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
UPLOAD_DIR = os.path.join(BASE_DIR, "data_base")

# создаст, если нет
os.makedirs(UPLOAD_DIR, exist_ok=True)  
os.makedirs(TEMPLATES_DIR, exist_ok=True)  


_pool: Optional[SimpleConnectionPool] = None

def _pool_init() -> None:
    global _pool
    if _pool is None:
        _pool = SimpleConnectionPool(
            minconn=1,
            maxconn=int(os.getenv("PGPOOL_MAX", "10")),
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursor_factory=psycopg2.extras.DictCursor,
        )

def _pool_close() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None

def get_conn():
    """Взять соединение из пула. Не забывай закрывать (conn.close()), чтобы вернуть в пул."""
    if _pool is None:
        _pool_init()
    return _pool.getconn()

def put_conn(conn) -> None:
    if _pool is not None and conn is not None:
        _pool.putconn(conn)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    _pool_init()
    yield
    # shutdown
    _pool_close()

app = FastAPI(title="Battery Experiments (psycopg2)", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# CORS (на всякий случай, чтобы HTML с того ж]е сервера/доменов всё видел)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # при желании сузить
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse)
def root():
    index_path = os.path.join(TEMPLATES_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h2>Put index.html to ./static/index.html</h2>", status_code=200)


@app.get("/api/batteries/cells_type")
def api_cells_type() -> List[Dict]:
    """
    Возвращает список cell_type (+ количество батареек в каждом типе).
    """
    sql = """
        SELECT cell_type, COUNT(*) AS count
        FROM batteries
        WHERE cell_type IS NOT NULL AND cell_type <> ''
        GROUP BY cell_type
        ORDER BY cell_type ASC
    """

    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)


@app.get("/api/batteries/batches")
def api_batches(
    # cells_type: str = Query(..., description="Filter batches by cell_type")
    cells_type: Optional[str] = Query(None),

) -> List[Dict]:
    """
    Возвращает список партий (batch) для заданного cell_type (+ количество).
    """
    sql = """
      SELECT batch, COUNT(*) AS count
      FROM batteries
      WHERE cell_type = %s
        AND batch IS NOT NULL 
      GROUP BY batch
      ORDER BY batch ASC
    """


    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (cells_type,))
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)


@app.get("/api/tables/batteries")
def api_batteries(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: str = Query(None),
    order: str = Query("asc"),
    cells_type: Optional[str] = Query(None),
    batch: Optional[int] = Query(None),
    columns: Optional[List[str]] = Query(None)
) -> List[Dict]:
    default_cols = ["id","cell_name","batch","manufacturer",
                    "chemistry_family","capacity_nom","voltage_nom"]

    allowed_cols = set(get_column_names("batteries"))

    selected_cols_raw = columns if columns else default_cols
    selected_cols = [c for c in selected_cols_raw if c in allowed_cols]
    if not selected_cols:
        selected_cols = [c for c in default_cols if c in allowed_cols] or ["id"]

    sort_field = sort if (sort in allowed_cols) else "id"
    order_dir = order if order in ["asc", "desc"] else "asc"

    where_parts = []
    params: list = []

    if cells_type is not None:
        where_parts.append("cell_type = %s")
        params.append(cells_type)

    if batch is not None:
        where_parts.append("batch = %s")
        params.append(batch)

    where_sql = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""

    sql = f"""
        SELECT {', '.join(selected_cols)}
        FROM batteries
        {where_sql}
        ORDER BY {sort_field} {order_dir}
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])

    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)


@app.get("/api/health")
def health():
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
            one = cur.fetchone()
        return {"ok": True, "db": one[0] == 1}
    except Exception as e:
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn:
            put_conn(conn)


@app.get("/api/tables/experiments")
def api_experiments(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: str = Query(None),
    order: str = Query("asc"),
    batch: str = Query(None),
    battery_id: int = Query(None)
) -> List[Dict]:
    """
    Возвращает список экспериментов.
    columns: список колонок для выборки.
    sort:  параметр сортировки
    order: порядок сортировки
    """
    default_cols = ["id",  "experiment_type"]
    
    sort_field = sort if sort in default_cols else "id"
    order_dir = order if order in ["asc", "desc"] else "asc"
    
    """
    1 запрос это эксперименты КОНКРЕТНОЙ батарейки
    """
    sql_1 = f"""
        SELECT e.{', e.'.join(default_cols)}, b.cell_name
        FROM experiments e
        JOIN batteries b ON e.battery = b.id
        WHERE b.id = %s
        ORDER BY {sort_field} {order_dir}
        LIMIT %s OFFSET %s
    """

    """
    2 запрос это все эксперименты конкретной партии
    """
    sql_2 = f"""
        SELECT e.{', e.'.join(default_cols)}, b.cell_name
        FROM experiments e
        JOIN batteries b ON e.battery = b.id
        WHERE b.batch = %s
        ORDER BY {sort_field} {order_dir}
        LIMIT %s OFFSET %s
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            if battery_id:
                cur.execute(sql_1, (battery_id, limit, offset))
            else:
                cur.execute(sql_2, (batch, limit, offset))
            rows = cur.fetchall()
        return rows
        
    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.post("/api/tables/batteries")
def api_create_battery(payload: Dict ):
    """Создает батарею."""
    columns = get_column_names("batteries")
    data = {k: v for k, v in payload.items() if k in columns}

    if not data:
        raise HTTPException(400, detail="Invalid data")
    
    cols = ', '.join(data.keys())
    vals = ', '.join(['%s'] * len(data))
    sql = f"""
    INSERT INTO batteries ({cols}) VALUES ({vals});
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            sql,
            list(data.values())
        )
        conn.commit()

@app.get("/api/tables/{table_name}")
def get_column_names(table_name: str) -> List[str]:
    """
    Функция для получения названий колонок таблицы table_name
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT column_name
                FROM information_schema.columns 
                WHERE table_name = %s
                ORDER BY ordinal_position;
            """, (table_name,))
            columns = cur.fetchall()
            return [col["column_name"] for col in columns]
            
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to get column names: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.patch("/api/tables/batteries/{battery_id}")
def api_change_battery(payload: Dict , battery_id: str):
    """Меняет существующую батарею."""
    columns = get_column_names("batteries")
    data = {k: v for k, v in payload.items() if k in columns}

    if not data:
        raise HTTPException(400, detail="Invalid data")
    
    set_clause = ', '.join([f"{col} = %s" for col in data.keys()])

    sql = f"""
    UPDATE batteries SET {set_clause} WHERE id = %s
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            sql,
            list(data.values())+[int(battery_id)]
        )
        conn.commit()

@app.delete("/api/tables/batteries/{key}/{value}")
def api_delete_battery(key: str, value: str):
    """Удаляет батарею / партию / архитектуру"""

    if key == 'id':
        value = int(value)
    sql_1 = f"""
    DELETE FROM batteries WHERE {key} = %s
    """
    sql_2 = f"""
    DELETE FROM experiments e USING batteries b  
    WHERE e.battery = b.id AND b.{key} = %s
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql_1, (value,))
        cur.execute(sql_2, (value,))
        conn.commit()

@app.delete("/api/tables/experiments/{experiment_id}")
def api_delete_battery(experiment_id: int):
    """Удаляет эксперимент"""

    sql_1 = f"""
    DELETE FROM experiments WHERE id = %s
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql_1, (experiment_id,))
        conn.commit()

