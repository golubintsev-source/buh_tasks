/**
 * На Vercel при деплое подставляет js/config.local.js из переменных окружения.
 * Локально без переменных скрипт ничего не делает (остаётся ваш ручной config.local.js).
 */
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "..", "js", "config.local.js");
const url = (process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_ANON_KEY || "").trim();

if (!url || !key) {
  console.log(
    "vercel-generate-config-local: пропуск (нет SUPABASE_URL или SUPABASE_ANON_KEY в окружении)"
  );
  process.exit(0);
}

const body = `/* сгенерировано при сборке на Vercel; не редактировать вручную в проде */
window.__SUPABASE_URL__ = ${JSON.stringify(url)};
window.__SUPABASE_ANON_KEY__ = ${JSON.stringify(key)};
`;

fs.writeFileSync(out, body, "utf8");
console.log("vercel-generate-config-local: записан js/config.local.js");
