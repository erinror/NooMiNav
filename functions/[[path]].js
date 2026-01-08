export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_admin_auth";

  // --- 1. 配置读取 ---
  let LINKS_DATA = [];
  try { LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : []; } catch (e) {}
  let FRIENDS_DATA = [];
  try { FRIENDS_DATA = env.FRIENDS ? JSON.parse(env.FRIENDS) : []; } catch (e) {}

  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质套餐推荐 · 随时畅联";
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";
  const ADMIN_PASS = env.admin; 
  const BG_IMG = env.img ? `url('${env.img}')` : 'none';

  // 时间逻辑 (UTC+8)
  const now = new Date(new Date().getTime() + 8 * 3600000);
  const currYear = now.getFullYear().toString();
  const currMonth = `${currYear}_${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  // --- 2. 管理员验证逻辑 (/admin) ---
  if (url.pathname === "/admin") {
    const cookie = request.headers.get('Cookie') || '';

    // 处理登录请求 (POST)
    if (request.method === 'POST') {
      const formData = await request.formData();
      if (formData.get('password') === ADMIN_PASS) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/admin',
            'Set-Cookie': `${COOKIE_NAME}=true; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict`
          }
        });
      }
    }

    // 检查权限，没 Cookie 就显示网页登录框
    if (!cookie.includes(`${COOKIE_NAME}=true`)) {
      return new Response(renderLoginPage(TITLE), { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // 已登录，查询 D1
    if (!env.db) return new Response("未检测到 D1 数据库绑定 (变量名需为 db)");
    const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
    return new Response(renderStatsHTML(results, TITLE, currYear, now.getMonth() + 1), { 
      headers: { "content-type": "text/html;charset=UTF-8" } 
    });
  }

  // --- 3. 跳转统计路由 ---
  if (url.pathname.startsWith("/go/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[1];
    const isBackup = parts[2] === "backup";
    const item = LINKS_DATA.find(l => l.id === id);
    if (item) {
      await updateStats(env.db, isBackup ? `${id}_backup` : id, item.name + (isBackup ? "(备用)" : ""), 'link', currYear, currMonth);
      return Response.redirect(isBackup ? item.backup_url : item.url, 302);
    }
  }

  if (url.pathname.startsWith("/fgo/")) {
    const index = parseInt(url.pathname.split("/")[2]);
    const friend = FRIENDS_DATA[index];
    if (friend) {
      await updateStats(env.db, `friend_${index}`, friend.name, 'friend', currYear, currMonth);
      return Response.redirect(friend.url, 302);
    }
  }

  // --- 4. 默认主页 ---
  return new Response(renderMainHTML(TITLE, SUBTITLE, BG_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA), { 
    headers: { "content-type": "text/html;charset=UTF-8" } 
  });
}

// 辅助函数与页面模板
async function updateStats(db, id, name, type, y, m) {
  if (!db) return;
  await db.prepare(`
    INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month)
    VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5)
    ON CONFLICT(id) DO UPDATE SET
      total_clicks = total_clicks + 1,
      year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END,
      month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END,
      last_year = ?4, last_month = ?5, name = ?2
  `).bind(id, name, type, y, m).run();
}

function renderLoginPage(title) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>验证 - ${title}</title><style>body{background:#030712;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(20px);padding:40px;border-radius:24px;width:90%;max-width:360px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.5)}h1{font-size:1.8rem;background:linear-gradient(to right,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px}input{width:100%;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.2);color:#fff;font-size:1rem;margin-bottom:20px;box-sizing:border-box}button{width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:700;cursor:pointer}</style></head><body><div class="card"><h1>访问验证</h1><p style="color:#94a3b8;margin-bottom:20px">请输入密码继续</p><form method="POST"><input type="password" name="password" placeholder="密码..." required autofocus><button type="submit">提交</button></form></div></body></html>`;
}

// 主页与统计页模板 (省略 CSS，与之前一致)
function renderMainHTML(TITLE, SUBTITLE, BG_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA) { /* ... */ }
function renderStatsHTML(results, title, year, month) { /* ... */ }
