/**
 * Отдаёт JS, который выставляет window.__SUPABASE_* из переменных Vercel.
 * GET /api/supabase-public-config — без сборки, только env в Dashboard.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res
      .status(200)
      .send(
        "// Задайте в Vercel: SUPABASE_URL и SUPABASE_ANON_KEY (Settings → Environment Variables), затем Redeploy.\n"
      );
  }

  res.status(200).send(
    `window.__SUPABASE_URL__=${JSON.stringify(SUPABASE_URL)};window.__SUPABASE_ANON_KEY__=${JSON.stringify(SUPABASE_ANON_KEY)};`
  );
};
