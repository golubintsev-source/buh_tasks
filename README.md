# Бух задачи

Статический сайт (HTML/CSS/JS) + Supabase + Vercel. Node на вашем ПК не обязателен; на стороне Vercel при деплое выполняется `npm run build` и подставляется `js/config.local.js` из переменных окружения.

## 1. Supabase

1. Выполните скрипт `supabase_tasks.sql` в **SQL Editor**.
2. **Project Settings → API**: скопируйте **URL** и **anon public** key.

## 2. Ключи в проекте

Секреты в репозиторий не кладём.

1. Скопируйте `js/config.local.example.js` в **`js/config.local.js`** (этот файл в `.gitignore` и в GitHub не попадёт).
2. Подставьте в `config.local.js` ваш **Project URL** и **anon public** key.

В коммите остаются только заглушки в `js/config.js`; реальные значения задаются через `config.local.js` или переменные окружения на хостинге (см. ниже).

## 3. GitHub и Vercel

1. Инициализируйте git в папке проекта, сделайте первый commit и отправьте в ваш репозиторий.
2. В Vercel импортируйте репозиторий и в **Settings → Environment Variables** добавьте (для Production и Preview):

   - `SUPABASE_URL` — **Project URL** из Supabase
   - `SUPABASE_ANON_KEY` — **anon public** key

   Они нужны и **серверной** функции `/api/supabase-proxy`, и **сборке**: перед выкладкой сайта выполняется `npm run build`, скрипт `scripts/vercel-generate-config-local.js` записывает в артефакт деплоя `js/config.local.js` с этими значениями — без этого в браузере остаются заглушки и показывается красная подсказка.

3. Сделайте **Redeploy** последнего деплоя (или новый push), чтобы сборка прошла уже с переменными.

4. Откройте адрес `*.vercel.app`: запросы к базе идут через `/api/supabase-proxy`.

### Если ключ когда-либо попал в git

В **Supabase → Project Settings → API** перевыпустите **anon** key (или смените секреты по инструкции Supabase), затем обновите `js/config.local.js` и переменные в Vercel.

## 4. Локальный просмотр

Откройте `index.html` в браузере. На `localhost` клиент ходит в Supabase **напрямую** (прокси отключён в `js/config.js`), поэтому должен быть заполнен **`js/config.local.js`** (или заданы `window` до загрузки скриптов).

Пока файла `js/config.local.js` нет, в консоли браузера может быть **404** на этот скрипт — это нормально; после копирования из `config.local.example.js` и заполнения ключей предупреждение пропадёт.
