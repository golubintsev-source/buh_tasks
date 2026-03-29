# Бух задачи

Статический сайт (HTML/CSS/JS) + Supabase + Vercel. Node.js на компьютере не нужен.

## 1. Supabase

1. Выполните скрипт `supabase_tasks.sql` в **SQL Editor**.
2. **Project Settings → API**: скопируйте **URL** и **anon public** key.

## 2. Ключи в проекте

Откройте `js/config.js` и замените:

- `https://YOUR_PROJECT_REF.supabase.co` на ваш **Project URL**
- `YOUR_SUPABASE_ANON_KEY` на **anon key**

## 3. GitHub и Vercel

1. Инициализируйте git в папке проекта, сделайте первый commit и отправьте в ваш репозиторий.
2. В Vercel импортируйте репозиторий и добавьте переменные окружения:

   - `SUPABASE_URL` — тот же URL
   - `SUPABASE_ANON_KEY` — тот же anon key

3. После деплоя откройте выданный адрес `*.vercel.app`: запросы к базе идут через `/api/supabase-proxy`.

## 4. Локальный просмотр

Откройте `index.html` в браузере. На `localhost` клиент ходит в Supabase **напрямую** (прокси отключён в `js/config.js`), поэтому ключи в `config.js` должны быть заполнены.
