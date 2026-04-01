import { supabase, SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { formatPhoneInput } from "./phoneMask.js";
import { formatTaskNumber } from "./task-utils.js";

const boardEl = document.getElementById("taskBoard");
const statusEl = document.getElementById("status");

/** Имя типа задачи (trim) → #rrggbb для фона строки */
let taskTypeColors = new Map();

/** @param {string | null | undefined} raw */
function normalizeHexColor(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    const r = s[1],
      g = s[2],
      b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function rebuildTaskTypeColors(types) {
  taskTypeColors = new Map();
  for (const t of types) {
    const hex = normalizeHexColor(t.color);
    if (hex) taskTypeColors.set(String(t.name).trim(), hex);
  }
}

async function loadReferenceData() {
  const tr = await supabase
    .from("task_types")
    .select("id,name,sort_order,color")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (tr.error) {
    setStatus(`Типы задач: ${tr.error.message}`, true);
    return;
  }
  rebuildTaskTypeColors(tr.data || []);
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

function rowBackgroundForTaskType(taskTypeRaw) {
  const name = (taskTypeRaw || "").trim();
  if (!name) return null;
  return taskTypeColors.get(name) || null;
}

function openTaskEdit(row) {
  window.location.href = `./task.html?edit=${encodeURIComponent(row.id)}`;
}

function renderTableRows(tbody, rows) {
  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;
    const rowBg = rowBackgroundForTaskType(row.task_type);
    if (rowBg) {
      tr.classList.add("task-row--typed");
      tr.style.setProperty("--row-type-bg", rowBg);
    }

    const tdNum = document.createElement("td");
    tdNum.className = "cell-num cell-num--edit";
    const numBadge = document.createElement("span");
    numBadge.className = "cell-num__badge";
    numBadge.textContent = formatTaskNumber(row.task_number);
    tdNum.appendChild(numBadge);
    tdNum.title = "Редактировать задачу";
    tdNum.setAttribute("role", "button");
    tdNum.tabIndex = 0;
    const onOpenEdit = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openTaskEdit(row);
    };
    tdNum.addEventListener("click", onOpenEdit);
    tdNum.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openTaskEdit(row);
      }
    });
    const tdText = el("td", "cell-text cell-task");
    tdText.textContent = (row.task_text || row.title || "").trim() || "—";

    const tdClient = el("td", "cell-nowrap cell-client", row.client_name || "—");
    const phoneDisplay = row.phone ? formatPhoneInput(row.phone) || row.phone : "—";
    const tdPhone = el("td", "cell-nowrap cell-phone", phoneDisplay);
    const tdType = el("td", "cell-nowrap cell-type", row.task_type || "—");
    const tdDeadline = el("td", "cell-nowrap cell-deadline", fmtDateTime(row.deadline));

    const tdClosed = document.createElement("td");
    tdClosed.className = "check-cell";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = Boolean(row.closed);
    cb.title = "Выполнена";
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

    tr.append(tdNum, tdText, tdClient, tdPhone, tdType, tdDeadline, tdClosed, tdDelete);
    tbody.appendChild(tr);
  }
}

function renderSection(title, variant, rows) {
  const section = el("section", `task-block task-block--${variant}`);
  section.setAttribute("aria-label", title);

  const head = el("div", "task-block__head task-block__head--collapsible");
  head.setAttribute("role", "button");
  head.setAttribute("tabindex", "0");
  const defaultCollapsed = variant === "done";
  if (defaultCollapsed) {
    section.classList.add("task-block--collapsed");
    head.setAttribute("aria-expanded", "false");
  } else {
    head.setAttribute("aria-expanded", "true");
  }

  const titleEl = el("h2", "task-block__title", title);
  const countEl = el("span", "task-block__count", String(rows.length));
  const icon = el("span", "task-block__collapse-icon");
  icon.setAttribute("aria-hidden", "true");
  head.append(titleEl, countEl, icon);

  const toggleCollapse = () => {
    const nowCollapsed = section.classList.toggle("task-block--collapsed");
    head.setAttribute("aria-expanded", String(!nowCollapsed));
  };
  head.addEventListener("click", toggleCollapse);
  head.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCollapse();
    }
  });

  const body = el("div", "task-block__body");
  body.id = `task-block-panel-${variant}`;
  head.setAttribute("aria-controls", body.id);

  if (rows.length === 0) {
    body.appendChild(el("p", "empty-block", "В этом разделе пока нет задач."));
  } else {
    const wrap = el("div", "table-wrap");
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
          "Тип",
          "Дедлайн",
          "Выполнена",
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
    body.appendChild(wrap);
  }

  section.append(head, body);
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
  await loadTasks();
}

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
