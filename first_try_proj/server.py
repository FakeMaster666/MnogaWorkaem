import os
import shutil
import sys
import json
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


# =========================
# Config (ENV)
# =========================
DB_HOST = os.getenv("PGHOST", "localhost")
DB_PORT = int(os.getenv("PGPORT", "5432"))
DB_USER = os.getenv("PGUSER", "postgres")
DB_PASSWORD = os.getenv("PGPASSWORD", "12345678")
# DB_PASSWORD = os.getenv("PGPASSWORD", "1234")
DB_NAME = os.getenv("PGDATABASE", "postgres")

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


# =========================
# DB Pool
# =========================
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

# =========================
# FastAPI App (с lifespan)
# =========================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    _pool_init()
    yield
    # shutdown
    _pool_close()

app = FastAPI(title="Battery Experiments (psycopg2)", lifespan=lifespan)

# CORS (на всякий случай, чтобы HTML с того же сервера/доменов всё видел)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # при желании сузить
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статика
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# =========================
# Helpers: чтение файлов экспериментов
# =========================
def _read_table(path: str) -> pd.DataFrame:
    if not path:
        raise FileNotFoundError("experiment.table_path is empty")
    # Абсолютные/относительные пути — оставляем на совести оператора; можно добавить валидацию-белый список
    if not os.path.exists(path):
        raise FileNotFoundError(f"Data file not found: {path}")
    ext = os.path.splitext(path)[1].lower()
    if ext not in ALLOWED_EXT:
        raise ValueError(f"Unsupported file type: {ext}")

    if ext in {".csv", ".tsv"}:
        sep = "," if ext == ".csv" else "\t"
        df = pd.read_csv(path, sep=sep)
    else:
        # xlsx/xls: постараемся взять лист 'cycle', если он есть, иначе — первый лист
        try:
            xls = pd.ExcelFile(path)
            sheet = DEFAULT_XLSX_SHEET if DEFAULT_XLSX_SHEET in xls.sheet_names else xls.sheet_names[0]
            df = pd.read_excel(xls, sheet_name=sheet)
        except Exception:
            # fallback (прямое чтение по умолчанию)
            df = pd.read_excel(path)

    if len(df) > DATA_MAX_ROWS:
        df = df.iloc[:DATA_MAX_ROWS].copy()

    # нормализация названий столбцов к строкам
    df.columns = [str(c).strip() for c in df.columns]
    return df


# =========================
# Pages
# =========================
@app.get("/", response_class=HTMLResponse)
def root():
    index_path = os.path.join(TEMPLATES_DIR, "index_actual.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h2>Put index.html to ./static/index.html</h2>", status_code=200)


# =========================
# API
# =========================

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

@app.get("/api/batteries")
def api_batteries(
        limit: int = Query(20, ge=1, le=200), 
        offset: int = Query(0, ge=0),
        sort: Optional[str] = Query(None),
        order: Optional[str] = Query("asc")
    ) -> List[Dict]:

    """
    Возвращает список батарей с пагинацией.
    """

    valid_columns = {'Name', 'Chemistry', 'Capacity'}
    if sort not in valid_columns:
        sort = 'id'
    if order not in ['asc', 'desc']:
        order = 'asc'

    sql = f"""
        SELECT id, name, chemistry, capacity, voltage, notes
        FROM batteries
        ORDER BY {sort} {order}
        LIMIT %s OFFSET %s
    """

    # print(sql)
    
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (limit, offset))
            rows = cur.fetchall()
        out = []
        for r in rows:
            out.append({
                "id": r["id"],
                "name": r["name"],
                "chemistry": r["chemistry"],
                "capacity": float(r["capacity"]) if r["capacity"] is not None else None,
                # "voltage": float(r["voltage"]) if r["voltage"] is not None else None,
                "voltage": [float(v) for v in r["voltage"]] if r["voltage"] else None,
                "notes": r["notes"],

            })
        return out
    except Exception as e:
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.post("/api/batteries")
def api_create_battery(payload: Dict):
    """
    Создаёт батарею и возвращает её id.
    Ожидает JSON: { name, chemistry, capacity?, voltage?, notes? }
    """
    name = (payload.get("name") or "").strip()
    chemistry = (payload.get("chemistry") or "").strip()
    capacity = payload.get("capacity")
    voltage = payload.get("voltage")  # ждем список [min, max]
    notes = payload.get("notes")

    voltage_to_db = None
    if voltage != [None, None]:
        if not isinstance(voltage, list) or len(voltage) != 2: # проверка напряжений на корректность
            raise HTTPException(400, "voltage must be an array [min, max]")

        try:
            vmin = float(voltage[0])
            vmax = float(voltage[1])
        except Exception:
            raise HTTPException(400, "voltage items must be numeric")

        if vmin > vmax:
            raise HTTPException(400, "voltage[0] must be ≤ voltage[1]")

        voltage_to_db = [vmin, vmax]

    if not name or not chemistry:
        raise HTTPException(400, "Fields 'name' and 'chemistry' are required")

    sql = """
        INSERT INTO batteries(name, chemistry, capacity, voltage, notes)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, name, chemistry, capacity, voltage, notes
    """

    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (name, chemistry, capacity, voltage_to_db, notes))
            row = cur.fetchone()
        conn.commit()
        return {
            "id": row["id"],
            "name": row["name"],
            "chemistry": row["chemistry"],
            "capacity": float(row["capacity"]) if row["capacity"] is not None else None,
            "voltage": row["voltage"],  # это будет list из БД
            "notes": row["notes"],
        }
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn: put_conn(conn)


@app.get("/api/experiments")
def api_experiments(
        battery_id: int,
        limit: int = Query(50, ge=1, le=500),
        offset: int = Query(0, ge=0),
        sort: Optional[str] = Query(None),
        order: Optional[str] = Query("asc")
    ) -> List[Dict]:
    # print(sort)
    valid_columns = {'Format', 'Date', 'Duration'}
    if sort not in valid_columns:
        sort = 'id'
    if order not in ['asc', 'desc']:
        order = 'asc'

    """
    Эксперименты по выбранной батарее.
    """
    sql = f"""
        SELECT id, battery, format, table_path, date, duration, notes
        FROM experiments
        WHERE battery = %s
        ORDER BY {sort} {order}
        LIMIT %s OFFSET %s
    """

    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (battery_id, limit, offset))
            rows = cur.fetchall()
        out = []
        for r in rows:
            # date -> isoformat (если не None)
            dt = r["date"].isoformat() if r["date"] is not None else None
            out.append({
                "id": r["id"],
                "battery": r["battery"],
                "format": r["format"],
                "table_path": r["table_path"],
                "date": dt,
                "duration": float(r["duration"]) if r["duration"] is not None else None,
                "notes": r["notes"],
            })
        return out
    except Exception as e:
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn:
            put_conn(conn)


@app.get("/api/formats")
def get_formats() -> List[str]:
    sql = """SELECT DISTINCT format FROM experiments ORDER BY format"""
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(sql)
            return [row["format"] for row in cur.fetchall()]
    except Exception as e:
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn: put_conn(conn)



@app.get("/api/experiment/{exp_id}/columns")
def api_columns(exp_id: int) -> Dict[str, List[str]]:
    """
    Возвращает названия столбцов файла эксперимента.
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT table_path FROM experiments WHERE id = %s", (exp_id,))
            row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Experiment not found")
        path = row["table_path"]       
        df = _read_table(path)
        return {"columns": [str(c) for c in df.columns]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.get("/api/experiment/{exp_id}/data")
def api_plot_data(
    exp_id: int,
    x: str,
    ys: str = Query(..., description="comma-separated list of Y columns")
) -> Dict:
    """
    Возвращает данные для графика: массив X и словарь Y-серий.
    """
    y_list = [c for c in [c.strip() for c in ys.split(",")] if c]
    if not y_list:
        raise HTTPException(400, "At least one Y column is required")

    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT table_path FROM experiments WHERE id = %s", (exp_id,))
            row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Experiment not found")
        path = row["table_path"]
        df = _read_table(path)
    except HTTPException:
        if conn:
            put_conn(conn)
        raise
    except Exception as e:
        if conn:
            put_conn(conn)
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        # conn возвращаем в обоих случаях выше
        pass

    if x not in df.columns:
        raise HTTPException(400, f"X column '{x}' not found")
    for col in y_list:
        if col not in df.columns:
            raise HTTPException(400, f"Y column '{col}' not found")

    # сериализуем с None вместо NaN
    x_vals = df[x].where(pd.notna(df[x]), None).tolist()
    ys_dict: Dict[str, List] = {}
    for col in y_list:
        ys_dict[col] = df[col].where(pd.notna(df[col]), None).tolist()

    return {"x": x_vals, "ys": ys_dict}

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    battery_id: int = Form(...),
    notes: Optional[str] = Form(None),
    date_str: Optional[str] = Form(None),   # опционально: YYYY-MM-DD
    duration: Optional[float] = Form(None)  # опционально
):
    """
    Принимает файл + battery_id, сохраняет файл в UPLOAD_DIR,
    создаёт запись в experiments и возвращает JSON с battery_id и experiment_id.
    """
    # 1) Проверим, что батарея существует
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM batteries WHERE id = %s", (battery_id,))
            exists = cur.fetchone()
        if not exists:
            raise HTTPException(404, f"Battery {battery_id} not found")
    except HTTPException:
        if conn: put_conn(conn)
        raise
    except Exception as e:
        if conn: put_conn(conn)
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")

    # 2) Сохраним файл
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    # чтобы избежать коллизий имён, добавим штамп времени
    name, ext = os.path.splitext(file.filename)
    safe_name = f"{name}_{int(datetime.utcnow().timestamp())}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(500, detail=f"File write error: {type(e).__name__}: {e}")

    # 3) Определим формат по расширению
    fmt = ext.lower().lstrip(".")  # csv/tsv/xlsx/xls

    # 4) Дата (если передали строкой) → date
    exp_date = None
    if date_str:
        try:
            exp_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except Exception:
            # игнорируем неверный формат, оставим None
            exp_date = None

    # 5) Вставим запись в experiments
    sql_ins = """
        INSERT INTO experiments (battery, format, table_path, date, duration, notes)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """

    try:
        with conn.cursor() as cur:
            cur.execute(sql_ins, (battery_id, fmt, file_path, exp_date, duration, notes))
            row = cur.fetchone()
        conn.commit()
        exp_id = row["id"]
    except Exception as e:
        if conn: conn.rollback()
        # если ошибка БД, удалим уже записанный файл, чтобы не оставлять мусор
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
        raise HTTPException(500, detail=f"DB insert error: {type(e).__name__}: {e}")
    finally:
        if conn: put_conn(conn)

    return JSONResponse(
        content={
            "filename": safe_name,
            "status": "uploaded",
            "battery_id": battery_id,
            "experiment_id": exp_id
        }
    )

#########################################



# # Удаление элемента таблицы батарей
# @app.delete("/api/batteries/{battery_id}")
# def api_delete_battery(battery_id: int):
#     """
#     Удаляет батарею и все связанные эксперименты.
#     """
#     conn = None
#     try:
#         conn = get_conn()
#         with conn.cursor() as cur:
#             # Сначала удаляем эксперименты
#             cur.execute("DELETE FROM experiments WHERE battery = %s", (battery_id,))
#             # Затем удаляем батарею
#             cur.execute("DELETE FROM batteries WHERE id = %s", (battery_id,))
#         conn.commit()
#         return {"message": f"Battery {battery_id} and its experiments deleted"}
#     except Exception as e:
#         if conn: 
#             conn.rollback()
#         raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
#     finally:
#         if conn: 
#             put_conn(conn)



# # Удаление элемента таблицы экспериментов 
# @app.delete("/api/experiments/{experiment_id}")
# def api_delete_experiment(experiment_id: int):








#     """
#     Удаляет эксперимент.
#     """
#     conn = None
#     try:
#         conn = get_conn()
#         with conn.cursor() as cur:
#             cur.execute("DELETE FROM experiments WHERE id = %s", (experiment_id,))
#         conn.commit()
#         return {"message": f"Experiment {experiment_id} deleted"}
#     except Exception as e:
#         if conn: 
#             conn.rollback()
#         raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
#     finally:
#         if conn: 
#             put_conn(conn)

############################ Фильтр##################################

@app.get("/api/batteries/filter")
def api_batteries_filter(
    name: Optional[str] = Query(None),
    chemistry: Optional[str] = Query(None),
    capacity_min: Optional[float] = Query(None),
    capacity_max: Optional[float] = Query(None),
    voltage_min: Optional[float] = Query(None),
    voltage_max: Optional[float] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0)
) -> List[Dict]:

    conn = None
    try:
        conn = get_conn()
        
        # Базовый запрос
        sql = """
            SELECT id, name, chemistry, capacity, voltage, notes
            FROM batteries
            WHERE 1=1
        """
        params = []
        
        # Добавляем условия фильтрации
        if name:
            sql += " AND name ILIKE %s"
            params.append(f"%{name}%")
        
        if chemistry:
            sql += " AND chemistry = %s"
            params.append(chemistry)
            
        if capacity_min is not None:
            sql += " AND capacity >= %s"
            params.append(capacity_min)
            
        if capacity_max is not None:
            sql += " AND capacity <= %s"
            params.append(capacity_max)
            
        if voltage_min is not None:
            sql += " AND voltage[1] >= %s"
            params.append(voltage_min)
            
        if voltage_max is not None:
            sql += " AND voltage[2] <= %s"
            params.append(voltage_max)
        
        # Сортировка и пагинация
        sql += " ORDER BY id LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            
        out = []
        for r in rows:
            out.append({
                "id": r["id"],
                "name": r["name"],
                "chemistry": r["chemistry"],
                "capacity": float(r["capacity"]) if r["capacity"] is not None else None,
                "voltage": [float(v) for v in r["voltage"]] if r["voltage"] else None,
                "notes": r["notes"],
            })
        return out
        
    except Exception as e:
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn:
            put_conn(conn)

@app.get("/api/batteries/unique-chemistries")
def api_unique_chemistries() -> List[str]:
    """
    Возвращает список уникальных значений chemistry.
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT chemistry FROM batteries WHERE chemistry IS NOT NULL ORDER BY chemistry")
            rows = cur.fetchall()
        return [row["chemistry"] for row in rows]
    except Exception as e:
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn:
            put_conn(conn)

###########################################
# Обновление батареи
@app.put("/api/batteries/{battery_id}")
def api_update_battery(battery_id: int, payload: Dict):
    """
    Обновляет данные батареи.
    """
    conn = None
    try:
        conn = get_conn()
        
        # Собираем SET части запроса динамически
        set_parts = []
        params = []
        
        if "name" in payload:
            set_parts.append("name = %s")
            params.append(payload["name"])
            
        if "chemistry" in payload:
            set_parts.append("chemistry = %s")
            params.append(payload["chemistry"])
            
        if "capacity" in payload:
            set_parts.append("capacity = %s")
            params.append(payload["capacity"])
            
        if "voltage" in payload:
            voltage = payload["voltage"]
            if voltage != [None, None]:
                if not isinstance(voltage, list) or len(voltage) != 2:
                    raise HTTPException(400, "voltage must be an array [min, max]")
                
                try:
                    vmin = float(voltage[0]) if voltage[0] is not None else None
                    vmax = float(voltage[1]) if voltage[1] is not None else None
                except Exception:
                    raise HTTPException(400, "voltage items must be numeric")
                
                if vmin is not None and vmax is not None and vmin > vmax:
                    raise HTTPException(400, "voltage[0] must be ≤ voltage[1]")
                
                set_parts.append("voltage = %s")
                params.append([vmin, vmax])
            else:
                set_parts.append("voltage = %s")
                params.append(None)
                
        if "notes" in payload:
            set_parts.append("notes = %s")
            params.append(payload["notes"])
        
        if not set_parts:
            raise HTTPException(400, "No fields to update")
        
        # Добавляем ID в параметры
        params.append(battery_id)
        
        sql = f"""
            UPDATE batteries 
            SET {', '.join(set_parts)}
            WHERE id = %s
            RETURNING id, name, chemistry, capacity, voltage, notes
        """
        
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            
        if not row:
            raise HTTPException(404, f"Battery {battery_id} not found")
            
        conn.commit()
        return {
            "id": row["id"],
            "name": row["name"],
            "chemistry": row["chemistry"],
            "capacity": float(row["capacity"]) if row["capacity"] is not None else None,
            "voltage": row["voltage"],
            "notes": row["notes"],
        }
        
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn: put_conn(conn)

# Обновление эксперимента
@app.put("/api/experiments/{experiment_id}")
def api_update_experiment(experiment_id: int, payload: Dict):
    """
    Обновляет данные эксперимента.
    """
    conn = None
    try:
        conn = get_conn()
        
        set_parts = []
        params = []
        
        if "format" in payload:
            set_parts.append("format = %s")
            params.append(payload["format"])
            
        if "date" in payload:
            if payload["date"]:
                try:
                    exp_date = datetime.strptime(payload["date"], "%Y-%m-%d").date()
                    set_parts.append("date = %s")
                    params.append(exp_date)
                except Exception:
                    # Игнорируем неверный формат даты
                    pass
            else:
                set_parts.append("date = %s")
                params.append(None)
                
        if "duration" in payload:
            set_parts.append("duration = %s")
            params.append(payload["duration"])
            
        if "notes" in payload:
            set_parts.append("notes = %s")
            params.append(payload["notes"])
        
        if not set_parts:
            raise HTTPException(400, "No fields to update")
        
        params.append(experiment_id)
        
        sql = f"""
            UPDATE experiments 
            SET {', '.join(set_parts)}
            WHERE id = %s
            RETURNING id, battery, format, table_path, date, duration, notes
        """
        
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            
        if not row:
            raise HTTPException(404, f"Experiment {experiment_id} not found")
            
        conn.commit()
        
        dt = row["date"].isoformat() if row["date"] is not None else None
        return {
            "id": row["id"],
            "battery": row["battery"],
            "format": row["format"],
            "table_path": row["table_path"],
            "date": dt,
            "duration": float(row["duration"]) if row["duration"] is not None else None,
            "notes": row["notes"],
        }
        
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn: put_conn(conn)

# Удаление батареи
@app.delete("/api/batteries/{battery_id}")
def api_delete_battery(battery_id: int):
    """
    Удаляет батарею и все связанные эксперименты.
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            # Сначала удаляем эксперименты
            cur.execute("DELETE FROM experiments WHERE battery = %s", (battery_id,))
            # Затем удаляем батарею
            cur.execute("DELETE FROM batteries WHERE id = %s", (battery_id,))
        conn.commit()
        return {"message": f"Battery {battery_id} and its experiments deleted"}
    except Exception as e:
        if conn: 
            conn.rollback()
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn: 
            put_conn(conn)

# Удаление эксперимента
@app.delete("/api/experiments/{experiment_id}")
def api_delete_experiment(experiment_id: int):
    """
    Удаляет эксперимент.
    """
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM experiments WHERE id = %s", (experiment_id,))
        conn.commit()
        return {"message": f"Experiment {experiment_id} deleted"}
    except Exception as e:
        if conn: 
            conn.rollback()
        raise HTTPException(500, detail=f"{type(e).__name__}: {e}")
    finally:
        if conn: 
            put_conn(conn)






# =========================
# Entry (если запускаешь как python server.py)
# =========================
if __name__ == "__main__":
    # локальный запуск без uvicorn (для отладки) — не обязателен
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=5432, reload=True)
