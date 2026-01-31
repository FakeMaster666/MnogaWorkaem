const batteriesState = {
    limit: 20,
    offset: 0,
    sort: "id",
    order: "asc",
    columns: null,

    cells_type: null,          // фильтр для /api/tables/batteries

    selectedCellType: null,    // какой cell_type сейчас выбран (для batches/назад)
    batch: null,               // фильтр batch для /api/tables/batteries
    backTarget: "types" ,       // откуда пришли: "types" или "batches"
    battery_id : null,       // контекст: эксперименты батареи (если null -> эксперименты партии)
    experiment_type : null,  // выбранный тип эксперимента (для view="experiments")


    // какой экран сейчас рисуем
    view: "types", // "types" | "batches" | "batteries" | "exp_types" | "experiments"

    // сортировки по экранам
    sortByView: {
        types:       { col: "cell_type",       order: "asc"  }, // типы батарей
        batches:     { col: "batch",           order: "asc"  }, // партии
        batteries:   { col: "id",              order: "asc"  }, // батареи (все/по типу/по партии)
        exp_types:   { col: "count",           order: "desc" }, // сводка типов экспериментов
        experiments: { col: "e.id",            order: "asc"  }  // список экспериментов
    }
};

let currentUser = null; // текущий пользователь

const CORE_REQUIRED = ["id", "cell_name", "batch", "manufacturer"];
const NON_EDITABLE = new Set(["id", "created_by"]);

const EXP_CORE_REQUIRED = ["id", "experiment_type", "cell_name", "notes"];

const CORE_COLS = [
    "id", "cell_name", "batch", "manufacturer",
    "chemistry_family", "capacity_nom", "voltage_nom"
];

const COL_GROUPS = [
  {
    key: "spec_limits",
    title: "Номиналы и пределы",
    cols: [
      "label",
      "capacity_max","capacity_min",
      "voltage_max","voltage_min",
      "energy",
      "recommended_soc_min","recommended_soc_max"
    ]
  },
  {
    key: "chem_layers",
    title: "Химия и слои",
    cols: [
      "cathode","anode",
      "cathode_thikness","anode_thikness",
      "cathode_electrode_material","anode_electrode_material",
      "cathode_electrode_thikness","anode_electrode_thikness",
      "separator_material","separator_thikness"
    ]
  },
  {
    key: "geom_case",
    title: "Геометрия и корпус",
    cols: [
      "start_of_production",
      "dim_w","dim_l","dim_h",
      "volume",
      "wall_thikness",
      "case_material"
    ]
  },
  {
    key: "densities",
    title: "Плотности энергии и мощности",
    cols: [
      "wh_kg","wh_litre",
      "w_10s_kg","w_cont_kg",
      "w_10s_litre"
    ]
  },
  {
    key: "dcir_acir",
    title: "Импеданс и сопротивление",
    cols: [
      "dcir_1s_ohms_25C_50soc","dcir_5s_ohms_25C_50soc",
      "dcir_10s_ohms_25C_50soc","dcir_30s_ohms_25C_50soc",
      "dcir_continuous_ohms_25C_50soc",
      "dcir_10s_ohm_ah","dcir_30s_ohm_ah",
      "dcir_10s_siemens","dcir_30s_siemens",
      "dcir_10s_siemens_wh","dcir_30s_siemens_wh",
      "acir_1khz",
    ]
  },
  {
    key: "discharge",
    title: "Разряд",
    cols: [
      "dch_amps_max","dch_amps_cont",
      "dch_c_rate_max","dch_c_rate_cont",
      "dch_w_5s","dch_w_10s","dch_w_30s","dch_w_cont",
      "dch_max_temp","dch_min_temp",
    ]
  },
  {
    key: "charge",
    title: "Заряд",
    cols: [
      "ch_amps_max","ch_amps_cont",
      "ch_c_rate_max","ch_c_rate_cont",
      "ch_w_5s","ch_w_10s","ch_w_30s","ch_w_cont",
      "ch_max_temp","ch_min_temp",
      "fast_charge_time_10_to_80",
    ]
  },
  {
    key: "ageing",
    title: "Старение",
    cols: [
      "self_dch_max_month",
      "calendar_ageing_soc","calendar_ageing_temp","calendar_ageing_days","calendar_ageing_soh",
      "cycling_ageing_cycles_to_70soh","cycling_ageing_70_c_rate",
      "cycling_ageing_cycles_to_80soh","cycling_ageing_80_c_rate"
    ]
  },
  {
    key: "apps",
    title: "Применения",
    cols: ["applications"]
  }
];

const selectedGroups = new Set();

const DATE_COLS = new Set([
    "start_of_production",
]);

const INT_COLS = new Set([
    "cycling_ageing_cycles_to_70soh",
    "cycling_ageing_cycles_to_80soh",
]);

const NUM_COLS = new Set([
    // Номиналы/пределы
    "capacity_nom","capacity_max","capacity_min",
    "voltage_nom","voltage_max","voltage_min",
    "energy",

    // Химия/слои (толщины)
    "cathode_thikness","anode_thikness",
    "cathode_electrode_thikness","anode_electrode_thikness",
    "separator_thikness",

    // Геометрия/корпус
    "dim_w","dim_l","dim_h",
    "volume",
    "wall_thikness",

    // Плотности
    "wh_kg","wh_litre",
    "w_10s_kg","w_cont_kg",
    "w_10s_litre",

    // DCIR/ACIR
    "dcir_1s_ohms_25C_50soc","dcir_5s_ohms_25C_50soc",
    "dcir_10s_ohms_25C_50soc","dcir_30s_ohms_25C_50soc",
    "dcir_continuous_ohms_25C_50soc",
    "dcir_10s_ohm_ah","dcir_30s_ohm_ah",
    "dcir_10s_siemens","dcir_30s_siemens",
    "dcir_10s_siemens_wh","dcir_30s_siemens_wh",
    "acir_1khz",

    // Разряд
    "dch_amps_max","dch_amps_cont",
    "dch_w_5s","dch_w_10s","dch_w_30s","dch_w_cont",
    "dch_max_temp","dch_min_temp",

    // Заряд
    "ch_amps_max","ch_amps_cont",
    "ch_c_rate_max","ch_c_rate_cont",
    "ch_w_5s","ch_w_10s","ch_w_30s","ch_w_cont",
    "ch_max_temp","ch_min_temp",
    "fast_charge_time_10_to_80",

    // Старение
    "calendar_ageing_temp","calendar_ageing_days","calendar_ageing_soh",

    // Если реально используешь
    "cell_type",
]);

function normalizeInputValue(col, raw) {
    const s = (raw ?? "").trim();
    if (s === "") return null;

    if (DATE_COLS.has(col)) {
        // оставляем строку YYYY-MM-DD, дальше сервер/БД проверит
        return s;
    }

    if (INT_COLS.has(col)) {
        const n = Number.parseInt(s, 10);
        if (!Number.isFinite(n)) throw new Error(`Invalid int for ${col}`);
        return n;
    }

    if (NUM_COLS.has(col)) {
        const t = s.replace(",", ".");
        const n = Number.parseFloat(t);
        if (!Number.isFinite(n)) throw new Error(`Invalid number for ${col}`);
        return n;
    }

    return s; // text
}

function getActiveSort() {
  const s = batteriesState.sortByView[batteriesState.view];
  return s || { col: "id", order: "asc" };
}

function normalizeBaselineValue(col, v) {
    // baseline из row: числа могут быть number, даты строкой, null ок.
    if (v === undefined) return undefined; // поля может не быть в row вообще
    if (v === null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    if (NUM_COLS.has(col) || INT_COLS.has(col)) {
        // v может быть number, но если вдруг строка — парсим
        if (typeof v === "number") return v;
        const t = String(v).trim().replace(",", ".");
        const n = NUM_COLS.has(col) ? Number.parseFloat(t) : Number.parseInt(t, 10);
        return Number.isFinite(n) ? n : null;
    }
    return v;
}

function valuesEqual(a, b) {
    // сравнение с учётом null/undefined
    if (a === b) return true;
    // NaN
    if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return true;
    return false;
}

function openEditExperimentModal(row) {
    const modal = document.getElementById("editModal");
    const body = document.getElementById("editModalBody");
    const title = document.getElementById("editModalTitle");
    const errBox = document.getElementById("editModalError");

    errBox.textContent = "";

    const loadedCols = new Set(Object.keys(row));
    const baseline = {};
    for (const col of loadedCols) baseline[col] = normalizeBaselineValue(col, row[col]);

    modal.dataset.experimentId = String(row.id);
    modal._baseline = baseline;
    modal._inputs = {};

    title.textContent = `Experiment #${row.id}: ${row.experiment_type ?? ""}`;

    body.innerHTML = "";

    const block = document.createElement("div");
    block.className = "group open";
    block.innerHTML = `
        <div class="group__head"><b>Основное</b><span></span></div>
        <div class="group__body"></div>
    `;
    const b = block.querySelector(".group__body");

    const NON_EDITABLE = new Set(["id", "created_by"]);

    for (const col of EXP_CORE_REQUIRED) {
        if (!loadedCols.has(col)) continue;

        const fieldEl = renderField(col, row[col]); // notes автоматически textarea в renderField
        b.appendChild(fieldEl.el);

        if (!NON_EDITABLE.has(col)) modal._inputs[col] = fieldEl.input;
        else fieldEl.input.disabled = true;
    }

    body.appendChild(block);
    modal.classList.remove("hidden");
}

function openEditBatteryModal(row) {
    const modal = document.getElementById("editModal");
    const body = document.getElementById("editModalBody");
    const title = document.getElementById("editModalTitle");
    const errBox = document.getElementById("editModalError");

    // modal.dataset.editType = "battery";
    modal.dataset.batteryId = String(row.id);
    delete modal.dataset.experimentId;

    errBox.textContent = "";

    const loadedCols = new Set(Object.keys(row));
    const baseline = {};
    for (const col of loadedCols) baseline[col] = normalizeBaselineValue(col, row[col]);

    modal.dataset.batteryId = String(row.id);
    modal._baseline = baseline;
    modal._inputs = {};

    title.textContent = `Battery #${row.id}: ${row.cell_name ?? ""}`;
    body.innerHTML = "";

    // 1) Основное (core)
    const coreBlock = document.createElement("div");
    coreBlock.className = "group open";
    coreBlock.innerHTML = `
        <div class="group__head"><b>Основное</b><span></span></div>
        <div class="group__body"></div>
    `;
    const coreBody = coreBlock.querySelector(".group__body");

    for (const col of CORE_REQUIRED) {
        if (!loadedCols.has(col)) continue;

        const fieldEl = renderField(col, row[col]);
        coreBody.appendChild(fieldEl.el);

        if (!NON_EDITABLE.has(col)) {
        modal._inputs[col] = fieldEl.input;
        } else {
        fieldEl.input.disabled = true; // показываем, но не редактируем
        }
    }

    body.appendChild(coreBlock);

    // 2) Остальные группы — только загруженные поля
    for (const g of COL_GROUPS) {
        const cols = g.cols.filter(c => loadedCols.has(c));
        if (cols.length === 0) continue;

        const groupEl = document.createElement("div");
        groupEl.className = "group";

        const head = document.createElement("div");
        head.className = "group__head";
        head.innerHTML = `<b>${g.title}</b><span>${cols.length}</span>`;

        const gbody = document.createElement("div");
        gbody.className = "group__body";

        head.addEventListener("click", () => groupEl.classList.toggle("open"));

        for (const col of cols) {
        const fieldEl = renderField(col, row[col]);
        gbody.appendChild(fieldEl.el);

        if (!NON_EDITABLE.has(col)) {
            modal._inputs[col] = fieldEl.input;
        } else {
            fieldEl.input.disabled = true;
        }
        }

        groupEl.appendChild(head);
        groupEl.appendChild(gbody);
        body.appendChild(groupEl);
    }

    modal.classList.remove("hidden");
}

function renderField(col, value) {
    const el = document.createElement("div");
    el.className = "field";

    const label = document.createElement("div");
    label.textContent = col;

    let input;
    if (col === "applications" || col === "notes") {
        input = document.createElement("textarea");
        input.rows = 3;
    } else {
        input = document.createElement("input");
        input.type = DATE_COLS.has(col) ? "date" : "text";
    }

    // отображение значения
    // если number -> показываем как строку; null -> пусто
    input.value = (value === null || value === undefined) ? "" : String(value);

    el.appendChild(label);
    el.appendChild(input);

    return { el, input };
}

async function saveEditBatteryModal() {
    const modal = document.getElementById("editModal");
    const errBox = document.getElementById("editModalError");
    errBox.textContent = "";

    const batteryId = Number(modal.dataset.batteryId);
    const baseline = modal._baseline || {};
    const inputs = modal._inputs || {};

    const patch = {};
    try {
        for (const [col, input] of Object.entries(inputs)) {
        const newVal = normalizeInputValue(col, input.value);
        const baseVal = baseline[col];

        // Важно: если baseline[col] undefined (поле не было загружено) — не должно быть, но на всякий
        if (baseVal === undefined) continue;

        if (!valuesEqual(newVal, baseVal)) {
            patch[col] = newVal;
        }
        }
    } catch (e) {
        errBox.textContent = String(e.message || e);
        return;
    }

    if (Object.keys(patch).length === 0) {
        closeEditBatteryModal();
        return;
    }

    // клиентская защита обязательных
    for (const req of ["batch", "cell_name", "manufacturer"]) {
        if (req in patch && patch[req] === null) {
        errBox.textContent = `Поле ${req} обязательно и не может быть пустым`;
        return;
        }
    }

    try {
        const resp = await fetch(`/api/tables/batteries/${batteryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
        });

        const data = await resp.json().catch(() => null);

        if (!resp.ok) {
        errBox.textContent = (data && (data.detail || data.error)) ? (data.detail || data.error) : `HTTP ${resp.status}`;
        return;
        }

        // Успех: обновим строку в текущих данных (если у тебя есть state)
        // минимально — можно просто перезагрузить таблицу:
        await loadBatteries(); // заменишь на свою функцию
        closeEditBatteryModal();

    } catch (e) {
        errBox.textContent = String(e);
    }
}

async function saveEditExperimentModal() {
    const modal = document.getElementById("editModal");
    const errBox = document.getElementById("editModalError");
    errBox.textContent = "";

    const experimentId = Number(modal.dataset.experimentId);
    if (!Number.isFinite(experimentId)) { errBox.textContent = "Bad experiment id"; return; }

    const patch = buildPatchFromModal(modal, errBox);
    if (!patch) return;
    if (Object.keys(patch).length === 0) { closeEditBatteryModal(); return; }
    
    try {
        const resp = await fetch(`/api/tables/experiments/${experimentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(patch),
        });

        const data = await resp.json().catch(() => null);
        if (!resp.ok) {
            errBox.textContent = data?.detail ? String(data.detail) : `HTTP ${resp.status}`;
            return;
        }

        if (batteriesState.battery_id != null) {
        await loadExperimentsForBattery();
        } else {
        await loadExperimentsForBatch();
        }



        closeEditBatteryModal();
        
    } catch (e) {
        errBox.textContent = String(e);
    }
}

function closeEditBatteryModal() {
    const modal = document.getElementById("editModal");
    modal.classList.add("hidden");
    modal._baseline = null;
    modal._inputs = null;
}

function buildPatchFromModal(modal, errBox) {
    const baseline = modal._baseline || {};
    const inputs = modal._inputs || {};
    const patch = {};

    try {
        for (const [col, input] of Object.entries(inputs)) {
        if (NON_EDITABLE.has(col)) continue;

        const newVal = normalizeInputValue(col, input.value);
        const baseVal = baseline[col];

        if (baseVal === undefined) continue;
        if (!valuesEqual(newVal, baseVal)) patch[col] = newVal;
        }
    } catch (e) {
        errBox.textContent = String(e.message || e);
        return null;
    }

    return patch;
}


document.getElementById("editModalClose").addEventListener("click", closeEditBatteryModal);
document.getElementById("editModalBackdrop").addEventListener("click", closeEditBatteryModal);
document.getElementById("editModalSave").onclick = () => {
    if (batteriesState.view === "experiments") {
        saveEditExperimentModal();
    } else {
        saveEditBatteryModal();
    }
};



function setActiveSort(col, order) {
  if (!batteriesState.sortByView[batteriesState.view]) {
    batteriesState.sortByView[batteriesState.view] = { col, order };
  } else {
    batteriesState.sortByView[batteriesState.view].col = col;
    batteriesState.sortByView[batteriesState.view].order = order;
  }
}

// функции для авторизации

function qs(id) { return document.getElementById(id); }

function showModal() { qs("authModal").classList.remove("hidden"); }

function hideModal() {
    qs("authModal").classList.add("hidden");
    setAuthError("");
}

function setAuthError(msg) {
    const el = qs("authError");
    if (!msg) {
        el.classList.add("hidden");
        el.textContent = "";
    } else {
        el.classList.remove("hidden");
        el.textContent = msg;
    }
}

function renderAuthArea() {
    const authBtn = qs("authBtn");
    const userBox = qs("userBox");
    const userLogin = qs("userLogin");

    if (!currentUser) {
        authBtn.classList.remove("hidden");
        userBox.classList.add("hidden");
        userLogin.textContent = "";
        return;
    }

    authBtn.classList.add("hidden");
    userBox.classList.remove("hidden");
    userLogin.textContent = currentUser.login || "";
}

function setTab(mode) {
    const isIn = mode === "in";
    qs("tabSignIn").classList.toggle("active", isIn);
    qs("tabSignUp").classList.toggle("active", !isIn);
    qs("signInForm").classList.toggle("hidden", !isIn);
    qs("signUpForm").classList.toggle("hidden", isIn);
    setAuthError("");
}

async function signIn(login, password) {
    const r = await fetch("/api/sign_in", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        credentials: "include",
        body: JSON.stringify({login, password})
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || data.message || "Ошибка входа");
    return data;
}

async function signUp(login, password) {
    const r = await fetch("/api/sign_up", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        credentials: "include",
        body: JSON.stringify({login, password})
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || data.message || "Ошибка регистрации");
    return data;
}

async function loadMe() {
    try {
        const r = await fetch("/api/me", { credentials: "include" });
        if (!r.ok) {
        currentUser = null;
        return;
        }
        const data = await r.json();
        currentUser = data.user || null;
    } catch (e) {
        currentUser = null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // topbar auth buttons
    qs("authBtn").addEventListener("click", showModal);

    qs("logoutBtn").addEventListener("click", async () => {
        await fetch("/api/logout", { method: "POST", credentials: "include" });
        currentUser = null;
        renderAuthArea();
    });


    // modal controls
    qs("authClose").addEventListener("click", hideModal);
    qs("authBackdrop").addEventListener("click", hideModal);
    qs("tabSignIn").addEventListener("click", () => setTab("in"));
    qs("tabSignUp").addEventListener("click", () => setTab("up"));

    // submit: вход
    qs("signInForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        setAuthError("");

        try {
        const login = qs("signInLogin").value.trim();
        const password = qs("signInPassword").value.trim();
        const data = await signIn(login, password);

        currentUser = data.user || { login };
        hideModal();
        renderAuthArea();
        } catch (err) {
        setAuthError(err.message || String(err));
        }
    });

    // submit: регистрация
    qs("signUpForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        setAuthError("");

        try {
        const login = qs("signUpLogin").value.trim();
        const password = qs("signUpPassword").value.trim();
        await signUp(login, password);

        setTab("in");
        setAuthError("Аккаунт создан. Теперь войди.");
        } catch (err) {
        setAuthError(err.message || String(err));
        }
    });

    // initial UI
    loadMe().then(() => {
        renderAuthArea();
        setTab("in");
    });
});


async function fetchCellTypes({
    sort = null,
    order = "asc",
} = {}) {
    const params = new URLSearchParams();
    params.set("order", order);
    if (sort) params.set("sort", sort);
    
    const resp = await fetch(`/api/batteries/cells_type?${params.toString()}`);
    // const resp = await fetch(`/api/tables/batteries?${params.toString()}`);

    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return await resp.json(); // [{cell_type: "...", cnt: 12}, ...]
}

async function fetchBatches({
    cellType = null,
    sort = null,
    order = "asc",
} = {}) {
    const params = new URLSearchParams({cells_type: cellType });
    params.set("order", order);
    if (sort) params.set("sort", sort);

    //   const params = new URLSearchParams({filter_str: JSON.stringify({cell_type: cellType}) });
    const resp = await fetch(`/api/batteries/batches?${params.toString()}`);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return await resp.json(); // [{batch, cnt}, ...]
}

async function fetchBatteries({
    limit = 20,
    offset = 0,
    sort = null,
    order = "asc",
    columns = null,
    cells_type = null,
    batch = null
} = {}) {
    const filterObj = {};
    
    if (cells_type) {filterObj.cell_type = cells_type;}
    if (batch) {filterObj.batch = batch;}

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("order", order);
    
    
    
    if (sort) params.set("sort", sort);
    // if (batch) params.set("batch", batch);
    // if (cells_type) params.set("cells_type", cells_type);
    // const params = new URLSearchParams({filter_str: JSON.stringify({cell_type: cellType}) });
    // if (cells_type) params.set("filter_str", JSON.stringify({cell_type: cells_type}))
    // if (batch) params.set("filter_str", JSON.stringify({batch: batch}))

    if (Object.keys(filterObj).length > 0) params.set("filter_str", JSON.stringify(filterObj));
    
    
    if (columns && Array.isArray(columns)) {
        columns.forEach(c => params.append("columns", c));
    }
    
    const resp = await fetch(`/api/tables/batteries?${params.toString()}`);
    
    if (!resp.ok) {
        // попробуем вытащить detail, если бэк его отдаёт
        let detail = "";
        try {
            const data = await resp.json();
            if (data && data.detail) detail = `: ${data.detail}`;
        } catch (_) {}
        throw new Error(`API error ${resp.status}${detail}`);
    }

    return await resp.json();
}

// НАДО ДОБАВИТЬ НА СЕРВЕР ФУНКИЮ ДЛЯ ВОЗРВРАЩЕНИЯ ТИПОВ ЭКСПЕРИМЕНТОВ И ИСПРАВИТЬ ЭНДПОИНТЫ В ФРОНТЕ

async function fetchExperimentTypesForBatch({ cellType, batch, sort = null, order = "asc" } = {}) {
  const params = new URLSearchParams();
  params.set("order", order);
  if (sort) params.set("sort", sort);
  if (cellType != null) params.set("cell_type", cellType);
  if (batch != null) params.set("batch", batch);

  const resp = await fetch(`/api/experiments/types?${params.toString()}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return await resp.json();
}

async function fetchExperimentTypesForBattery({ batteryId, sort = null, order = "asc" } = {}) {
  const params = new URLSearchParams();
  params.set("order", order);
  if (sort) params.set("sort", sort);
  if (batteryId != null) params.set("battery_id", batteryId);

  const resp = await fetch(`/api/experiments/types?${params.toString()}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return await resp.json();
}

function getSelectedColumns() {
    const cols = new Set(CORE_COLS);
    COL_GROUPS.forEach(g => {
        if (selectedGroups.has(g.key)) {
        g.cols.forEach(c => cols.add(c));
        }
    });
    return Array.from(cols);
}

// function updateSortIndicators(table) {
//     const ths = table.querySelectorAll("thead th");

//     ths.forEach(th => {
        // const col = th.dataset.col;
//         const slot = th.querySelector(".th-sort");
//         th.classList.remove("is-sorted");

//         if (!slot) return;

//         // if (col === batteriesState.sort) { // sort change
//         if (col == getActiveSort().col){
    //         th.classList.add("is-sorted");
    //         // slot.textContent = (batteriesState.order === "asc") ? "▲" : "▼"; // sort change
//         slot.textContent = (getActiveSort().order === "asc") ? "▲" : "▼";
//         } else {
//         slot.textContent = ""; // место есть, значка нет
//         }
//     });
// }

function updateSortIndicators(table) {
    const s = getActiveSort(); // <- важно
    table.querySelectorAll("thead th").forEach(th => {
        const col = th.dataset.col;
        const slot = th.querySelector(".th-sort");
        th.classList.remove("is-sorted");
        if (!slot) return;

        if (col === s.col) {
        th.classList.add("is-sorted");
        slot.textContent = (s.order === "asc") ? "▲" : "▼";
        } else {
        slot.textContent = "";
        }
    });
}

function renderTable(table, rows, columns, opts = {}) {
    const {
        rowIdKey = "id",        // что класть в tr.dataset.id (если есть)
        onRowClick = null,      // (row) => {}
        onRowContextMenu = null,
        emptyText = "Нет данных"
    } = opts;

    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    thead.innerHTML = "";
    tbody.innerHTML = "";

    // --- header
    const trHead = document.createElement("tr");
    columns.forEach(col => {
        const th = document.createElement("th");
        th.dataset.col = col;

        // если ты уже используешь "слот" под стрелку — оставляем
        const inner = document.createElement("div");
        inner.className = "th-inner";

        const text = document.createElement("span");
        text.className = "th-text";
        text.textContent = col;

        const sortSlot = document.createElement("span");
        sortSlot.className = "th-sort";
        sortSlot.textContent = "";

        inner.appendChild(text);
        inner.appendChild(sortSlot);
        th.appendChild(inner);

        trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    // --- empty
    if (!rows || rows.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = Math.max(columns.length, 1);
        td.textContent = emptyText;
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    // --- body
    rows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        tr.dataset.rowIndex = String(idx);

        if (row && row[rowIdKey] !== undefined && row[rowIdKey] !== null) {
        tr.dataset.id = String(row[rowIdKey]);
        }

        columns.forEach(col => {
        const td = document.createElement("td");
        const val = row[col];
        td.textContent = (val === null || val === undefined) ? "" : String(val);
        tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    // --- клик по строке (делаем через делегирование, чтобы не навешивать на каждую tr)
    // Чтобы не вешать обработчик многократно, снимем старый (через присваивание).
    tbody.onclick = (e) => {
        if (!onRowClick) return;
        const tr = e.target.closest("tr");
        if (!tr || !tr.dataset.rowIndex) return;

        const i = Number(tr.dataset.rowIndex);
        const row = rows[i];
        if (row) onRowClick(row);
    };

    // --- ПКМ по строке (контекстное меню)
    tbody.oncontextmenu = (e) => {
    if (!onRowContextMenu) return;
    const tr = e.target.closest("tr");
    if (!tr || !tr.dataset.rowIndex) return;

    e.preventDefault();

    const i = Number(tr.dataset.rowIndex);
    const row = rows[i];
    if (row) onRowContextMenu(row);
    };
}

function setStatus(text) {
  const el = document.querySelector("#batteriesStatus");
  if (el) el.textContent = text;
}

async function loadCellTypes() {
    setModeUI("types");

    const table = document.querySelector("#batteriesTable");
    setStatus("Загрузка типов...");

    const s = getActiveSort(); // { col, order }
    const rows = await fetchCellTypes({
        sort: s.col,
        order: s.order
    }); // [{cell_type, cnt}, ...]

    renderTable(table, rows, ["cell_type", "count"], {
        rowIdKey: "cell_type",
        emptyText: "Типов нет",
        onRowClick: (row) => {
        // batteriesState.cells_type = row.cell_type;
        // batteriesState.offset = 0;
        // loadBatteries();
        // onRowClick: (row) => {
        showChoiceModal(row.cell_type);
        }   
    });

    attachSortHandlers(table, loadCellTypes);
    updateSortIndicators(table);

    setStatus(`Типов: ${rows.length} (кликни по строке)`);
}

async function loadBatches(cellType) {
    const table = document.querySelector("#batteriesTable");
    if (!table) return;

    batteriesState.view = "batches";
    batteriesState.selectedCellType = cellType;
    setModeUI("batches");

    setStatus(`Загрузка партий для типа: ${cellType}...`);
    try {
        const s = getActiveSort() 

        const rows = await fetchBatches({
            cellType: cellType,
            sort: s.col,
            order: s.order
        });

        renderTable(table, rows, ["batch", "count"], {
        rowIdKey: "batch",
        emptyText: "Нет партий",
        onRowClick: (row) => {
            // batteriesState.cells_type = cellType; // твой параметр для /api/tables/batteries
            // batteriesState.batch = row.batch;
            // batteriesState.offset = 0;
            // batteriesState.view = "batteries";
            // batteriesState.backTarget = "batches";
            // loadBatteries();
            showBatchChoiceModal(row.batch) // тут убрать
        }
        });

        // attachSortHandlers(table, loadBatches);
        attachSortHandlers(table, () => loadBatches(batteriesState.selectedCellType));
        updateSortIndicators(table)

        setStatus(`Партий: ${rows.length} (тип: ${cellType})`);
    } catch (e) {
        setStatus(`Ошибка: ${e.message}`);
        renderTable(table, [], ["batch", "count"], { emptyText: "Ошибка загрузки" });
    }
}

async function loadBatteries() {
    setModeUI("batteries");
    const table = document.querySelector("#batteriesTable");
    if (!table) return;

    // cellType = (cellType ?? batteriesState.selectedCellType);
    // if (cellType == null) return;

    // batteriesState.view = "batches";
    // batteriesState.selectedCellType = cellType;

    const cols = batteriesState.columns && batteriesState.columns.length
    ? batteriesState.columns
    : CORE_COLS;

    setStatus("Загрузка...");
    try {
        const s = getActiveSort(); // { col, order }
        const rows = await fetchBatteries({
            limit: batteriesState.limit,
            offset: batteriesState.offset,
            sort: s.col,
            order: s.order,
            columns: cols,
            cells_type: batteriesState.cells_type,
            batch: batteriesState.batch
        });


        // const rows = await fetchBatteries({ ...batteriesState, columns: cols }); // sort change

        renderTable(table, rows, cols, {
            rowIdKey: "id",
            emptyText: "Нет батареек",
            onRowClick: (row) => {
                // console.log("clicked battery row:", row.id);
                batteriesState.view = "exp_types";
                batteriesState.offset = 0;
                batteriesState.battery_id = row.id;
                batteriesState.experiment_type = null;
                loadExperimentTypesForBattery(row.id); // тут убрать
            },
            onRowContextMenu: openEditBatteryModal,
        });

        setStatus(`Показано: ${rows.length} (offset=${batteriesState.offset})`);
        attachSortHandlers(table, loadBatteries); // чтобы клики по th работали после перерендера
        updateSortIndicators(table);
    } catch (e) {
        setStatus(`Ошибка: ${e.message}`);
        renderTable(table, [], cols, { emptyText: "Ошибка загрузки" });
    }
}

async function loadExperimentTypesForBatch() {
    setModeUI("exp_types");
    const table = document.querySelector("#batteriesTable");
    if (!table) return;

    batteriesState.view = "exp_types";
    setStatus("Загрузка типов экспериментов партии...");

    try {
        const s = getActiveSort();
        const rows = await fetchExperimentTypesForBatch({
        cellType: batteriesState.cells_type,
        batch: batteriesState.batch,
        sort: s.col,
        order: s.order
        });

        renderTable(table, rows, ["experiment_type", "count"], {
        rowIdKey: "experiment_type",
        emptyText: "Нет экспериментов",
        onRowClick: (row) => {
            batteriesState.experiment_type = row.experiment_type;
            batteriesState.view = "experiments";
            batteriesState.offset = 0;
            loadExperimentsForBatch();
        }
        });

        attachSortHandlers(table, loadExperimentTypesForBatch);
        updateSortIndicators(table);
        setStatus(`Типов экспериментов: ${rows.length}`);
    } catch (e) {
        setStatus(`Ошибка: ${e.message}`);
        renderTable(table, [], ["experiment_type", "count"], { emptyText: "Ошибка загрузки" });
    }
}

async function loadExperimentTypesForBattery(batteryId) {
    setModeUI("exp_types");
    const table = document.querySelector("#batteriesTable");
    if (!table) return;

    batteriesState.view = "exp_types";
    setStatus("Загрузка типов экспериментов батареи...");

    try {
        const s = getActiveSort();
        const rows = await fetchExperimentTypesForBattery({
        batteryId,
        sort: s.col,
        order: s.order
        });

        renderTable(table, rows, ["experiment_type", "count"], {
            rowIdKey: "experiment_type",
            emptyText: "Нет экспериментов",
            onRowClick: (row) => {
                batteriesState.experiment_type = row.experiment_type;
                batteriesState.view = "experiments";
                batteriesState.offset = 0;
                loadExperimentsForBattery();
            }
        });

        attachSortHandlers(table, () => loadExperimentTypesForBattery(batteriesState.battery_id));
        updateSortIndicators(table);
        setStatus(`Типов экспериментов: ${rows.length}`);
    } catch (e) {
        setStatus(`Ошибка: ${e.message}`);
        renderTable(table, [], ["experiment_type", "count"], { emptyText: "Ошибка загрузки" });
    }
}

async function fetchExperimentsForBatch({
  cellType, batch, experimentType,
  limit = 20, offset = 0,
  sort = null, order = "asc"
} = {}) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("order", order);
    if (sort) params.set("sort", sort);

    params.set("filter_str", JSON.stringify({
        cell_type: cellType,
        batch: batch,
        experiment_type: experimentType
    }));

    const resp = await fetch(`/api/tables/experiments?${params.toString()}`);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return await resp.json(); // [{...}, ...]
}

async function fetchExperimentsForBattery({
    batteryId, experimentType,
    limit = 20, offset = 0,
    sort = null, order = "asc"
    } = {}) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("order", order);
    if (sort) params.set("sort", sort);

    params.set("filter_str", JSON.stringify({
        battery_id: batteryId,
        experiment_type: experimentType
    }));

    const resp = await fetch(`/api/tables/experiments?${params.toString()}`);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return await resp.json();
    }

// маленький хелпер, чтобы не угадывать колонки
function inferCols(rows) {
    if (!rows || rows.length === 0) return ["id"];
    const keys = Object.keys(rows[0]);
    const first = ["id", "experiment_type", "battery_id", "batch"];
    const cols = [];
    first.forEach(k => { if (keys.includes(k)) cols.push(k); });
    keys.forEach(k => { if (!cols.includes(k)) cols.push(k); });
    return cols;
}

async function loadExperimentsForBatch() {
    setModeUI("experiments");
    const table = document.querySelector("#batteriesTable");
    if (!table) return;

    batteriesState.view = "experiments";
    setStatus("Загрузка экспериментов партии...");

    try {
        const s = getActiveSort();
        const rows = await fetchExperimentsForBatch({
        cellType: batteriesState.cells_type,
        batch: batteriesState.batch,
        experimentType: batteriesState.experiment_type,
        limit: batteriesState.limit,
        offset: batteriesState.offset,
        sort: s.col,
        order: s.order
        });

        const cols = inferCols(rows);
        renderTable(
            table,
            rows,
            cols,
            {
                rowIdKey: "id",
                emptyText: "Нет экспериментов",
                onRowContextMenu: openEditExperimentModal
        });

        attachSortHandlers(table, loadExperimentsForBatch);
        updateSortIndicators(table);
        setStatus(`Показано: ${rows.length} (offset=${batteriesState.offset})`);
    } catch (e) {
        setStatus(`Ошибка: ${e.message}`);
        renderTable(table, [], ["id"], { emptyText: "Ошибка загрузки" });
    }
}

async function loadExperimentsForBattery() {
    setModeUI("experiments");
    const table = document.querySelector("#batteriesTable");
    if (!table) return;

    batteriesState.view = "experiments";
    setStatus("Загрузка экспериментов батареи...");

    try {
        const s = getActiveSort();
        const rows = await fetchExperimentsForBattery({
        batteryId: batteriesState.battery_id,
        experimentType: batteriesState.experiment_type,
        limit: batteriesState.limit,
        offset: batteriesState.offset,
        sort: s.col,
        order: s.order
        });

        const cols = inferCols(rows);
        renderTable(table, rows, cols, { rowIdKey: "id", emptyText: "Нет экспериментов", onRowContextMenu: openEditExperimentModal });

        attachSortHandlers(table, loadExperimentsForBattery);
        updateSortIndicators(table);
        setStatus(`Показано: ${rows.length} (offset=${batteriesState.offset})`);
    } catch (e) {
        setStatus(`Ошибка: ${e.message}`);
        renderTable(table, [], ["id"], { emptyText: "Ошибка загрузки" });
    }
}

function updateColsSummary() {
    const cols = getSelectedColumns();
    const el = document.querySelector("#colsSummary");
    if (el) el.textContent = `Выбрано столбцов: ${cols.length}`;
}

function buildGroupsUI() {
    const wrap = document.querySelector("#colsGroups");
    if (!wrap) return;

    wrap.innerHTML = "";
    COL_GROUPS.forEach(g => {
        const label = document.createElement("label");
        label.style.display = "block";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = selectedGroups.has(g.key);
        cb.onchange = () => {
        if (cb.checked) selectedGroups.add(g.key);
        else selectedGroups.delete(g.key);
        updateColsSummary();
        };

        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${g.title}`));
        wrap.appendChild(label);
    });

    updateColsSummary();
}


function openBatchChoiceModal() {
  document.getElementById('batchChoiceModal').style.display = 'block';
}

function closeBatchChoiceModal() {
  document.getElementById('batchChoiceModal').style.display = 'none';
}

document.getElementById('batchChoiceCancel')
  .addEventListener('click', closeBatchChoiceModal);


function showChoiceModal(cellType) {
    const modal = document.querySelector("#choiceModal");
    const text = document.querySelector("#choiceModalText");
    const btnBatches = document.querySelector("#choiceOpenBatches");
    const btnBatteries = document.querySelector("#choiceOpenBatteries");
    const btnCancel = document.querySelector("#choiceCancel");

    if (!modal || !text || !btnBatches || !btnBatteries || !btnCancel) return;

    modal.dataset.cellType = cellType;
    text.textContent = `Тип: ${cellType}. Что открыть?`;
    modal.style.display = "block";

    btnCancel.onclick = () => { modal.style.display = "none"; };

    btnBatches.onclick = () => {
        modal.style.display = "none";
        batteriesState.offset = 0;
        batteriesState.backTarget = "types";
        loadBatches(cellType);
    };

    btnBatteries.onclick = () => {
        modal.style.display = "none";
        batteriesState.cells_type = cellType;
        batteriesState.batch = null;
        batteriesState.offset = 0;
        batteriesState.view = "batteries";
        batteriesState.backTarget = "types";
        loadBatteries();
    };

    // клик по фону закрывает
    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    };
}

function showBatchChoiceModal(batch) {
    const modal = document.querySelector("#batchChoiceModal");
    const text = document.querySelector("#batchChoiceModalText");
    const btnBatteries = document.querySelector("#batchChoiceOpenBatteries");
    const btnExperiments = document.querySelector("#batchChoiceOpenExperiments");
    const btnCancel = document.querySelector("#batchChoiceCancel");

    if (!modal || !text || !btnBatteries || !btnExperiments || !btnCancel) return;

    modal.dataset.batch = batch;
    text.textContent = `Партия: ${batch}. Что открыть?`;
    modal.style.display = "block";

    btnCancel.onclick = () => { modal.style.display = "none"; };

    btnBatteries.onclick = () => {
        modal.style.display = "none";
        batteriesState.cells_type = batteriesState.selectedCellType;
        batteriesState.batch = batch;
        batteriesState.offset = 0;
        batteriesState.view = "batteries";
        batteriesState.backTarget = "batches";
        loadBatteries();
    };

    btnExperiments.onclick = () => {
        modal.style.display = "none";

        // контекст экспериментов партии (ВАЖНО: batch не уникален без cell_type)
        
        // batteriesState.view = "exp_types";
        // batteriesState.offset = 0;
        // batteriesState.exp_cell_type = batteriesState.selectedCellType;
        // batteriesState.exp_batch = batch;
        // batteriesState.exp_battery_id = null;
        // batteriesState.exp_experiment_type = null;
        // batteriesState.exp_back_target = "batches";
        // loadExperimentTypesForBatch();

        batteriesState.cells_type = batteriesState.selectedCellType; // Добавил тут
        batteriesState.view = "exp_types";
        batteriesState.offset = 0;
        batteriesState.battery_id = null;        // важно: это партия
        batteriesState.experiment_type = null;
        batteriesState.batch = batch;            // важно: выбрать партию
        loadExperimentTypesForBatch();

    };

    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    };
}

function attachSortHandlers(table, reloadFn) {
    const ths = table.querySelectorAll("thead th");
    ths.forEach(th => {
        th.onclick = () => {
        const col = th.dataset.col;
        if (!col) return;

        // if (batteriesState.sort === col) { // sort change
        if (getActiveSort().col === col) {
        
            // batteriesState.order = (batteriesState.order === "asc") ? "desc" : "asc"; // sort change
            const s = getActiveSort();
            setActiveSort(s.col, s.order === "asc" ? "desc" : "asc");


        } else {
            // batteriesState.sort = col; // sort change
            // batteriesState.order = "asc"; // sort change
            setActiveSort(col, "asc")
        }
        batteriesState.offset = 0;
        // loadBatteries();
        reloadFn()
        };
    });
}

function reloadCurrentView() {
    if (batteriesState.view === "types") return loadCellTypes();
    if (batteriesState.view === "batches") return loadBatches(batteriesState.selectedCellType);
    if (batteriesState.view === "batteries") return loadBatteries();

    if (batteriesState.view === "exp_types") {
        if (batteriesState.battery_id != null) return loadExperimentTypesForBattery(batteriesState.battery_id);
        return loadExperimentTypesForBatch();
    }

    if (batteriesState.view === "experiments") {
        if (batteriesState.battery_id != null) return loadExperimentsForBattery();
        return loadExperimentsForBatch();
    }
}


function setModeUI(mode) {
    const backBtn = document.querySelector("#backToTypes");
    const colsToggle = document.querySelector("#colsToggle");
    const colsPanel = document.querySelector("#colsPanel");
    const colsSummary = document.querySelector("#colsSummary");
    const showAllBat = document.querySelector("#showAllBatteriesBtn");
    

    if (mode === "types") {
        if (backBtn) backBtn.style.display = "none";
        if (colsToggle) colsToggle.style.display = "none";
        if (colsSummary) colsSummary.style.display = "none";
        if (colsPanel) colsPanel.style.display = "none";
        if (showAllBat) showAllBat.style.display = 'inline-block'
        return;
    } else if (mode === "batches") {
        if (backBtn) backBtn.style.display = "inline-block";
        if (colsToggle) colsToggle.style.display = "none";
        if (colsSummary) colsSummary.style.display = "none";
        if (colsPanel) colsPanel.style.display = "none";
        if (showAllBat) showAllBat.style.display = 'none'
        return;
    } else if (mode === "batteries") {
        if (backBtn) backBtn.style.display = "inline-block";
        if (colsToggle) colsToggle.style.display = "inline-block";
        if (colsSummary) colsSummary.style.display = "inline-block";
        if (showAllBat) showAllBat.style.display = 'none'
        return;
    } else if (mode === "exp_types" || mode === "experiments") {
        if (backBtn) backBtn.style.display = "inline-block";
        if (colsToggle) colsToggle.style.display = "none";
        if (colsSummary) colsSummary.style.display = "none";
        if (colsPanel) colsPanel.style.display = "none";
        if (showAllBat) showAllBat.style.display = 'none';
        return;
    } else {return;}
}

function initBatteriesUI() {
    const prevBtn = document.querySelector("#batteriesPrev");
    
    if (prevBtn) {
      prevBtn.onclick = () => {
        batteriesState.offset = Math.max(0, batteriesState.offset - batteriesState.limit);
        // loadBatteries();
        // if (batteriesState.cells_type == null) loadCellTypes();
        // else loadBatteries();
        reloadCurrentView();
      };
    }
    
    const nextBtn = document.querySelector("#batteriesNext");
    if (nextBtn) {
        nextBtn.onclick = () => {
        batteriesState.offset += batteriesState.limit;
        // loadBatteries();
        // if (batteriesState.cells_type == null) loadCellTypes();
        // else loadBatteries();
        reloadCurrentView();
        };
    }

    const limitSelect = document.querySelector("#batteriesLimit");
    if (limitSelect) {
        limitSelect.onchange = () => {
        const v = parseInt(limitSelect.value, 10);
        if (Number.isFinite(v) && v > 0) {
            batteriesState.limit = v;
            batteriesState.offset = 0;
            // loadBatteries();
            // if (batteriesState.cells_type == null) loadCellTypes();
            // else loadBatteries();
            reloadCurrentView();
        }
        };
    }

    // const backBtn = document.querySelector("#backToTypes");
    // backBtn.onclick = () => {
    //     batteriesState.offset = 0;

    //     if (batteriesState.view === "batteries" && batteriesState.backTarget === "batches") {
    //         loadBatches(batteriesState.selectedCellType);
    //         return;
    //     }

    //     if (batteriesState.view === "experiments") {
    //         batteriesState.view = "exp_types";
    //         batteriesState.offset = 0;
    //         if (batteriesState.battery_id != null) return loadExperimentTypesForBattery(batteriesState.battery_id);
    //         return loadExperimentTypesForBatch();
    //     }
        
    //     // назад из типов экспериментов -> куда открывали
    //     if (batteriesState.view === "exp_types") {
    //         batteriesState.offset = 0;
    //         if (batteriesState.back_target === "batches") return loadBatches(batteriesState.selectedCellType);
    //         // иначе обратно в батареи (с текущими filters)
    //         batteriesState.view = "batteries";
    //         return loadBatteries();
    //     }

    //     batteriesState.cells_type = null;
    //     batteriesState.batch = null;
    //     batteriesState.selectedCellType = null;
    //     batteriesState.view = "types";
    //     loadCellTypes();
    // };

    const backBtn = document.querySelector("#backToTypes");
    backBtn.onclick = () => {
        batteriesState.offset = 0;

        // 1) назад из списка экспериментов -> к типам экспериментов
        if (batteriesState.view === "experiments") {
            batteriesState.view = "exp_types";
            batteriesState.offset = 0;
            if (batteriesState.battery_id != null) return loadExperimentTypesForBattery(batteriesState.battery_id);
            return loadExperimentTypesForBatch();
        }

        // 2) назад из типов экспериментов
        if (batteriesState.view === "exp_types") {
            batteriesState.offset = 0;

            // если это батарея -> назад к списку батарей (с теми же фильтрами)
            if (batteriesState.battery_id != null) {
            batteriesState.view = "batteries";
            return loadBatteries();
            }

            // иначе это партия -> назад к batches выбранного типа
            batteriesState.view = "batches";
            return loadBatches(batteriesState.selectedCellType);
        }

        // 3) назад из батарей партии -> к batches
        if (batteriesState.view === "batteries" && batteriesState.backTarget === "batches") {
            batteriesState.view = "batches";
            return loadBatches(batteriesState.selectedCellType);
        }

        // 4) иначе назад к типам батарей
        batteriesState.cells_type = null;
        batteriesState.batch = null;
        batteriesState.selectedCellType = null;
        batteriesState.battery_id = null;
        batteriesState.experiment_type = null;
        batteriesState.view = "types";
        return loadCellTypes();
    };


    const showAllBat = document.querySelector("#showAllBatteriesBtn");
    showAllBat.onclick = () => {
        batteriesState.offset = 0;
        batteriesState.cells_type = null;
        batteriesState.batch = null;
        batteriesState.battery_id = null;   // сброс контекста экспериментов
        batteriesState.experiment_type = null;
        batteriesState.view = 'batteries';
        batteriesState.backTarget = 'types'
        loadBatteries();
    }


    buildGroupsUI();

    const toggleBtn = document.querySelector("#colsToggle");
    const panel = document.querySelector("#colsPanel");
    if (toggleBtn && panel) {
        toggleBtn.onclick = () => {
        panel.style.display = (panel.style.display === "none") ? "block" : "none";
        };
    }

    const applyBtn = document.querySelector("#colsApply");
    if (applyBtn) {
        applyBtn.onclick = () => {
        batteriesState.columns = getSelectedColumns();
        batteriesState.offset = 0;
        // loadBatteries();
        // if (batteriesState.cells_type == null) loadCellTypes();
        // else loadBatteries();
        reloadCurrentView();
        };
    }

    const resetBtn = document.querySelector("#colsReset");
    if (resetBtn) {
        resetBtn.onclick = () => {
        selectedGroups.clear();
        buildGroupsUI();
        batteriesState.columns = CORE_COLS.slice();
        batteriesState.offset = 0;
        // loadBatteries();
        // if (batteriesState.cells_type == null) loadCellTypes();
        // else loadBatteries();
        reloadCurrentView();
        };
    }

    batteriesState.columns = CORE_COLS.slice();
    // loadBatteries();
    batteriesState.cells_type = null;   // чтобы было понятно: мы в режиме типов
    loadCellTypes();
}

document.addEventListener("DOMContentLoaded", initBatteriesUI);
