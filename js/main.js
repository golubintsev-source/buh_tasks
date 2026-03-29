import { supabase, SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const boardEl = document.getElementById("taskBoard");
const formEl = document.getElementById("taskForm");
const statusEl = document.getElementById("status");
const taskTextEl = document.getElementById("taskText");
const deadlineEl = document.getElementById("deadline");

/** @type {string | null} */
let editingTaskId = null;

let clientsList = [];
let clientsById = new Map();

async function loadReferenceData() {
  const [cr, tr] = await Promise.all([
    supabase.from("clients").select("id,name,phone,email").order("name"),
    supabase.from("task_types").select("id,name,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }),
  ]);
  if (cr.error) {
    setStatus(`Справочник клиентов: ${cr.error.message}`, true);
    return;
  }
  clientsList = cr.data || [];
  clientsById = new Map(clientsList.map((c) => [c.id, c]));
  populateClientSelect();
  if (tr.error) {
    setStatus(`Типы задач: ${tr.error.message}`, true);
    return;
  }
  populateTaskTypeSelect(tr.data || []);
}

function populateClientSelect() {
  const sel = document.getElementById("clientSelect");
  if (!sel) return;
  const prev = sel.value;
  sel.querySelectorAll("option[data-legacy]").forEach((o) => o.remove());
  sel.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "— выберите клиента —";
  sel.appendChild(empty);
  for (const c of clientsList) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    sel.appendChild(o);
  }
  if (prev && [...sel.options].some((o) => o.value === prev)) {
    sel.value = prev;
  }
}

function populateTaskTypeSelect(types) {
  const sel = document.getElementById("taskType");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "—";
  sel.appendChild(empty);
  for (const t of types) {
    const o = document.createElement("option");
    o.value = t.name;
    o.textContent = t.name;
    sel.appendChild(o);
  }
  if (prev && [...sel.options].some((o) => o.value === prev)) {
    sel.value = prev;
  }
}

function getClientNameFromForm() {
  const sel = document.getElementById("clientSelect");
  const opt = sel?.selectedOptions[0];
  if (!opt || !opt.value) return null;
  if (opt.value === "__legacy__") return opt.textContent.trim() || null;
  const c = clientsById.get(opt.value);
  return c ? c.name.trim() : null;
}

function isConfigPlaceholder() {
  return (
    SUPABASE_URL.includes("YOUR_PROJECT_REF") ||
    SUPABASE_KEY.includes("YOUR_SUPABASE_ANON_KEY")
  );
}

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle("status--error", Boolean(isError));
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.textContent = "";
  statusEl.classList.remove("status--error");
  statusEl.hidden = true;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Номер задачи в виде 007 (минимум 3 цифры; при >999 длина растёт). */
function formatTaskNumber(n) {
  if (n == null || n === "") return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return String(Math.trunc(num)).padStart(3, "0");
}

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function clearEditMode() {
  editingTaskId = null;
  document.querySelector("#clientSelect option[data-legacy]")?.remove();
  const lbl = document.getElementById("taskTextLabel");
  if (lbl) lbl.textContent = "Текст задачи";
  const btn = document.getElementById("taskSubmitBtn");
  if (btn) btn.textContent = "Сохранить";
}

function startEditTask(row) {
  editingTaskId = row.id;
  taskTextEl.closest(".field")?.classList.remove("field--invalid");
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
  hideStatus();
  const lbl = document.getElementById("taskTextLabel");
  if (lbl) lbl.textContent = `Текст задачи (№ ${formatTaskNumber(row.task_number)})`;
  taskTextEl.value = (row.task_text || row.title || "").trim();
  document.querySelector("#clientSelect option[data-legacy]")?.remove();
  const name = (row.client_name || "").trim();
  const match = clientsList.find((c) => c.name === name);
  const clientSel = document.getElementById("clientSelect");
  if (match) {
    clientSel.value = match.id;
    document.getElementById("phone").value = match.phone || row.phone || "";
    document.getElementById("email").value = match.email || row.email || "";
  } else if (name) {
    const o = document.createElement("option");
    o.value = "__legacy__";
    o.textContent = name;
    o.dataset.legacy = "1";
    clientSel.appendChild(o);
    clientSel.value = "__legacy__";
    document.getElementById("phone").value = row.phone || "";
    document.getElementById("email").value = row.email || "";
  } else {
    clientSel.value = "";
    document.getElementById("phone").value = row.phone || "";
    document.getElementById("email").value = row.email || "";
  }
  document.getElementById("taskType").value = row.task_type || "";
  deadlineEl.value = toDatetimeLocalValue(row.deadline);
  formEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  taskTextEl.focus();
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function addCalendarDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function groupTasks(tasks) {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = startOfLocalDay(addCalendarDays(now, 1));
  const dayAfterTomorrowStart = startOfLocalDay(addCalendarDays(now, 2));

  const completed = [];
  const overdue = [];
  const today = [];
  const tomorrow = [];
  const future = [];

  for (const t of tasks) {
    if (t.closed) {
      completed.push(t);
      continue;
    }
    if (!t.deadline) {
      future.push(t);
      continue;
    }
    const ds = startOfLocalDay(new Date(t.deadline));
    if (ds < todayStart) {
      overdue.push(t);
    } else if (ds === todayStart) {
      today.push(t);
    } else if (ds === tomorrowStart) {
      tomorrow.push(t);
    } else {
      future.push(t);
    }
  }

  const cmp = (a, b) => {
    const ad = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    const c = new Date(a.created_at) - new Date(b.created_at);
    if (c !== 0) return c;
    return (a.task_number ?? 0) - (b.task_number ?? 0);
  };

  completed.sort(cmp);
  overdue.sort(cmp);
  today.sort(cmp);
  tomorrow.sort(cmp);
  future.sort(cmp);

  return { completed, overdue, today, tomorrow, future };
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

function buildColGroup() {
  const cg = document.createElement("colgroup");
  const classes = [
    "data-table__col--num",
    "data-table__col--task",
    "data-table__col--client",
    "data-table__col--phone",
    "data-table__col--email",
    "data-table__col--type",
    "data-table__col--deadline",
    "data-table__col--closed",
    "data-table__col--actions",
  ];
  for (const cls of classes) {
    const col = document.createElement("col");
    col.className = `data-table__col ${cls}`;
    cg.appendChild(col);
  }
  return cg;
}

function trashButton(onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-icon btn-icon--danger";
  btn.setAttribute("aria-label", "Удалить задачу");
  btn.title = "Удалить";
  btn.innerHTML = TRASH_SVG;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderTableRows(tbody, rows) {
  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;

    const tdNum = document.createElement("td");
    tdNum.className = "cell-num cell-num--edit";
    tdNum.textContent = formatTaskNumber(row.task_number);
    tdNum.title = "Редактировать задачу";
    tdNum.setAttribute("role", "button");
    tdNum.tabIndex = 0;
    const onOpenEdit = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      startEditTask(row);
    };
    tdNum.addEventListener("click", onOpenEdit);
    tdNum.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        startEditTask(row);
      }
    });
    const tdText = el("td", "cell-text cell-task");
    tdText.textContent = (row.task_text || row.title || "").trim() || "—";

    const tdClient = el("td", "cell-nowrap cell-client", row.client_name || "—");
    const tdPhone = el("td", "cell-nowrap cell-phone", row.phone || "—");
    const tdEmail = el("td", "cell-nowrap cell-email", row.email || "—");
    const tdType = el("td", "cell-nowrap cell-type", row.task_type || "—");
    const tdDeadline = el("td", "cell-nowrap cell-deadline", fmtDateTime(row.deadline));

    const tdClosed = document.createElement("td");
    tdClosed.className = "check-cell";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = Boolean(row.closed);
    cb.title = "Закрыта";
    cb.addEventListener("change", () => toggleClosed(row.id, cb.checked));
    tdClosed.appendChild(cb);

    const tdDelete = document.createElement("td");
    tdDelete.className = "cell-actions";
    tdDelete.appendChild(
      trashButton(() => {
        if (!confirm("Удалить эту задачу?")) return;
        deleteTask(row.id);
      })
    );

    tr.append(tdNum, tdText, tdClient, tdPhone, tdEmail, tdType, tdDeadline, tdClosed, tdDelete);
    tbody.appendChild(tr);
  }
}

function renderSection(title, variant, rows) {
  const section = el("section", `task-block task-block--${variant}`);
  section.setAttribute("aria-label", title);

  const head = el("div", "task-block__head");
  head.appendChild(el("h2", "task-block__title", title));
  head.appendChild(el("span", "task-block__count", String(rows.length)));

  const wrap = el("div", "table-wrap");
  if (rows.length === 0) {
    const empty = el("p", "empty-block", "В этом разделе пока нет задач.");
    section.append(head, empty);
    return section;
  }

  const table = el("table", "data-table");
  table.appendChild(buildColGroup());
  table.appendChild(
    (() => {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      const headers = [
        "№",
        "Задача",
        "Клиент",
        "Телефон",
        "Email",
        "Тип",
        "Дедлайн",
        "Закрыта",
        "",
      ];
      headers.forEach((h, i) => {
        const th = document.createElement("th");
        th.scope = "col";
        if (i === headers.length - 1 && h === "") {
          th.setAttribute("aria-label", "Удаление");
          th.className = "cell-actions-head";
        } else {
          th.textContent = h;
        }
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      return thead;
    })()
  );

  const tbody = document.createElement("tbody");
  renderTableRows(tbody, rows);
  table.appendChild(tbody);
  wrap.appendChild(table);
  section.append(head, wrap);
  return section;
}

function renderBoard(tasks) {
  const g = groupTasks(tasks);
  boardEl.innerHTML = "";

  const sections = [
    ["Выполненные", "done", g.completed],
    ["Просроченные", "overdue", g.overdue],
    ["Сегодня", "today", g.today],
    ["Завтра", "tomorrow", g.tomorrow],
    ["Будущие задачи", "future", g.future],
  ];

  for (const [title, variant, rows] of sections) {
    boardEl.appendChild(renderSection(title, variant, rows));
  }
}

async function loadTasks() {
  const { data, error } = await supabase.from("tasks").select("*");

  if (error) {
    setStatus(`Ошибка загрузки: ${error.message}`, true);
    return;
  }

  hideStatus();
  renderBoard(data || []);
}

async function toggleClosed(id, closed) {
  const { error } = await supabase.from("tasks").update({ closed }).eq("id", id);
  if (error) {
    setStatus(`Ошибка сохранения: ${error.message}`, true);
    await loadTasks();
    return;
  }
  await loadTasks();
}

async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    setStatus(`Ошибка удаления: ${error.message}`, true);
    return;
  }
  if (editingTaskId === id) {
    clearEditMode();
    formEl.reset();
  }
  await loadTasks();
}

function validateTaskForm() {
  taskTextEl.closest(".field")?.classList.remove("field--invalid");
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
  const taskText = taskTextEl.value.trim();
  const deadlineRaw = deadlineEl.value.trim();
  let valid = true;
  if (!taskText) {
    taskTextEl.closest(".field")?.classList.add("field--invalid");
    valid = false;
  }
  if (!deadlineRaw) {
    deadlineEl.closest(".field")?.classList.add("field--invalid");
    valid = false;
  }
  return valid;
}

taskTextEl.addEventListener("input", () => {
  taskTextEl.closest(".field")?.classList.remove("field--invalid");
});
deadlineEl.addEventListener("input", () => {
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
});
deadlineEl.addEventListener("change", () => {
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
});

document.getElementById("clientSelect").addEventListener("change", () => {
  const id = document.getElementById("clientSelect").value;
  if (id && id !== "__legacy__") {
    const c = clientsById.get(id);
    if (c) {
      document.getElementById("phone").value = c.phone || "";
      document.getElementById("email").value = c.email || "";
    }
  }
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const taskText = taskTextEl.value.trim();
  const deadlineRaw = deadlineEl.value.trim();

  if (!validateTaskForm()) {
    setStatus("Заполните текст задачи и дедлайн.", true);
    if (!taskText) taskTextEl.focus();
    else deadlineEl.focus();
    return;
  }

  hideStatus();

  const client_name = getClientNameFromForm();
  const phone = document.getElementById("phone").value.trim() || null;
  const email = document.getElementById("email").value.trim() || null;
  const task_type = document.getElementById("taskType").value.trim() || null;
  const deadline = new Date(deadlineRaw).toISOString();

  const payload = {
    task_text: taskText,
    title: taskText,
    client_name,
    phone,
    email,
    task_type,
    deadline,
  };

  let error;
  if (editingTaskId) {
    ({ error } = await supabase.from("tasks").update(payload).eq("id", editingTaskId));
  } else {
    ({ error } = await supabase.from("tasks").insert({ ...payload, closed: false }));
  }

  if (error) {
    setStatus(
      editingTaskId ? `Ошибка сохранения: ${error.message}` : `Ошибка добавления: ${error.message}`,
      true
    );
    return;
  }

  clearEditMode();
  formEl.reset();
  await loadTasks();
});

if (isConfigPlaceholder()) {
  setStatus(
    "Укажите URL и anon key. Локально: js/config.local.js из примера. На Vercel: переменные SUPABASE_URL и SUPABASE_ANON_KEY в проекте и Redeploy.",
    true
  );
} else {
  (async () => {
    await loadReferenceData();
    await loadTasks();
  })();
}
