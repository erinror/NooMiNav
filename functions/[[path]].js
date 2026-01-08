export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_admin_session";

  // --- 1. 获取变量 ---
  const TITLE = env.TITLE || "我的导航站";
  const ADMIN_PASS = env.admin; 
  const BG_IMG = env.img ? `url('${env.img}')` : 'none';
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";

  let LINKS_DATA = [];
  try { LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : []; } catch (e) { LINKS_DATA = []; }
  let FRIENDS_DATA = [];
  try { FRIENDS_DATA = env.FRIENDS ? JSON.parse(env.FRIENDS) : []; } catch (e) { FRIENDS_DATA = []; }

  const now = new Date(new Date().getTime() + 8 * 3600000);
  const currYear = now.getFullYear().toString();
  const currMonth = `${currYear}_${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  try {
    // --- 路由：管理后台 ---
    if (url.pathname === "/admin") {
      const cookie = request.headers.get('Cookie') || '';
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
      if (!cookie.includes(`${COOKIE_NAME}=true`)) {
        return new Response(renderLoginPage(TITLE), { headers: { "content-type": "text/html;charset=UTF-8" } });
      }
      if (!env.db) return new Response("错误：未检测到 D1 绑定", { status: 500 });
      const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
      return new Response(renderStatsHTML(results || [], TITLE, currYear, now.getMonth() + 1), { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // --- 路由：登出 ---
    if (url.pathname === "/admin/logout") {
      return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0` } });
    }

    // --- 路由：跳转统计 ---
    if (url.pathname.startsWith("/go/")) {
      const id = url.pathname.split("/")[2];
      const isBackup = url.pathname.split("/")[3] === "backup";
      const item = LINKS_DATA.find(l => l.id === id);
      if (item) {
        if (env.db) {
          context.waitUntil(updateStats(env.db, isBackup ? `${id}_backup` : id, item.name + (isBackup ? "(备用)" : ""), 'link', currYear, currMonth));
        }
        return Response.redirect(isBackup && item.backup_url ? item.backup_url : item.url, 302);
      }
    }

    // --- 默认：主页 ---
    const SUBTITLE = env.SUBTITLE || "资源导航";
    return new Response(renderMainHTML(TITLE, SUBTITLE, BG_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA), { headers: { "content-type": "text/html;charset=UTF-8" } });

  } catch (err) {
    return new Response(`🚨 运行崩溃：${err.message}`, { status: 500 });
  }
}

async function updateStats(db, id, name, type, y, m) {
  try {
    await db.prepare(`INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month) VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5) ON CONFLICT(id) DO UPDATE SET total_clicks = total_clicks + 1, year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, last_year = ?4, last_month = ?5, name = ?2`).bind(id, name, type, y, m).run();
  } catch (e) {}
}

function renderLoginPage(title) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>验证 - ${title}</title><style>body{background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif}.card{background:#111;padding:40px;border-radius:12px;border:1px solid #222;width:300px}h1{font-size:1.5rem;background:linear-gradient(to right,#7dd3fc,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}input{width:100%;padding:10px;margin:20px 0;background:#000;border:1px solid #333;color:#fff;box-sizing:border-box}button{width:100%;padding:10px;background:#2563eb;color:#fff;border:none;cursor:pointer}</style></head><body><div class="card"><h1>访问验证</h1><form method="POST"><input type="password" name="password" placeholder="密码..." required><button type="submit">提交</button></form></div></body></html>`;
}

function renderMainHTML(TITLE, SUBTITLE, BG_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE}</title><style>:root{--primary:#8b5cf6;--bg-color:#030712;--card-bg:rgba(255,255,255,0.12);--border:rgba(255,255,255,0.2);--blur:blur(30px)}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background-color:var(--bg-color);font-family:sans-serif;color:#fff;margin:0}.bg-layer{position:fixed;top:0;left:0;width:100%;height:100%;background-image:${BG_IMG};background-size:cover;z-index:-2}.container{width:90%;max-width:700px;display:flex;flex-direction:column;gap:15px}header{padding:20px;background:var(--card-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--border);border-radius:20px;text-align:center}.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px}.card-group{display:flex;height:70px;background:var(--card-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--border);border-radius:15px;overflow:hidden}.item-link{flex:1;display:flex;align-items:center;padding:0 15px;text-decoration:none;color:#fff}.backup-link{width:40px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);text-decoration:none;color:#fff;font-size:0.7rem;writing-mode:vertical-lr}.footer{text-align:center;margin-top:10px}.contact-btn{padding:10px 25px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:50px;color:#fff;text-decoration:none}</style></head><body><div class="bg-layer"></div><div class="container"><header><h1>${TITLE}</h1><p>${SUBTITLE}</p></header><div class="card-grid">${LINKS_DATA.map(link=>`<div class="card-group"><a href="/go/${link.id}" class="item-link"><span>${link.emoji} ${link.name}</span></a>${link.backup_url?`<a href="/go/${link.id}/backup" class="backup-link">备用</a>`:''}</div>`).join('')}</div><div class="footer"><a href="${CONTACT_URL}" class="contact-btn">联系我们</a></div></div></body></html>`;
}

function renderStatsHTML(results, title, year, month) {
  const grandTotal = results.reduce((s, r) => s + (r.total_clicks || 0), 0);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>看板 - ${title}</title><style>body{background:#030712;color:#fff;font-family:sans-serif;padding:20px}.header{display:flex;justify-content:space-between;align-items:center}.badge{background:linear-gradient(135deg,#8b5cf6,#ec4899);padding:10px;border-radius:10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-top:20px}.card{background:rgba(255,255,255,0.05);padding:15px;border-radius:10px;border:1px solid rgba(255,255,255,0.1)}</style></head><body><div class="header"><h1>📊 数据看板</h1><div class="badge">总点击: ${grandTotal}</div></div><p>${year}年${month}月 | <a href="/admin/logout" style="color:#aaa">登出</a></p><div class="grid">${results.map(r=>`<div class="card"><div>${r.name}</div><div style="font-size:1.2rem;margin:10px 0;color:#fcd34d">${r.total_clicks} 次</div><div style="font-size:0.8rem;opacity:0.6">本月: ${r.month_clicks}</div></div>`).join('')}</div></body></html>`;
}
