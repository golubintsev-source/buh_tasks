import { supabase, SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const listEl = document.getElementById("taskList");
const formEl = document.getElementById("taskForm");
const inputEl = document.getElementById("taskTitle");
const statusEl = document.getElementById("status");

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

async function loadTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, done, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(`Ошибка загрузки: ${error.message}`, true);
    return;
  }

  setStatus(`Задач: ${data.length}`, false);
  listEl.innerHTML = "";
  for (const row of data) {
    const li = document.createElement("li");
    li.className = "task-item";
    li.dataset.id = row.id;

    const label = document.createElement("label");
    label.className = "task-item__label";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "task-item__check";
    cb.checked = Boolean(row.done);
    cb.addEventListener("change", () => toggleDone(row.id, cb.checked));

    const span = document.createElement("span");
    span.className = "task-item__title";
    span.textContent = row.title;
    if (row.done) span.classList.add("task-item__title--done");

    label.append(cb, span);
    li.appendChild(label);
    listEl.appendChild(li);
  }
}

async function toggleDone(id, done) {
  const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
  if (error) {
    setStatus(`Ошибка сохранения: ${error.message}`, true);
    await loadTasks();
    return;
  }
  await loadTasks();
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = inputEl.value.trim();
  if (!title) return;

  const { error } = await supabase.from("tasks").insert({ title, done: false });
  if (error) {
    setStatus(`Ошибка добавления: ${error.message}`, true);
    return;
  }
  inputEl.value = "";
  await loadTasks();
});

if (isConfigPlaceholder()) {
  setStatus(
    "Укажите SUPABASE_URL и anon key в js/config.js (или через window в index.html).",
    true
  );
} else {
  loadTasks();
}
