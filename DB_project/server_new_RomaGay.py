import os
import shutil
from typing import List, Dict, Optional, Any
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


import json
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
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static") # Платон добавил эту строчку

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
    index_path = os.path.join(TEMPLATES_DIR, "index.html") # Платон замена "index_actual.html" на "index.html" 
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h2>Put index.html to ./static/index.html</h2>", status_code=200)

@app.get("/api/batteries/cells_type") # Платон добавил s в cells и убрал в types
def api_cells_type(
    sort: str = Query(None),
    order: str = Query("asc") # Платон добавил агрументы для сортировки и их обработку
) -> List[Dict]: # Платон добавил s в cells и убрал в types
    """
    Возвращает список cell_type (+ количество батареек в каждом типе).
    """

    allowed_cols = ['cell_type, count']
    sort_field = sort if (sort in allowed_cols) else "cell_type"
    order_dir = order if order in ["asc", "desc"] else "asc"

    sql = f"""
        SELECT cell_type, COUNT(*) AS count
        FROM batteries
        WHERE cell_type IS NOT NULL AND cell_type <> ''
        GROUP BY cell_type
        ORDER BY {sort_field} {order_dir}
    """
    # Платон заменил cnt на count

    # print(sql)

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


@app.get("/api/batteries/batches") # Платон добавил новую функцию
def api_batches(
    # cells_type: str = Query(..., description="Filter batches by cell_type")
    cells_type: Optional[str] = Query(None),
    sort: str = Query(None),
    order: str = Query("asc")

) -> List[Dict]:
    """
    Возвращает список партий (batch) для заданного cell_type (+ количество).
    """

    allowed_cols = ['batch, count']
    sort_field = sort if (sort in allowed_cols) else "batch"
    order_dir = order if order in ["asc", "desc"] else "asc"

    sql = f"""
      SELECT batch, COUNT(*) AS count
      FROM batteries
      WHERE cell_type = %s
        AND batch IS NOT NULL 
      GROUP BY batch
      ORDER BY {sort_field} {order_dir}
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


def get_data_type(table_name: str , column: str) -> str:
    """
    Функция, которая возвращает тип данных колонки
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT data_type
                FROM information_schema.columns 
                WHERE table_name = %s and column_name = %s
                ORDER BY ordinal_position;
            """, (table_name, column))
            data_type = cur.fetchall() 

        return data_type[0]
    
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to get column names: {e}")
    finally:
        if conn:
            put_conn(conn)
    
def convert_value_for_column(value: Any, column: str, column_type: str) -> Any:
    """Преобразовать значение к типу колонки PostgreSQL"""
    if value is None:
        return None
    
    try:
        if column_type in {'smallint', 'integer', 'bigint', 'serial', 'bigserial'}:
            return int(value)
        
        elif column_type in {'decimal', 'numeric', 'real', 'double precision', 'float'}:
            return float(value)
        
        elif column_type == 'boolean':
            if isinstance(value, str):
                return value.lower() in ('true', 't', 'yes', 'y', '1')
            return bool(value)
        
        elif column_type in {'date'}:
            if isinstance(value, str):
                return value  # PostgreSQL сам преобразует строку в date
            elif isinstance(value, datetime.date):
                return value.isoformat()
        
        elif column_type in {'timestamp', 'timestamp with time zone', 
                           'timestamp without time zone'}:
            if isinstance(value, str):
                return value
            elif isinstance(value, datetime.datetime):
                return value.isoformat()
        
        else:
            return str(value)
            
    except (ValueError, TypeError) as e:
        raise HTTPException(
            400,
            detail=f"Cannot convert value '{value}' to type {column_type} "
                  f"for column '{column}': {e}"
        )

# region
# @app.get("/api/tables/batteries")
# def api_batteries(
#     limit: int = Query(20, ge=1, le=200),
#     offset: int = Query(0, ge=0),
#     sort: str = Query(None),
#     order: str = Query("asc"),
#     columns: Optional[List[str]] = Query(None),
#     filter: Optional[Dict] = Query(None)
# ) -> List[Dict]:
#     """
#     Возвращает список батарей.
#     columns: список колонок для выборки.
#     sort:  параметр сортировки
#     order: порядок сортировки

#     """
#     default_cols = ["id", "cell_name", "batch", "manufacturer", "chemistry_family", "capacity_nom", "voltage_nom"]
#     selected_cols = columns if columns else default_cols
    
#     sort_field = sort if sort in selected_cols else "id"
#     order_dir = order if order in ["asc", "desc"] else "asc"
    
#     sql = f"""
#         SELECT {', '.join(selected_cols)}
#         FROM batteries
#         ORDER BY {sort_field} {order_dir}
#         LIMIT %s OFFSET %s
#     """

#     conn = None
#     try:
#         conn = get_conn()
#         with conn.cursor() as cur:
#             cur.execute(sql, (limit, offset))
#             rows = cur.fetchall()
#         return rows
        
#     except Exception as e:
#         raise HTTPException(500, detail=f"Database error: {e}")
#     finally:
#         if conn:
#             put_conn(conn)
# endregion

@app.get("/api/tables/batteries")
def api_batteries(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: str = Query(None),
    order: str = Query("asc"),
    columns: Optional[List[str]] = Query(None),
    filter_str: Optional[str] = Query(None)
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

    filter_dict = None
    if filter_str:
        try:
            filter_dict = json.loads(filter_str)
        except json.JSONDecodeError:
            raise HTTPException(400, detail="Invalid filter JSON")

    where_parts = []
    params = []

    if filter_dict is not None:
        for column, value in filter_dict.items():
            if column not in allowed_cols:
                continue             
            if isinstance(value, list) and len(value) == 2:
                column_type = get_data_type('batteries', column)
                min_val = convert_value_for_column(value[0], column, column_type)
                max_val = convert_value_for_column(value[1], column, column_type)
                
                if min_val is not None and max_val is not None:
                    where_parts.append(f"{column} BETWEEN %s AND %s")
                    params.extend([min_val, max_val])
                elif min_val is not None:
                    where_parts.append(f"{column} >= %s")
                    params.append(min_val)
                elif max_val is not None:
                    where_parts.append(f"{column} <= %s")
                    params.append(max_val)
            elif isinstance(value, str) or isinstance(value, int): # Платон добавил int
                where_parts.append(f"{column} = %s")
                params.append(value)
            
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

@app.get("/api/tables/{table_name}")
def get_column_names(table_name: str) -> List[str]:
    """
    Функция для получения названий колонок таблицы table_name
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("""
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

# @app.get("/api/tables/experiments")
# def api_experiments(
#     limit: int = Query(20, ge=1, le=200),
#     offset: int = Query(0, ge=0),
#     sort: str = Query(None),
#     order: str = Query("asc"),
#     batch: str = Query(None),
#     battery_id: int = Query(None)
# ) -> List[Dict]:
#     """
#     Возвращает список экспериментов.
#     columns: список колонок для выборки.
#     sort:  параметр сортировки
#     order: порядок сортировки
#     """
#     default_cols = ["id",  "experiment_type"]
    
#     sort_field = sort if sort in default_cols else "id"
#     order_dir = order if order in ["asc", "desc"] else "asc"
    
#     """
#     1 запрос это эксперименты КОНКРЕТНОЙ батарейки
#     """
#     sql_1 = f"""
#         SELECT e.{', e.'.join(default_cols)}, b.cell_name
#         FROM experiments e
#         JOIN batteries b ON e.battery = b.id
#         WHERE b.id = %s
#         ORDER BY {sort_field} {order_dir}
#         LIMIT %s OFFSET %s
#     """

#     """
#     2 запрос это все эксперименты конкретной партии
#     """
#     sql_2 = f"""
#         SELECT e.{', e.'.join(default_cols)}, b.cell_name
#         FROM experiments e
#         JOIN batteries b ON e.battery = b.id
#         WHERE b.batch = %s
#         ORDER BY {sort_field} {order_dir}
#         LIMIT %s OFFSET %s
#     """
#     conn = None
#     try:
#         conn = get_conn()
#         with conn.cursor() as cur:
#             if battery_id:
#                 cur.execute(sql_1, (battery_id, limit, offset))
#             else:
#                 cur.execute(sql_2, (batch, limit, offset))
#             rows = cur.fetchall()
#         return rows
        
#     except Exception as e:
#         raise HTTPException(500, detail=f"Database error: {e}")
#     finally:
#         if conn:
#             put_conn(conn)

@app.get("/api/tables/experiments")
def api_experiments(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: Optional[str] = Query(None),
    order: str = Query("asc"),
    columns: Optional[List[str]] = Query(None),
    cell_type: Optional[str] = Query(None),
    batch: Optional[int] = Query(None),
    battery_id: Optional[int] = Query(None),
) -> List[Dict]:

    default_cols = ["e.id", "b.cell_name", "e.experiment_type"]

    allowed_cols = set(["b."+ i for i in get_column_names("batteries")] + ["e."+ i for i in get_column_names("experiments")])
    
    selected_cols_raw = columns if columns else default_cols
    selected_cols = [c for c in selected_cols_raw if c in allowed_cols]

    if not selected_cols:
        selected_cols = [c for c in default_cols if c in allowed_cols] or ["e.id"]

    sort_field = sort if (sort in allowed_cols) else "e.id"
    order_dir = order if order in ["asc", "desc"] else "asc"

    where_parts = []
    params: list = []

    if cell_type is None:
        return []
    
    if batch is not None:
        where_parts.append("b.batch = %s")
        params.append(batch)
    elif battery_id is not None:
        where_parts.append("b.id = %s")
        params.append(battery_id)
        if 'b.batch' not in selected_cols: selected_cols.append('b.batch')
    else:
        return [] # ну или ошибку сюда дописать какую нибудь
    
    where_parts.append("b.cell_type = %s")
    params.append(cell_type)

    where_sql = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""

    sql = f"""
        SELECT {", ".join(selected_cols)}
        FROM experiments e
        JOIN batteries b ON e.battery = b.id
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



@app.post("/api/tables/batteries/{user}")
def api_create_battery(payload: Dict, user: str ):
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
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                sql,
                list(data.values())
            )
            result = cur.fetchone()
        conn.commit()
        message = f'User {user} added battery {payload["cell_name"]} with id {result[0]} to the table'
        update('batteries', user, message)
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)


@app.post("/api/upload/{user}")


@app.patch("/api/tables/batteries/{battery_id}/{user}")
def api_change_battery(payload: Dict , battery_id: str, user:str):
    """Меняет существующую батарею."""
    columns = get_column_names("batteries")
    data = {k: v for k, v in payload.items() if k in columns}

    if not data:
        raise HTTPException(400, detail="Invalid data")
    
    set_clause = ', '.join([f"{col} = %s" for col in data.keys()])

    sql = f"""
    UPDATE batteries SET {set_clause} WHERE id = %s
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                sql,
                list(data.values())+[int(battery_id)]
            )
            conn.commit()
            message = f'User {user} changed battery {payload["cell_name"]} with id {battery_id} in the table'
            update('batteries', user, message)
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)    

@app.delete("/api/tables/batteries/{battery_id}/{user}")
def api_delete_battery(battery_id: str, user: str):
    """Удаляет батарею / партию / архитектуру"""

    sql_1 = f"""
    DELETE FROM batteries WHERE id = %s
    """
    sql_2 = f"""
    DELETE FROM experiments e USING batteries b  
    WHERE e.battery = b.id AND b.id = %s
    """  
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql_1, (int(battery_id),))
            cur.execute(sql_2, (int(battery_id),))
        conn.commit()
        message = f'User {user} deleted battery with id {battery_id} from the table'
        update('batteries', user, message)
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.delete("/api/tables/experiments/{experiment_id}/{user}")
def api_delete_battery(experiment_id: int):
    """Удаляет эксперимент"""

    sql = f"""
    DELETE FROM experiments WHERE id = %s
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (experiment_id,))
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)  

@app.get("/api/tables/users")
def api_users()-> List[Dict]:
    sql = """
    SELECT id, login FROM users
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

@app.get("/api/tables/updates")
def api_updates() -> List[Dict]:
    sql = """
    SELECT * FROM updates
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

def update(table_name: str , user_name: str , message: str):
    
    sql = """
    INSERT INTO updates (from_table, username, update_date, notes)
    VALUES ( %s, %s, NOW(), %s)
    """
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (table_name, user_name, message))
            conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(500, detail=f"Database error: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.post("/api/sign_up")
def api_sign_up(payload: Dict):
    """
    Регистрация нового пользователя
    """
    login = payload.get("login", "").strip()
    password = payload.get("password", "").strip()
    
    if not login or not password:
        raise HTTPException(400, "Login and password are required")
    
    if len(login) < 3:
        raise HTTPException(400, "Login must be at least 3 characters")
    
    if len(password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")
    
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE login = %s", (login,))
            if cur.fetchone():
                raise HTTPException(400, "User already exists")
            
            hashed_password = hashlib.sha256(password.encode()).hexdigest()
            cur.execute(
                "INSERT INTO users (login, password) VALUES (%s, %s) RETURNING id",
                (login, hashed_password)
            )
            user_id = cur.fetchone()["id"]
        
        conn.commit()
        return {"success": True, "message": "Registration successful", "user_id": user_id}
        
    except HTTPException:
        raise
    except Exception as e:
        if conn: 
            conn.rollback()
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.get("/api/sign_in")
def api_sign_in(payload: Dict):
    login = payload.get("login", "").strip()
    password = payload.get("password", "").strip()

    if not login or not password:
        raise HTTPException(400, "Login and password are required")
    
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, login, password FROM users WHERE login = %s", 
                (login,)
            )
            user = cur.fetchone()
        
        if not user:
            raise HTTPException(401, "Invalid login or password")
        
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        if user["password"] != hashed_password:
            raise HTTPException(401, "Invalid login or password")
        
        return login
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn:
            put_conn(conn)    