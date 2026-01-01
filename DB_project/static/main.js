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

function getActiveSort() {
  const s = batteriesState.sortByView[batteriesState.view];
  return s || { col: "id", order: "asc" };
}

function setActiveSort(col, order) {
  if (!batteriesState.sortByView[batteriesState.view]) {
    batteriesState.sortByView[batteriesState.view] = { col, order };
  } else {
    batteriesState.sortByView[batteriesState.view].col = col;
    batteriesState.sortByView[batteriesState.view].order = order;
  }
}

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

function getSelectedColumns() {
    const cols = new Set(CORE_COLS);
    COL_GROUPS.forEach(g => {
        if (selectedGroups.has(g.key)) {
        g.cols.forEach(c => cols.add(c));
        }
    });
    return Array.from(cols);
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

// function updateSortIndicators(table) {
//     const ths = table.querySelectorAll("thead th");

//     ths.forEach(th => {
//         const col = th.dataset.col;
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
            batteriesState.cells_type = cellType; // твой параметр для /api/tables/batteries
            batteriesState.batch = row.batch;
            batteriesState.offset = 0;
            batteriesState.view = "batteries";
            batteriesState.backTarget = "batches";
            loadBatteries();
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
            onRowClick: (row) => {console.log("clicked battery row:", row.id);}
        });

        setStatus(`Показано: ${rows.length} (offset=${batteriesState.offset})`);
        attachSortHandlers(table, loadBatteries); // чтобы клики по th работали после перерендера
        updateSortIndicators(table);
    } catch (e) {
        setStatus(`Ошибка: ${e.message}`);
        renderTable(table, [], cols, { emptyText: "Ошибка загрузки" });
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
    } else {
        return;
    }
}


function initBatteriesUI() {
    const prevBtn = document.querySelector("#batteriesPrev");
    
    if (prevBtn) {
      prevBtn.onclick = () => {
        batteriesState.offset = Math.max(0, batteriesState.offset - batteriesState.limit);
        // loadBatteries();
        if (batteriesState.cells_type == null) loadCellTypes();
        else loadBatteries();
      };
    }
    
    const nextBtn = document.querySelector("#batteriesNext");
    if (nextBtn) {
        nextBtn.onclick = () => {
        batteriesState.offset += batteriesState.limit;
        // loadBatteries();
        if (batteriesState.cells_type == null) loadCellTypes();
        else loadBatteries();
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
            if (batteriesState.cells_type == null) loadCellTypes();
            else loadBatteries();
        }
        };
    }

    const backBtn = document.querySelector("#backToTypes");
    backBtn.onclick = () => {
        batteriesState.offset = 0;

        if (batteriesState.view === "batteries" && batteriesState.backTarget === "batches") {
            loadBatches(batteriesState.selectedCellType);
            return;
        }

        batteriesState.cells_type = null;
        batteriesState.batch = null;
        batteriesState.selectedCellType = null;
        batteriesState.view = "types";
        loadCellTypes();
    };

    const showAllBat = document.querySelector("#showAllBatteriesBtn");
    showAllBat.onclick = () => {
        batteriesState.offset = 0;
        batteriesState .cell_type = null;
        batteriesState.batch = null;
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
        if (batteriesState.cells_type == null) loadCellTypes();
        else loadBatteries();
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
        if (batteriesState.cells_type == null) loadCellTypes();
        else loadBatteries();
        };
    }

    batteriesState.columns = CORE_COLS.slice();
    // loadBatteries();
    batteriesState.cells_type = null;   // чтобы было понятно: мы в режиме типов
    loadCellTypes();
}

document.addEventListener("DOMContentLoaded", initBatteriesUI);
