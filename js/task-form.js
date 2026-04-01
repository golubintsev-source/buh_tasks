import { supabase, SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import {
  attachPhoneMask,
  setPhoneInputValue,
  phoneForStorage,
  isPhoneEmptyOrComplete,
} from "./phoneMask.js";
import { formatTaskNumber, toDatetimeLocalValue } from "./task-utils.js";

const formEl = document.getElementById("taskForm");
const statusEl = document.getElementById("status");
const taskTextEl = document.getElementById("taskText");
const deadlineEl = document.getElementById("deadline");
const phoneEl = document.getElementById("phone");
const taskNavLabelEl = document.getElementById("taskNavLabel");

/** @type {string | null} */
let editingTaskId = null;

let clientsList = [];
let clientsById = new Map();

async function loadReferenceData() {
  const [cr, tr] = await Promise.all([
    supabase.from("clients").select("id,name,phone").order("name"),
    supabase
      .from("task_types")
      .select("id,name,sort_order,color")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);
  if (cr.error) {
    setStatus(`Справочник клиентов: ${cr.error.message}`, true);
    return false;
  }
  clientsList = cr.data || [];
  clientsById = new Map(clientsList.map((c) => [c.id, c]));
  populateClientSelect();
  if (tr.error) {
    setStatus(`Типы задач: ${tr.error.message}`, true);
    return false;
  }
  populateTaskTypeSelect(tr.data || []);
  return true;
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

function setPageTitleNew() {
  const t = "Новая задача";
  taskNavLabelEl.textContent = t;
  document.title = `${t} — Бух задачи`;
}

function setPageTitleEdit(numStr) {
  const t = `Редактирование ${numStr}`;
  taskNavLabelEl.textContent = t;
  document.title = `${t} — Бух задачи`;
}

function clearEditMode() {
  editingTaskId = null;
  document.querySelector("#clientSelect option[data-legacy]")?.remove();
  const lbl = document.getElementById("taskTextLabel");
  if (lbl) lbl.textContent = "Текст задачи";
  const btn = document.getElementById("taskSubmitBtn");
  if (btn) btn.textContent = "Сохранить";
  setPageTitleNew();
}

function fillFormForEdit(row) {
  editingTaskId = row.id;
  taskTextEl.closest(".field")?.classList.remove("field--invalid");
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
  hideStatus();
  setPageTitleEdit(formatTaskNumber(row.task_number));
  taskTextEl.value = (row.task_text || row.title || "").trim();
  document.querySelector("#clientSelect option[data-legacy]")?.remove();
  const name = (row.client_name || "").trim();
  const match = clientsList.find((c) => c.name === name);
  const clientSel = document.getElementById("clientSelect");
  if (match) {
    clientSel.value = match.id;
    setPhoneInputValue(phoneEl, match.phone || row.phone || "");
  } else if (name) {
    const o = document.createElement("option");
    o.value = "__legacy__";
    o.textContent = name;
    o.dataset.legacy = "1";
    clientSel.appendChild(o);
    clientSel.value = "__legacy__";
    setPhoneInputValue(phoneEl, row.phone || "");
  } else {
    clientSel.value = "";
    setPhoneInputValue(phoneEl, row.phone || "");
  }
  document.getElementById("taskType").value = row.task_type || "";
  deadlineEl.value = toDatetimeLocalValue(row.deadline);
  document.getElementById("taskSubmitBtn").textContent = "Сохранить";
  taskTextEl.focus();
}

function validateTaskForm() {
  taskTextEl.closest(".field")?.classList.remove("field--invalid");
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
  phoneEl?.closest(".field")?.classList.remove("field--invalid");
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
  if (!isPhoneEmptyOrComplete(phoneEl?.value ?? "")) {
    phoneEl?.closest(".field")?.classList.add("field--invalid");
    valid = false;
  }
  return valid;
}

taskTextEl.addEventListener("input", () => {
  taskTextEl.closest(".field")?.classList.remove("field--invalid");
});
/** Для новой задачи: если после выбора даты время 00:00, подставить 18:00. */
function applyDefaultDeadlineTime18() {
  if (editingTaskId) return;
  const v = deadlineEl.value;
  if (!v) return;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T00:00$/);
  if (m) {
    deadlineEl.value = `${m[1]}T18:00`;
  }
}

deadlineEl.addEventListener("input", () => {
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
});
deadlineEl.addEventListener("change", () => {
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
  applyDefaultDeadlineTime18();
});

document.getElementById("clientSelect").addEventListener("change", () => {
  const id = document.getElementById("clientSelect").value;
  if (id && id !== "__legacy__") {
    const c = clientsById.get(id);
    if (c) {
      setPhoneInputValue(phoneEl, c.phone || "");
    }
  }
});

phoneEl?.addEventListener("input", () => {
  phoneEl.closest(".field")?.classList.remove("field--invalid");
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const taskText = taskTextEl.value.trim();
  const deadlineRaw = deadlineEl.value.trim();

  if (!validateTaskForm()) {
    setStatus("Заполните текст задачи и дедлайн. Телефон — полностью (+7-…) или пусто.", true);
    if (!taskText) taskTextEl.focus();
    else if (!deadlineRaw) deadlineEl.focus();
    else phoneEl?.focus();
    return;
  }

  hideStatus();

  const client_name = getClientNameFromForm();
  const phone = phoneForStorage(phoneEl?.value ?? "");
  const task_type = document.getElementById("taskType").value.trim() || null;
  const deadline = new Date(deadlineRaw).toISOString();

  const payload = {
    task_text: taskText,
    title: taskText,
    client_name,
    phone,
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

  window.location.href = "./index.html";
});

if (isConfigPlaceholder()) {
  setStatus(
    "Укажите URL и anon key. Локально: js/config.local.js из примера. На Vercel: переменные SUPABASE_URL и SUPABASE_ANON_KEY в проекте и Redeploy.",
    true
  );
} else {
  attachPhoneMask(phoneEl);
  (async () => {
    const ok = await loadReferenceData();
    if (!ok) return;

    const editId = new URLSearchParams(window.location.search).get("edit");
    if (editId) {
      const { data: row, error } = await supabase.from("tasks").select("*").eq("id", editId).maybeSingle();
      if (error) {
        setStatus(`Ошибка загрузки задачи: ${error.message}`, true);
        return;
      }
      if (!row) {
        setStatus("Задача не найдена.", true);
        return;
      }
      fillFormForEdit(row);
    } else {
      clearEditMode();
      formEl.reset();
    }
  })();
}
