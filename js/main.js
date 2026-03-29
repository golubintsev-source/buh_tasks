import { supabase, SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const boardEl = document.getElementById("taskBoard");
const formEl = document.getElementById("taskForm");
const statusEl = document.getElementById("status");

const COLS =
  "id, created_at, task_text, client_name, phone, email, task_type, deadline, closed";

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
    return new Date(a.created_at) - new Date(b.created_at);
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

function renderTableRows(tbody, rows) {
  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;

    const tdCreated = el("td", "cell-nowrap", fmtDateTime(row.created_at));
    const tdText = el("td", "cell-text");
    tdText.textContent = row.task_text || "—";

    const tdClient = el("td", null, row.client_name || "—");
    const tdPhone = el("td", "cell-nowrap", row.phone || "—");
    const tdEmail = el("td", null, row.email || "—");
    const tdType = el("td", "cell-nowrap", row.task_type || "—");
    const tdDeadline = el("td", "cell-nowrap", fmtDateTime(row.deadline));

    const tdClosed = document.createElement("td");
    tdClosed.className = "check-cell";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = Boolean(row.closed);
    cb.title = "Закрыта";
    cb.addEventListener("change", () => toggleClosed(row.id, cb.checked));
    tdClosed.appendChild(cb);

    tr.append(
      tdCreated,
      tdText,
      tdClient,
      tdPhone,
      tdEmail,
      tdType,
      tdDeadline,
      tdClosed
    );
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
  table.appendChild(
    (() => {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      const headers = [
        "Создано",
        "Задача",
        "Клиент",
        "Телефон",
        "Email",
        "Тип",
        "Дедлайн",
        "Закрыта",
      ];
      for (const h of headers) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = h;
        tr.appendChild(th);
      }
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
  const { data, error } = await supabase.from("tasks").select(COLS);

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

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const taskText = document.getElementById("taskText").value.trim();
  if (!taskText) return;

  const client_name = document.getElementById("clientName").value.trim() || null;
  const phone = document.getElementById("phone").value.trim() || null;
  const email = document.getElementById("email").value.trim() || null;
  const task_type = document.getElementById("taskType").value.trim() || null;
  const deadlineRaw = document.getElementById("deadline").value;
  const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;

  const { error } = await supabase.from("tasks").insert({
    task_text: taskText,
    client_name,
    phone,
    email,
    task_type,
    deadline,
    closed: false,
  });

  if (error) {
    setStatus(`Ошибка добавления: ${error.message}`, true);
    return;
  }

  formEl.reset();
  await loadTasks();
});

if (isConfigPlaceholder()) {
  setStatus(
    "Укажите URL и anon key. Локально: js/config.local.js из примера. На Vercel: переменные SUPABASE_URL и SUPABASE_ANON_KEY в проекте и Redeploy.",
    true
  );
} else {
  loadTasks();
}
