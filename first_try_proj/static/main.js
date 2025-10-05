const batTableBody = document.getElementById("batTableBody");
const expTableBody = document.getElementById("expTableBody");
const batteriesView = document.getElementById("batteriesView");
const experimentsView = document.getElementById("experimentsView");
const backBtn = document.getElementById("backBtn");
const plotConfig = document.getElementById("plotConfig");
const xSelect = document.getElementById("xSelect");
const yCheckboxes = document.getElementById("yCheckboxes");
const plotBtn = document.getElementById("plotBtn");
const plotArea = document.getElementById("plotArea");


let selectedBattery = null;
let selectedExperiment = null;

// --- helpers
function escapeHtml(text) {
  return text === null || text === undefined ? "" :
    text.toString().replace(/[&<>"']/g, m => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;"
    }[m]));
}





const uploadForm = document.getElementById('uploadForm');
const fileInput = uploadForm.querySelector('input[type="file"]');

// модали
const batteryChoiceModal = document.getElementById('batteryChoiceModal');
const batChoiceYes = document.getElementById('batChoiceYes');
const batChoiceNo = document.getElementById('batChoiceNo');
const batChoiceCancel = document.getElementById('batChoiceCancel');

const batteryIdModal = document.getElementById('batteryIdModal');
const batteryIdInput = document.getElementById('batteryIdInput');
const batteryIdCancel = document.getElementById('batteryIdCancel');
const batteryIdOk = document.getElementById('batteryIdOk');

const batteryFormModal = document.getElementById('batteryFormModal');
const bf_name = document.getElementById('bf_name');
const bf_chem = document.getElementById('bf_chem');
const bf_cap = document.getElementById('bf_cap');

const bf_volt1 = document.getElementById('bf_volt_1');
const bf_volt2 = document.getElementById('bf_volt_2');
// <!--const bf_volt = document.getElementById('bf_volt');-->

const batteryFormCancel = document.getElementById('batteryFormCancel');
const batteryFormCreate = document.getElementById('batteryFormCreate');

const experimentFormModal = document.getElementById('experimentFormModal');
const ef_date = document.getElementById('ef_date');
const ef_dur = document.getElementById('ef_dur');
const ef_notes = document.getElementById('ef_notes');
const experimentFormCancel = document.getElementById('experimentFormCancel');
const experimentFormOk = document.getElementById('experimentFormOk');

// утилиты для модалей
function openModal(el){ el.classList.add('show'); }
function closeModal(el){ el.classList.remove('show'); }

// состояние шага загрузки
let pendingFile = null;
let chosenBatteryId = null;

// пагинация
let page = 0;
const limit = 20;


// сортировка
// let currentSortColumnBat = null;
// let currentSortOrderBat = 'asc';

// let currentSortColumnExp = null;
// let currentSortOrderExp = 'asc';

const batterySortState = { column: null, order: 'asc' };
const experimentSortState = { column: null, order: 'asc' };
let currentBatteryId = null;

// document.querySelectorAll('#batteryTable th[data-sort]').forEach(th => {
//   th.addEventListener('click', () => {
//     const clickedColumn = th.getAttribute('data-sort');
    
//     if (currentSortColumn === clickedColumn) {
//       // Переключаем порядок сортировки
//       currentSortOrderBat = currentSortOrderBat === 'asc' ? 'desc' : 'asc';
//     } else {
//       // Сортируем по новому столбцу
//       currentSortColumnBat = clickedColumn;
//       currentSortOrderBat = 'asc';
//     }

//     updateSortIcons()
//     loadBatteries(); // повторно загружаем с новыми параметрами
//   });
// });

// function updateSortIcons() {
//   document.querySelectorAll('th[data-sort]').forEach(th => {
//     const col = th.getAttribute('data-sort');
//     if (col === currentSortColumnBat) {
//       th.innerText = col.charAt(0).toUpperCase() + col.slice(1) + (currentSortOrderBat === 'asc' ? ' ▲' : ' ▼');
//     } else {
//       th.innerText = col.charAt(0).toUpperCase() + col.slice(1);
//     }
//   });
// }


function updateSortIcons(tableSelector, currentSortColumn, currentSortOrder) {
  document.querySelectorAll(`${tableSelector} th[data-sort]`).forEach(th => {
    const col = th.getAttribute('data-sort');
    if (col === currentSortColumn) {
      th.innerText = col.charAt(0).toUpperCase() + col.slice(1) + (currentSortOrder === 'asc' ? ' ▲' : ' ▼');
    } else {
      th.innerText = col.charAt(0).toUpperCase() + col.slice(1);
    }
  });
}

function setupTableSorting(tableSelector, loadFunction, sortState) {
  document.querySelectorAll(`${tableSelector} th[data-sort]`).forEach(th => {
    th.addEventListener('click', () => {
      const clickedColumn = th.getAttribute('data-sort');

      if (sortState.column === clickedColumn) {
        sortState.order = sortState.order === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.column = clickedColumn;
        sortState.order = 'asc';
      }
      updateSortIcons(tableSelector, sortState.column, sortState.order);
      loadFunction();
    });
  });
}

setupTableSorting('#batteryTable', loadBatteries, batterySortState);
setupTableSorting('#experimentTable', loadExperiments, experimentSortState);





nextPage.onclick = () => {
  page++;
  updatePageInfo()
  loadBatteries();
};

prevPage.onclick = () => {
  if (page > 0) {
    page--;
    updatePageInfo()
    loadBatteries();
  }
};

function updatePageInfo() {
  document.getElementById('pageInfo').textContent = `Страница ${page+1}`;
}

// показать первый вопрос после выбора файла
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    pendingFile = fileInput.files[0];
    openModal(batteryChoiceModal);
  }
});

// перехватываем submit и запускаем нашу механику
uploadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!fileInput.files.length) {
    alert('Сначала выберите файл');
    return;
  }
  // Если почему-то модаль не открылась по change, откроем сейчас:
  pendingFile = fileInput.files[0];
  openModal(batteryChoiceModal);
});

// обработчики модали выбора
batChoiceCancel.addEventListener('click', () => {
  closeModal(batteryChoiceModal);
  // сбросим состояние, если пользователь передумал
  pendingFile = null;
  fileInput.value = '';
});

batChoiceYes.addEventListener('click', () => {
  closeModal(batteryChoiceModal);
  batteryIdInput.value = '';
  openModal(batteryIdModal);
});

batChoiceNo.addEventListener('click', () => {
  closeModal(batteryChoiceModal);
  // подготовим форму новой батареи
  bf_name.value = '';
  bf_chem.value = '';
  bf_cap.value = '';
  bf_volt1.value = '';
  bf_volt2.value = '';
  openModal(batteryFormModal);
});

// ввод существующего ID
batteryIdCancel.addEventListener('click', () => {
  closeModal(batteryIdModal);
  openModal(batteryChoiceModal);
});

batteryIdOk.addEventListener('click', async () => {
  const id = parseInt(batteryIdInput.value, 10);
  if (!id || id <= 0) {
    alert('Укажите корректный положительный ID');
    return;
  }
  // можно проверить существование по API
  try {
    const r = await fetch(`/api/batteries?id=${id}`);
    if (!r.ok) throw new Error('API error');
    const arr = await r.json();
    const exists = Array.isArray(arr) ? arr.some(b => +b.id === id) : (arr && +arr.id === id);
    if (!exists) {
      alert(`Батарея с ID ${id} не найдена`);
      return;
    }
  } catch (e) {
    // если у тебя нет такого фильтра по id — пропусти проверку или замени на /api/battery/${id}
    // alert('Не удалось проверить ID по API. Проверь бекенд.');
  }
  chosenBatteryId = id;
  closeModal(batteryIdModal);
  // дальше всегда форма эксперимента
  ef_date.value = '';
  ef_dur.value = '';
  ef_notes.value = '';
  openModal(experimentFormModal);
});

// создание новой батареи
batteryFormCancel.addEventListener('click', () => {
  closeModal(batteryFormModal);
  openModal(batteryChoiceModal);
});

batteryFormCreate.addEventListener('click', async () => {
  const v1 = bf_volt1.value ? Number(bf_volt1.value) : null;
  const v2 = bf_volt2.value ? Number(bf_volt2.value) : null;

  let voltage = [null, null];
  if (v1 !== null && v2 !== null) {
    if (v1 > v2) {
      alert('Минимум должен быть ≤ максимум');
      return;
    }
    voltage = [v1, v2];
  } else if (v1 !== null || v2 !== null) {
    // если заполнено только одно поле
    alert('Укажи оба напряжения или оставь оба пустыми');
    return;
  }

  const payload = {
    name: bf_name.value?.trim(),
    chemistry: bf_chem.value?.trim(),
    capacity: bf_cap.value ? Number(bf_cap.value) : null,
    voltage: voltage, // здесь либо null, либо [min, max]
    notes: null
  };


// <!--  const payload = {-->
// <!--    name: bf_name.value?.trim() || null,-->
// <!--    chemistry: bf_chem.value?.trim() || null,-->
// <!--    capacity: bf_cap.value ? Number(bf_cap.value) : null,-->
// <!--    voltage: bf_volt.value ? Number(bf_volt.value) : null-->
// <!--  };-->
  // базовая валидация — имя как минимум
  if (!payload.name) {
    alert('Поле Name обязательно');
    return;
  }
  try {
    const resp = await fetch('/api/batteries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Ошибка создания батареи: ${resp.status} ${t}`);
    }
    const created = await resp.json(); // ожидаем { id: number, ... }
    if (!created?.id) {
      throw new Error('Сервер не вернул id новой батареи');
    }
    chosenBatteryId = created.id;
    closeModal(batteryFormModal);

    // сразу спросим данные эксперимента
    ef_date.value = '';
    ef_dur.value = '';
    ef_notes.value = '';
    openModal(experimentFormModal);

  } catch (err) {
    alert(err.message);
  }
});

// форма эксперимента -> финальная загрузка
experimentFormCancel.addEventListener('click', () => {
  closeModal(experimentFormModal);
  // позволим заново начать сценарий
  chosenBatteryId = null;
  pendingFile = null;
  fileInput.value = '';
});

experimentFormOk.addEventListener('click', async () => {
  if (!pendingFile) {
    alert('Файл отсутствует, начните заново');
    closeModal(experimentFormModal);
    return;
  }
  if (!chosenBatteryId) {
    alert('Не выбран battery_id');
    return;
  }
  // собираем форму для /upload
  const fd = new FormData();
  fd.append('file', pendingFile);
  fd.append('battery_id', String(chosenBatteryId));

  const dateStr = ef_date.value?.trim();
  const durStr = ef_dur.value?.trim();
  const notes = ef_notes.value?.trim();

  if (dateStr) fd.append('date_str', dateStr); // формат YYYY-MM-DD
  if (durStr)  fd.append('duration', durStr);
  if (notes)   fd.append('notes', notes);

  try {
    const resp = await fetch('/upload', { method: 'POST', body: fd });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Ошибка загрузки: ${resp.status} ${t}`);
    }
    const result = await resp.json();
    closeModal(experimentFormModal);
    // сообщаем пользователю присвоенный/использованный индекс батареи и id эксперимента
    alert(`Файл ${result.filename} загружен.\nBattery ID: ${result.battery_id}\nExperiment ID: ${result.experiment_id}`);
    // обновим списки
    try { await loadBatteries(); } catch(_) {}
    if (selectedBattery) { try { await loadExperiments(selectedBattery); } catch(_) {} }
  } catch (err) {
    alert(err.message);
  } finally {
    // очистка состояния
    pendingFile = null;
    fileInput.value = '';
    // чтобы пользователь явно видел присвоенный ID батареи, можно вывести в message:
    // document.getElementById('message').textContent = `Последняя батарея: ${chosenBatteryId ?? '-'}`;
    chosenBatteryId = null;
  }
});





// // --- load batteries
// async function loadBatteries() {
//   const offset = page * limit;
//   let url = `/api/batteries?limit=${limit}&offset=${offset}`;

//   // добавим параметры сортировки, если выбрана колонка
//   if (batterySortState.column) {
//     url += `&sort=${encodeURIComponent(batterySortState.column)}&order=${encodeURIComponent(batterySortState.order)}`;
//   }


//   const resp = await fetch(url);
//   if (!resp.ok) { batTableBody.innerHTML = "<tr><td colspan=5>Ошибка API</td></tr>"; return; }
  
//   const arr = await resp.json();
//   batTableBody.innerHTML = "";
//   arr.forEach(b => {
//     const tr = document.createElement("tr");
//     tr.dataset.id = b.id;
//     tr.innerHTML = `
//       <td>${b.id}</td>
//       <td>${escapeHtml(b.name||"")}</td>
//       <td>${escapeHtml(b.chemistry||"")}</td>
//       <td>${b.capacity ?? ""}</td>
//       <td>${b.voltage ?? ""}</td>`;
//     batTableBody.appendChild(tr);
//   });
// }

// Модифицировать функцию loadBatteries для поддержки фильтрации
async function loadBatteries() {
  const offset = page * limit;
  let url = `/api/batteries?limit=${limit}&offset=${offset}`;

  // Добавить параметры сортировки
  if (batterySortState.column) {
    url += `&sort=${encodeURIComponent(batterySortState.column)}&order=${encodeURIComponent(batterySortState.order)}`;
  }

  // Добавить параметры фильтрации
  if (Object.keys(currentFilters).length > 0) {
    // Использовать endpoint фильтрации
    url = `/api/batteries/filter?limit=${limit}&offset=${offset}`;
    
    Object.keys(currentFilters).forEach(key => {
      url += `&${key}=${encodeURIComponent(currentFilters[key])}`;
    });
  }

  const resp = await fetch(url);
  if (!resp.ok) { 
    batTableBody.innerHTML = "<tr><td colspan=5>Ошибка API</td></tr>"; 
    return; 
  }
  
  const arr = await resp.json();
  batTableBody.innerHTML = "";
  arr.forEach(b => {
    const tr = document.createElement("tr");
    tr.dataset.id = b.id;
    tr.innerHTML = `
      <td>${b.id}</td>
      <td>${escapeHtml(b.name||"")}</td>
      <td>${escapeHtml(b.chemistry||"")}</td>
      <td>${b.capacity ?? ""}</td>
      <td>${b.voltage ? b.voltage.join(' - ') : ""}</td>`;
    batTableBody.appendChild(tr);
  });
}



// --- load experiments for battery
async function loadExperiments(batteryId=currentBatteryId) {
  console.log("loadExperiments получил ID:", batteryId);
  if (batteryId === undefined || batteryId === null) {
    console.warn("batteryId is missing");
    expTableBody.innerHTML = "<tr><td colspan=5>Battery ID отсутствует</td></tr>";
    return;
    }

    const params = new URLSearchParams();
    params.set("battery_id", batteryId);

  if (experimentSortState.column) {
    params.set("sort", experimentSortState.column);
    params.set("order", experimentSortState.order);
  }

  const url = `/api/experiments?${params.toString()}`;
  const resp = await fetch(url);
//   const resp = await fetch(`/api/experiments?battery_id=${batteryId}`);

  if (!resp.ok) { expTableBody.innerHTML = "<tr><td colspan=5>Ошибка API</td></tr>"; return; }
  const arr = await resp.json();
  expTableBody.innerHTML = "";
  arr.forEach(e => {
    const tr = document.createElement("tr");
    tr.dataset.id = e.id;
    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${escapeHtml(e.format||"")}</td>
      <td>${escapeHtml(e.date||"")}</td>
      <td>${e.duration ?? ""}</td>
      <td>${escapeHtml(e.notes||"")}</td>`;
    expTableBody.appendChild(tr);
  });
}

// --- setup plot config
async function setupPlotConfig(expId) {
  const resp = await fetch(`/api/experiment/${expId}/columns`);
  if (!resp.ok) { alert("Ошибка получения колонок"); return; }
  const data = await resp.json();
  const cols = data.columns;
  xSelect.innerHTML = "";
  cols.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    xSelect.appendChild(opt);
  });
  yCheckboxes.innerHTML = "";
  cols.forEach(c => {
    const id = "y_" + c;
    const div = document.createElement("div");
    div.innerHTML = `<label><input type="checkbox" value="${c}" id="${id}"> ${c}</label>`;
    yCheckboxes.appendChild(div);
  });
  plotConfig.classList.remove("hidden");
}

// --- draw plot
async function drawPlot(expId, xCol, yCols) {
  const resp = await fetch(`/api/experiment/${expId}/data?x=${encodeURIComponent(xCol)}&ys=${encodeURIComponent(yCols.join(","))}`);
  if (!resp.ok) { alert("Ошибка загрузки данных"); return; }
  const data = await resp.json();
  const traces = [];
  for (const [col, arr] of Object.entries(data.ys)) {
    traces.push({
      x: data.x,
      y: arr,
      mode: "lines",
      name: col
    });
  }
  Plotly.newPlot(plotArea, traces, {title: `Эксперимент ${expId}`, xaxis:{title:xCol}});
}

// --- event delegation
batTableBody.addEventListener("click", ev => {
  const tr = ev.target.closest("tr");
  if (!tr) return;
  const id = tr.dataset.id;
  selectedBattery = id;
  batteriesView.classList.add("hidden");
  experimentsView.classList.remove("hidden");
  currentBatteryId = id;
  loadExperiments(id);
});

expTableBody.addEventListener("click", ev => {
  const tr = ev.target.closest("tr");
  if (!tr) return;
  const id = tr.dataset.id;
  selectedExperiment = id;
  setupPlotConfig(id);
});

backBtn.addEventListener("click", () => {
  experimentsView.classList.add("hidden");
  batteriesView.classList.remove("hidden");
  plotConfig.classList.add("hidden");
  plotArea.innerHTML = "";
});

plotBtn.addEventListener("click", () => {
  if (!selectedExperiment) return;
  const xCol = xSelect.value;
  const yCols = [...yCheckboxes.querySelectorAll("input:checked")].map(cb => cb.value);
  if (!xCol || yCols.length === 0) { alert("Выбери X и хотя бы один Y"); return; }
  drawPlot(selectedExperiment, xCol, yCols);
});



// УДАЛЕНИЕ БАТАРЕЙКИ 
//////////////////////////////////////////////////

// === УНИВЕРСАЛЬНЫЙ КОД ДЛЯ УДАЛЕНИЯ ===

// Конфигурация для разных типов удаления
const deleteConfig = {
  battery: {
    confirmModal: 'deleteConfirmModal',
    confirmText: 'deleteConfirmText',
    resultModal: 'deleteResultModal', 
    resultTitle: 'deleteResultTitle',
    resultText: 'deleteResultText',
    endpoint: '/api/batteries',
    successCallback: loadBatteries,
    getConfirmText: (id, data) => `Вы уверены, что хотите удалить батарейку "${data.name}" (ID: ${id})? Это также удалит все связанные эксперименты.`
  },
  experiment: {
    confirmModal: 'deleteExpConfirmModal',
    confirmText: 'deleteExpConfirmText', 
    resultModal: 'deleteExpResultModal',
    resultTitle: 'deleteExpResultTitle',
    resultText: 'deleteExpResultText',
    endpoint: '/api/experiments',
    successCallback: () => loadExperiments(currentBatteryId),
    getConfirmText: (id, data) => `Вы уверены, что хотите удалить эксперимент ID: ${id} (Формат: ${data.format}, Дата: ${data.date})?`
  }
};

// Универсальная функция для показа подтверждения удаления
function showDeleteConfirm(type, id, data) {
  const config = deleteConfig[type];
  document.getElementById(config.confirmText).textContent = config.getConfirmText(id, data);
  document.getElementById(config.confirmModal).dataset.deleteType = type;
  document.getElementById(config.confirmModal).dataset.deleteId = id;
  document.getElementById(config.confirmModal).dataset.deleteData = JSON.stringify(data);
  openModal(document.getElementById(config.confirmModal));
}

// Универсальная функция выполнения удаления
async function executeDelete() {
  const confirmModal = document.activeElement.closest('.modal-backdrop');
  const type = confirmModal.dataset.deleteType;
  const id = confirmModal.dataset.deleteId;
  const config = deleteConfig[type];
  
  closeModal(confirmModal);
  
  try {
    const response = await fetch(`${config.endpoint}/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error(`Ошибка ${response.status}`);
    
    const result = await response.json();
    showDeleteResult('success', result.message, config);
    
  } catch (error) {
    showDeleteResult('error', `Не удалось удалить: ${error.message}`, config);
  }
}

// Универсальная функция показа результата
async function showDeleteResult(status, message, config) {
  document.getElementById(config.resultTitle).textContent = status === 'success' ? 'Успех' : 'Ошибка';
  document.getElementById(config.resultText).textContent = message;
  document.getElementById(config.resultModal).dataset.deleteType = config.endpoint;
  document.getElementById(config.resultModal).dataset.successCallback = status === 'success';
  openModal(document.getElementById(config.resultModal));
}

// Обработчик закрытия модали результата
async function handleDeleteResultClose() {
  const resultModal = document.activeElement.closest('.modal-backdrop');
  const shouldRefresh = resultModal.dataset.successCallback === 'true';
  const config = Object.values(deleteConfig).find(c => c.endpoint === resultModal.dataset.deleteType);
  
  closeModal(resultModal);
  if (shouldRefresh && config && config.successCallback) {
    config.successCallback();
  }
}

// Настройка обработчиков для всех модалей удаления
async function setupDeleteHandlers() {
  // Подтверждение удаления
  document.querySelectorAll('#deleteConfirmOk, #deleteExpConfirmOk').forEach(btn => {
    btn.addEventListener('click', executeDelete);
  });
  
  // Отмена удаления
  document.querySelectorAll('#deleteConfirmCancel, #deleteExpConfirmCancel').forEach(btn => {
    btn.addEventListener('click', function() {
      closeModal(this.closest('.modal-backdrop'));
    });
  });
  
  // Закрытие результата
  document.querySelectorAll('#deleteResultOk, #deleteExpResultOk').forEach(btn => {
    btn.addEventListener('click', handleDeleteResultClose);
  });
}

// === ОБРАБОТЧИКИ ТАБЛИЦ ===

batTableBody.addEventListener("contextmenu", ev => {
  const tr = ev.target.closest("tr");
  if (!tr) return;
  
  ev.preventDefault();
  
  const id = tr.dataset.id;
  const batteryData = { name: tr.cells[1].textContent };
  showDeleteConfirm('battery', id, batteryData);
});

// Обработчик для таблицы экспериментов - ПРАВЫЙ клик
expTableBody.addEventListener("contextmenu", ev => {
  const tr = ev.target.closest("tr");
  if (!tr) return;
  
  ev.preventDefault();
  
  const id = tr.dataset.id;
  const experimentData = {
    format: tr.cells[1].textContent,
    date: tr.cells[2].textContent
  };
  showDeleteConfirm('experiment', id, experimentData);
});

// Инициализация при загрузке
setupDeleteHandlers();


//////////////////////////////////////////////////
// === ФИЛЬТРАЦИЯ БАТАРЕЙ ===

// Добавить в начало с другими переменными
const filterBtn = document.createElement('button');
filterBtn.className = 'filter-btn';
filterBtn.textContent = 'Фильтр';
filterBtn.style.marginRight = '10px';

// Вставить кнопку перед таблицей
document.querySelector('h2').insertAdjacentElement('afterend', filterBtn);

// Элементы модали фильтрации
const filterModal = document.getElementById('filterModal');
const filterName = document.getElementById('filterName');
const filterChemistry = document.getElementById('filterChemistry');
const filterCapacityMin = document.getElementById('filterCapacityMin');
const filterCapacityMax = document.getElementById('filterCapacityMax');
const filterVoltageMin = document.getElementById('filterVoltageMin');
const filterVoltageMax = document.getElementById('filterVoltageMax');
const filterReset = document.getElementById('filterReset');
const filterCancel = document.getElementById('filterCancel');
const filterApply = document.getElementById('filterApply');

// Текущие параметры фильтрации
let currentFilters = {};

// Обработчики фильтрации
filterBtn.addEventListener('click', async () => {
  await loadUniqueChemistries();
  openModal(filterModal);
});

filterCancel.addEventListener('click', () => {
  closeModal(filterModal);
});

filterReset.addEventListener('click', () => {
  // Сбросить все поля
  filterName.value = '';
  filterChemistry.value = '';
  filterCapacityMin.value = '';
  filterCapacityMax.value = '';
  filterVoltageMin.value = '';
  filterVoltageMax.value = '';
});

filterApply.addEventListener('click', async () => {
  // Собрать параметры фильтрации
  currentFilters = {};
  
  if (filterName.value.trim()) {
    currentFilters.name = filterName.value.trim();
  }
  if (filterChemistry.value) {
    currentFilters.chemistry = filterChemistry.value;
  }
  if (filterCapacityMin.value) {
    currentFilters.capacity_min = parseFloat(filterCapacityMin.value);
  }
  if (filterCapacityMax.value) {
    currentFilters.capacity_max = parseFloat(filterCapacityMax.value);
  }
  if (filterVoltageMin.value) {
    currentFilters.voltage_min = parseFloat(filterVoltageMin.value);
  }
  if (filterVoltageMax.value) {
    currentFilters.voltage_max = parseFloat(filterVoltageMax.value);
  }
  
  closeModal(filterModal);
  page = 0; // Сбросить пагинацию
  await loadBatteries();
  
  // Обновить вид кнопки фильтра
  updateFilterButton();
});

// Загрузка уникальных химий
async function loadUniqueChemistries() {
  try {
    const response = await fetch('/api/batteries/unique-chemistries');
    if (!response.ok) return;
    
    const chemistries = await response.json();
    filterChemistry.innerHTML = '<option value="">Все химии</option>';
    
    chemistries.forEach(chem => {
      const option = document.createElement('option');
      option.value = chem;
      option.textContent = chem;
      filterChemistry.appendChild(option);
    });
  } catch (error) {
    console.error('Ошибка загрузки химий:', error);
  }
}

// Обновить вид кнопки фильтра
function updateFilterButton() {
  const hasActiveFilters = Object.keys(currentFilters).length > 0;
  filterBtn.classList.toggle('active', hasActiveFilters);
  filterBtn.textContent = hasActiveFilters ? 'Фильтр (активен)' : 'Фильтр';
}



// Инициализация при загрузке
updateFilterButton();


//////////////////////////////////////////////////

// --- init
loadBatteries();