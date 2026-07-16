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
const clientTriggerEl = document.getElementById("clientSelectTrigger");
const clientLabelEl = document.getElementById("clientSelectLabel");
const clientDropdownEl = document.getElementById("clientSelectDropdown");
const clientMultiEl = document.getElementById("clientMulti");

/** @type {string | null} */
let editingTaskId = null;

let clientsList = [];
let clientsById = new Map();

/** @type {Set<string>} selected client ids, or "__legacy__" / empty via none */
const selectedClientIds = new Set();
/** @type {string | null} legacy client name when editing a task whose client is gone */
let legacyClientName = null;

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

function isMultiClientMode() {
  return !editingTaskId;
}

function populateClientSelect() {
  if (!clientDropdownEl) return;
  clientDropdownEl.innerHTML = "";

  const none = document.createElement("label");
  none.className = "client-multi__option client-multi__option--empty";
  none.dataset.value = "";
  none.textContent = "— без клиента —";
  none.addEventListener("click", (e) => {
    e.preventDefault();
    selectedClientIds.clear();
    legacyClientName = null;
    syncClientUi();
    applyPhoneFromSelection();
    closeClientDropdown();
  });
  clientDropdownEl.appendChild(none);

  if (legacyClientName) {
    const wrap = document.createElement("label");
    wrap.className = "client-multi__option";
    const input = document.createElement("input");
    input.type = isMultiClientMode() ? "checkbox" : "radio";
    input.name = "client_pick";
    input.value = "__legacy__";
    input.checked = selectedClientIds.has("__legacy__");
    input.addEventListener("change", () => onClientOptionChange("__legacy__", input.checked));
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(legacyClientName));
    clientDropdownEl.appendChild(wrap);
  }

  for (const c of clientsList) {
    const wrap = document.createElement("label");
    wrap.className = "client-multi__option";
    const input = document.createElement("input");
    input.type = isMultiClientMode() ? "checkbox" : "radio";
    input.name = "client_pick";
    input.value = c.id;
    input.checked = selectedClientIds.has(c.id);
    input.addEventListener("change", () => onClientOptionChange(c.id, input.checked));
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(c.name));
    clientDropdownEl.appendChild(wrap);
  }

  syncClientUi();
}

function onClientOptionChange(id, checked) {
  if (isMultiClientMode()) {
    if (checked) selectedClientIds.add(id);
    else selectedClientIds.delete(id);
  } else {
    selectedClientIds.clear();
    if (checked) selectedClientIds.add(id);
    closeClientDropdown();
  }
  syncClientUi();
  applyPhoneFromSelection();
}

function getSelectedClients() {
  /** @type {{ id: string, name: string, phone: string | null }[]} */
  const out = [];
  for (const id of selectedClientIds) {
    if (id === "__legacy__") {
      out.push({ id, name: (legacyClientName || "").trim(), phone: null });
      continue;
    }
    const c = clientsById.get(id);
    if (c) out.push({ id: c.id, name: c.name.trim(), phone: c.phone || null });
  }
  return out;
}

function syncClientUi() {
  if (!clientLabelEl || !clientDropdownEl) return;
  const selected = getSelectedClients();
  clientLabelEl.classList.toggle("client-multi__value--placeholder", selected.length === 0);

  if (selected.length === 0) {
    clientLabelEl.textContent = "— выберите клиента —";
  } else if (selected.length === 1) {
    clientLabelEl.textContent = selected[0].name || "— выберите клиента —";
  } else {
    clientLabelEl.textContent = `Выбрано: ${selected.length}`;
  }

  clientDropdownEl.querySelectorAll("input[type='checkbox'], input[type='radio']").forEach((input) => {
    input.checked = selectedClientIds.has(input.value);
  });

  clientDropdownEl.setAttribute("aria-multiselectable", isMultiClientMode() ? "true" : "false");

  const phoneField = phoneEl?.closest(".field");
  if (selected.length > 1) {
    phoneEl.disabled = true;
    phoneField?.setAttribute("title", "При нескольких клиентах телефон берётся из карточки каждого");
  } else {
    phoneEl.disabled = false;
    phoneField?.removeAttribute("title");
  }
}

function applyPhoneFromSelection() {
  const selected = getSelectedClients();
  if (selected.length === 1 && selected[0].id !== "__legacy__") {
    const c = clientsById.get(selected[0].id);
    if (c) setPhoneInputValue(phoneEl, c.phone || "");
  } else if (selected.length !== 1) {
    setPhoneInputValue(phoneEl, "");
  }
}

function openClientDropdown() {
  if (!clientDropdownEl || !clientTriggerEl) return;
  clientDropdownEl.hidden = false;
  clientTriggerEl.setAttribute("aria-expanded", "true");
}

function closeClientDropdown() {
  if (!clientDropdownEl || !clientTriggerEl) return;
  clientDropdownEl.hidden = true;
  clientTriggerEl.setAttribute("aria-expanded", "false");
}

function toggleClientDropdown() {
  if (clientDropdownEl?.hidden) openClientDropdown();
  else closeClientDropdown();
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
  const clientLbl = document.getElementById("clientFieldLabel");
  if (clientLbl) clientLbl.textContent = "Клиенты";
}

function setPageTitleEdit(numStr) {
  const t = `Редактирование ${numStr}`;
  taskNavLabelEl.textContent = t;
  document.title = `${t} — Бух задачи`;
  const clientLbl = document.getElementById("clientFieldLabel");
  if (clientLbl) clientLbl.textContent = "Клиент";
}

function clearEditMode() {
  editingTaskId = null;
  selectedClientIds.clear();
  legacyClientName = null;
  const lbl = document.getElementById("taskTextLabel");
  if (lbl) lbl.textContent = "Текст задачи";
  const btn = document.getElementById("taskSubmitBtn");
  if (btn) btn.textContent = "Сохранить";
  setPageTitleNew();
  populateClientSelect();
}

function fillFormForEdit(row) {
  editingTaskId = row.id;
  taskTextEl.closest(".field")?.classList.remove("field--invalid");
  deadlineEl.closest(".field")?.classList.remove("field--invalid");
  hideStatus();
  setPageTitleEdit(formatTaskNumber(row.task_number));
  taskTextEl.value = (row.task_text || row.title || "").trim();

  selectedClientIds.clear();
  legacyClientName = null;
  const name = (row.client_name || "").trim();
  const match = clientsList.find((c) => c.name === name);
  if (match) {
    selectedClientIds.add(match.id);
    setPhoneInputValue(phoneEl, match.phone || row.phone || "");
  } else if (name) {
    legacyClientName = name;
    selectedClientIds.add("__legacy__");
    setPhoneInputValue(phoneEl, row.phone || "");
  } else {
    setPhoneInputValue(phoneEl, row.phone || "");
  }
  populateClientSelect();

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
  const selected = getSelectedClients();
  if (selected.length <= 1 && !isPhoneEmptyOrComplete(phoneEl?.value ?? "")) {
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

clientTriggerEl?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleClientDropdown();
});

document.addEventListener("click", (e) => {
  if (!clientMultiEl?.contains(e.target)) closeClientDropdown();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeClientDropdown();
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

  const selected = getSelectedClients();
  const task_type = document.getElementById("taskType").value.trim() || null;
  const deadline = new Date(deadlineRaw).toISOString();
  const formPhone = phoneForStorage(phoneEl?.value ?? "");

  let error;
  if (editingTaskId) {
    const client = selected[0] || null;
    const payload = {
      task_text: taskText,
      title: taskText,
      client_name: client ? client.name || null : null,
      phone: formPhone,
      task_type,
      deadline,
    };
    ({ error } = await supabase.from("tasks").update(payload).eq("id", editingTaskId));
  } else if (selected.length > 1) {
    const rows = selected.map((c) => ({
      task_text: taskText,
      title: taskText,
      client_name: c.name || null,
      phone: phoneForStorage(c.phone || ""),
      task_type,
      deadline,
      closed: false,
    }));
    ({ error } = await supabase.from("tasks").insert(rows));
  } else {
    const client = selected[0] || null;
    const payload = {
      task_text: taskText,
      title: taskText,
      client_name: client ? client.name || null : null,
      phone: formPhone,
      task_type,
      deadline,
      closed: false,
    };
    ({ error } = await supabase.from("tasks").insert(payload));
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
      selectedClientIds.clear();
      legacyClientName = null;
      syncClientUi();
    }
  })();
}
