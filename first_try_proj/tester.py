import pandas as pd
import os


DATA_MAX_ROWS = int(os.getenv("DATA_MAX_ROWS", "200000"))  # максимум строк, считываемых из файла эксперимента
DEFAULT_XLSX_SHEET = os.getenv("DEFAULT_XLSX_SHEET", "cycle")  # дефолт-лист для .xlsx, если существует
ALLOWED_EXT = {".csv", ".tsv", ".xlsx", ".xls"}

path = r"C:\Users\Roman\Documents\tt_labs\батарейки1\ёмкость\240078-2-4-2818575440.xls"

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
            df = pd.read_excel(xls, 3)
        except Exception:
            # fallback (прямое чтение по умолчанию)
            df = pd.read_excel(path)

    if len(df) > DATA_MAX_ROWS:
        df = df.iloc[:DATA_MAX_ROWS].copy()

    # нормализация названий столбцов к строкам
    df.columns = [str(c).strip() for c in df.columns]
    return df

df  = _read_table(path)
print(df.columns)