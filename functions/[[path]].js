export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_session_v3_unified";

  // --- 1. 配置获取 ---
  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质资源推荐 · 随时畅联";
  const ADMIN_PASS = env.admin || "qwer1234"; 
  const BG_IMG = env.img ? `url('${env.img}')` : 'none';
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";

  let LINKS_DATA = [];
  try { LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : []; } catch (e) { LINKS_DATA = []; }
  let FRIENDS_DATA = [];
  try { FRIENDS_DATA = env.FRIENDS ? JSON.parse(env.FRIENDS) : []; } catch (e) { FRIENDS_DATA = []; }

  const now = new Date(new Date().getTime() + 8 * 3600000);
  const currYear = now.getFullYear().toString();
  const currMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const dateKey = `${currYear}_${currMonth}`;

  // 背景 HTML 片段
  const SHARED_BG = `
    <div style="position:fixed;inset:0;background:${BG_IMG} center/cover;z-index:-2;filter:brightness(0.6);transform:scale(1.05);"></div>
    <div style="position:fixed;inset:0;background:radial-gradient(circle at 50% 50%, transparent, rgba(0,0,0,0.5));z-index:-1;"></div>
  `;

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
        return new Response(renderLoginPageV4(TITLE, SHARED_BG), { headers: { "content-type": "text/html;charset=UTF-8" } });
      }

      if (!env.db) return new Response("❌ D1 未绑定", { status: 500 });
      
      const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
      const selectedMonth = url.searchParams.get('m') || dateKey;
      
      return new Response(renderStatsHTMLV4(results || [], TITLE, selectedMonth, SHARED_BG), { 
        headers: { "content-type": "text/html;charset=UTF-8" } 
      });
    }

    // 登出
    if (url.pathname === "/admin/logout") {
      return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0` } });
    }

    // --- 路由：跳转逻辑 ---
    if (url.pathname.startsWith("/go/")) {
      const id = url.pathname.split("/")[2];
      const isBackup = url.pathname.split("/")[3] === "backup";
      const item = LINKS_DATA.find(l => l.id === id);
      if (item) {
        if (env.db) {
          context.waitUntil(updateStats(env.db, isBackup ? `${id}_backup` : id, item.name + (isBackup ? "(备用)" : ""), 'link', currYear, dateKey));
        }
        return Response.redirect(isBackup && item.backup_url ? item.backup_url : item.url, 302);
      }
    }

    // --- 默认：主页 ---
    return new Response(renderMainHTMLV4(TITLE, SUBTITLE, SHARED_BG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA), { 
      headers: { "content-type": "text/html;charset=UTF-8" } 
    });

  } catch (err) {
    return new Response(`🚨 运行崩溃：${err.message}`, { status: 500 });
  }
}

async function updateStats(db, id, name, type, y, m) {
  try {
    await db.prepare(`INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month) VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5) ON CONFLICT(id) DO UPDATE SET total_clicks = total_clicks + 1, year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, last_year = ?4, last_month = ?5, name = ?2`).bind(id, name, type, y, m).run();
  } catch (e) {}
}

/** --- 界面模板 V4 (背景统一版) --- **/

function renderMainHTMLV4(TITLE, SUBTITLE, SHARED_BG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE}</title><style>
    body { margin: 0; min-height: 100vh; font-family: -apple-system, sans-serif; color: #fff; display: flex; justify-content: center; align-items: center; overflow-x: hidden; }
    .container { width: 90%; max-width: 650px; padding: 40px 0; }
    header { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(25px); padding: 30px; border-radius: 24px; text-align: center; margin-bottom: 25px; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .card-group { display: flex; height: 80px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(20px); border-radius: 20px; transition: 0.3s; overflow: hidden; }
    .card-group:hover { transform: translateY(-3px); border-color: #a78bfa; background: rgba(255,255,255,0.15); }
    .item-link { flex: 1; display: flex; align-items: center; padding: 0 20px; text-decoration: none; color: #fff; }
    .backup-link { width: 45px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: #ccc; font-size: 0.7rem; writing-mode: vertical-lr; text-decoration: none; border-left: 1px solid rgba(255,255,255,0.1); }
    .contact-btn { display: inline-block; margin-top: 30px; padding: 14px 40px; background: linear-gradient(135deg, #6366f1, #a855f7); border-radius: 50px; color: #fff; text-decoration: none; font-weight: bold; }
  </style></head><body>${SHARED_BG}<div class="container"><header><h1>${TITLE}</h1><p style="color:#ccc;">${SUBTITLE}</p></header><div class="card-grid">${LINKS_DATA.map(link=>`<div class="card-group"><a href="/go/${link.id}" class="item-link"><span style="font-size:1.5rem;margin-right:15px">${link.emoji}</span><div style="text-align:left"><div style="font-weight:700">${link.name}</div><div style="font-size:0.75rem;color:#fcd34d">⚠️ ${link.note}</div></div></a>${link.backup_url?`<a href="/go/${link.id}/backup" class="backup-link">备用</a>`:''}</div>`).join('')}</div><div style="text-align:center"><a href="${CONTACT_URL}" class="contact-btn">💬 联系我们</a></div></div></body></html>`;
}

function renderStatsHTMLV4(results, title, selectedMonth, SHARED_BG) {
  const grandTotal = results.reduce((s, r) => s + (r.total_clicks || 0), 0);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>看板 - ${title}</title><style>
    body { margin: 0; min-height: 100vh; font-family: sans-serif; color: #fff; display: flex; }
    .main { flex: 1; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .total-badge { background: linear-gradient(135deg, #f472b6, #a855f7); padding: 15px 30px; border-radius: 16px; box-shadow: 0 10px 30px rgba(168,85,247,0.3); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(20px); border-radius: 20px; padding: 20px; }
    select { background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 8px; border-radius: 8px; }
    .logout { color: #ff4d4d; text-decoration: none; font-weight: bold; }
  </style></head><body>${SHARED_BG}<div class="main">
    <div class="header"><div><h1>📊 统计概览</h1><p style="color:#ccc">周期: ${selectedMonth} | <a href="/admin/logout" class="logout">退出</a></p></div>
    <div class="total-badge"><span style="font-size:0.8rem;opacity:0.8">全站点击</span><div style="font-size:2rem;font-weight:800">${grandTotal}</div></div></div>
    <div style="margin-bottom:20px"><label>切换月份: </label><select onchange="location.href='?m='+this.value"><option value="2026_01">2026-01</option><option value="2025_12">2025-12</option></select></div>
    <div class="grid">${results.map(r=>`<div class="card"><div style="color:#a78bfa;font-size:0.8rem;font-weight:bold">#${r.type.toUpperCase()}</div><div style="font-size:1.1rem;font-weight:700;margin:10px 0">${r.name || r.id}</div><div style="display:flex;justify-content:space-between"><span>本月: <b style="color:#fcd34d">${r.month_clicks}</b></span><span>总计: <b>${r.total_clicks}</b></span></div></div>`).join('')}</div></div>
  </body></html>`;
}

function renderLoginPageV4(title, SHARED_BG) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>后台登录 - ${title}</title><style>
    body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; color: #fff; }
    .card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(25px); padding: 50px; border-radius: 24px; text-align: center; width: 320px; }
    h1 { background: linear-gradient(to right, #7dd3fc, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 30px; }
    input { width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; margin-bottom: 20px; box-sizing: border-box; }
    button { width: 100%; padding: 12px; background: #6366f1; border: none; border-radius: 12px; color: #fff; font-weight: bold; cursor: pointer; }
  </style></head><body>${SHARED_BG}<div class="card"><h1>后台验证</h1><form method="POST"><input type="password" name="password" placeholder="管理密码..." required autofocus><button type="submit">进入后台</button></form></div></body></html>`;
}
