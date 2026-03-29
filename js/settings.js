import { supabase, SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const statusEl = document.getElementById("status");
const clientsBody = document.getElementById("clientsTableBody");
const typesBody = document.getElementById("taskTypesTableBody");

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
  statusEl.hidden = true;
  statusEl.textContent = "";
}

const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

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

const DEFAULT_TYPE_COLOR = "#e2e8f0";

async function loadClients() {
  const { data, error } = await supabase.from("clients").select("*").order("name");
  if (error) {
    setStatus(`Клиенты: ${error.message}`, true);
    return;
  }
  clientsBody.innerHTML = "";
  for (const row of data || []) {
    const tr = document.createElement("tr");
    for (const text of [row.name, row.phone || "—", row.email || "—"]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    const tdAct = document.createElement("td");
    tdAct.className = "cell-actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-icon btn-icon--danger";
    btn.setAttribute("aria-label", "Удалить");
    btn.innerHTML = TRASH_SVG;
    btn.addEventListener("click", () => deleteClient(row.id));
    tdAct.appendChild(btn);
    tr.appendChild(tdAct);
    clientsBody.appendChild(tr);
  }
  hideStatus();
}

async function loadTaskTypes() {
  const { data, error } = await supabase
    .from("task_types")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    setStatus(`Типы задач: ${error.message}`, true);
    return;
  }
  typesBody.innerHTML = "";
  for (const row of data || []) {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = row.name;

    const tdColor = document.createElement("td");
    tdColor.className = "cell-color-picker";
    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "input-color";
    picker.title = "Цвет фона строк с этим типом задач";
    picker.value = normalizeHexColor(row.color) || DEFAULT_TYPE_COLOR;
    picker.addEventListener("change", () => saveTaskTypeColor(row.id, picker.value));
    tdColor.appendChild(picker);

    const tdAct = document.createElement("td");
    tdAct.className = "cell-actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-icon btn-icon--danger";
    btn.setAttribute("aria-label", "Удалить");
    btn.innerHTML = TRASH_SVG;
    btn.addEventListener("click", () => deleteTaskType(row.id));
    tdAct.appendChild(btn);
    tr.append(tdName, tdColor, tdAct);
    typesBody.appendChild(tr);
  }
  hideStatus();
}

async function saveTaskTypeColor(id, hex) {
  const color = normalizeHexColor(hex);
  const { error } = await supabase.from("task_types").update({ color }).eq("id", id);
  if (error) {
    setStatus(`Цвет: ${error.message}`, true);
    return;
  }
  hideStatus();
}

async function deleteClient(id) {
  if (!confirm("Удалить этого клиента из справочника?")) return;
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    setStatus(`Ошибка удаления: ${error.message}`, true);
    return;
  }
  await loadClients();
}

async function deleteTaskType(id) {
  if (!confirm("Удалить этот тип задачи?")) return;
  const { error } = await supabase.from("task_types").delete().eq("id", id);
  if (error) {
    setStatus(`Ошибка удаления: ${error.message}`, true);
    return;
  }
  await loadTaskTypes();
}

document.getElementById("clientAddForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("newClientName").value.trim();
  if (!name) return;
  const phone = document.getElementById("newClientPhone").value.trim() || null;
  const email = document.getElementById("newClientEmail").value.trim() || null;
  const { error } = await supabase.from("clients").insert({ name, phone, email });
  if (error) {
    setStatus(`Ошибка: ${error.message}`, true);
    return;
  }
  e.target.reset();
  await loadClients();
});

document.getElementById("taskTypeAddForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("newTaskTypeName").value.trim();
  if (!name) return;
  const colorHex = document.getElementById("newTaskTypeColor").value;
  const color = normalizeHexColor(colorHex);
  const { error } = await supabase
    .from("task_types")
    .insert({ name, sort_order: 99, color });
  if (error) {
    setStatus(`Ошибка: ${error.message}`, true);
    return;
  }
  e.target.reset();
  await loadTaskTypes();
});

if (isConfigPlaceholder()) {
  setStatus("Укажите ключи Supabase (config.local.js / Vercel).", true);
} else {
  loadClients();
  loadTaskTypes();
}
