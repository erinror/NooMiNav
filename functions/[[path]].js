export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_session_v6_final";

  // --- 1. 配置获取 ---
  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质资源推荐 · 随时畅联";
  const ADMIN_PASS = env.admin || "123456"; 
  const BG_IMG = env.img ? `url('${env.img}')` : 'none';
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";

  let LINKS_DATA = [];
  try { LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : []; } catch (e) { LINKS_DATA = []; }
  let FRIENDS_DATA = [];
  try { FRIENDS_DATA = env.FRIENDS ? JSON.parse(env.FRIENDS) : []; } catch (e) { FRIENDS_DATA = []; }

  const now = new Date(new Date().getTime() + 8 * 3600000);
  const currYear = now.getFullYear().toString();
  const dateKey = `${currYear}_${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  // 高级背景 (亮度 0.88)
  const SHARED_BG = `
    <div style="position:fixed;inset:0;background:${BG_IMG} center/cover;z-index:-2;filter:brightness(0.88);transform:scale(1.02);"></div>
    <div style="position:fixed;inset:0;background:radial-gradient(circle at 50% 50%, transparent, rgba(0,0,0,0.15));z-index:-1;"></div>
  `;

  // 现代字体堆栈
  const FONT_STACK = `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

  try {
    if (url.pathname === "/admin") {
      const cookie = request.headers.get('Cookie') || '';
      if (request.method === 'POST') {
        const formData = await request.formData();
        if (formData.get('password') === ADMIN_PASS) {
          return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=true; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict` } });
        }
      }
      if (!cookie.includes(`${COOKIE_NAME}=true`)) return new Response(renderLoginPageV6(TITLE, SHARED_BG, FONT_STACK), { headers: { "content-type": "text/html;charset=UTF-8" } });
      const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
      return new Response(renderStatsHTMLV6(results || [], TITLE, dateKey, SHARED_BG, FONT_STACK), { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    if (url.pathname === "/admin/logout") return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0` } });

    if (url.pathname.startsWith("/go/")) {
      const id = url.pathname.split("/")[2];
      const isBackup = url.pathname.split("/")[3] === "backup";
      const item = LINKS_DATA.find(l => l.id === id);
      if (item) {
        if (env.db) context.waitUntil(updateStats(env.db, isBackup ? `${id}_backup` : id, item.name + (isBackup ? "(备用)" : ""), 'link', currYear, dateKey));
        return Response.redirect(isBackup && item.backup_url ? item.backup_url : item.url, 302);
      }
    }

    if (url.pathname.startsWith("/fgo/")) {
      const idx = parseInt(url.pathname.split("/")[2]);
      const friend = FRIENDS_DATA[idx];
      if (friend) {
        if (env.db) context.waitUntil(updateStats(env.db, `friend_${idx}`, friend.name, 'friend', currYear, dateKey));
        return Response.redirect(friend.url, 302);
      }
    }

    return new Response(renderMainHTMLV6(TITLE, SUBTITLE, SHARED_BG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA, FONT_STACK), { headers: { "content-type": "text/html;charset=UTF-8" } });

  } catch (err) {
    return new Response(`🚨 Error: ${err.message}`, { status: 500 });
  }
}

async function updateStats(db, id, name, type, y, m) {
  try {
    await db.prepare(`INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month) VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5) ON CONFLICT(id) DO UPDATE SET total_clicks = total_clicks + 1, year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, last_year = ?4, last_month = ?5, name = ?2`).bind(id, name, type, y, m).run();
  } catch (e) {}
}

/** --- 界面模板 V6 (极致排版版) --- **/

function renderMainHTMLV6(T, S, BG, C, L, F, FS) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${T}</title><style>
    body { margin: 0; min-height: 100vh; font-family: ${FS}; color: #fff; display: flex; justify-content: center; align-items: center; letter-spacing: -0.01em; }
    .container { width: 90%; max-width: 680px; padding: 40px 0; }
    header { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(30px); padding: 40px; border-radius: 28px; text-align: center; margin-bottom: 30px; }
    h1 { margin: 0; font-size: 2.2rem; font-weight: 900; letter-spacing: -0.04em; background: linear-gradient(135deg, #fff 40%, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .section-title { font-size: 0.75rem; color: #a78bfa; margin: 25px 0 12px 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }
    .card-group { display: flex; height: 85px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); border-radius: 22px; transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .card-group:hover { transform: scale(1.02); border-color: rgba(167,139,250,0.5); background: rgba(255,255,255,0.12); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .item-link { flex: 1; display: flex; align-items: center; padding: 0 24px; text-decoration: none; color: #fff; }
    .backup-link { width: 50px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); color: #94a3b8; font-size: 0.7rem; font-weight: 700; writing-mode: vertical-lr; text-decoration: none; border-left: 1px solid rgba(255,255,255,0.1); }
    .friends-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .friend-link { padding: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; backdrop-filter: blur(10px); text-decoration: none; color: #cbd5e1; font-size: 0.85rem; text-align: center; transition: 0.3s; font-weight: 500; }
    .friend-link:hover { background: #8b5cf6; color: #fff; transform: translateY(-2px); }
    .contact-btn { display: inline-block; margin-top: 40px; padding: 16px 45px; background: linear-gradient(135deg, #6366f1, #a855f7); border-radius: 50px; color: #fff; text-decoration: none; font-weight: 800; letter-spacing: 0.05em; box-shadow: 0 8px 25px rgba(99,102,241,0.3); }
  </style></head><body>${BG}<div class="container"><header><h1>${T}</h1><p style="color:#cbd5e1; margin-top:10px; font-weight:500; letter-spacing:0.02em;">${S}</p></header>
    <div class="section-title">💎 精选资源</div><div class="card-grid">${L.map(l=>`<div class="card-group"><a href="/go/${l.id}" class="item-link"><span style="font-size:1.8rem;margin-right:18px">${l.emoji}</span><div style="text-align:left"><div style="font-weight:700;font-size:1.05rem;">${l.name}</div><div style="font-size:0.75rem;color:#fcd34d;margin-top:2px;font-weight:600;">⚠️ ${l.note}</div></div></a>${l.backup_url?`<a href="/go/${l.id}/backup" class="backup-link">备用</a>`:''}</div>`).join('')}</div>
    ${F.length>0?`<div class="section-title">🔗 合作伙伴</div><div class="friends-grid">${F.map((f,i)=>`<a href="/fgo/${i}" target="_blank" class="friend-link">${f.name}</a>`).join('')}</div>`:''}
    <div style="text-align:center"><a href="${C}" target="_blank" class="contact-btn">💬 获取支持</a></div></div></body></html>`;
}

function renderStatsHTMLV6(results, T, date, BG, FS) {
  const GT = results.reduce((s, r) => s + (r.total_clicks || 0), 0);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仪表盘 - ${T}</title><style>
    body { margin: 0; min-height: 100vh; font-family: ${FS}; color: #fff; display: flex; letter-spacing: -0.01em; }
    .main { flex: 1; padding: 50px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
    .total-card { background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 25px 45px; border-radius: 24px; box-shadow: 0 15px 40px rgba(139,92,246,0.3); text-align: center; }
    .total-val { font-size: 2.8rem; font-weight: 900; letter-spacing: -0.05em; line-height: 1; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 25px; }
    .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(30px); border-radius: 24px; padding: 28px; }
    .tag { background: #8b5cf6; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
    select { background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px 15px; border-radius: 12px; font-family: inherit; }
    .logout { color: #f87171; text-decoration: none; font-weight: 700; margin-left: 20px; font-size: 0.9rem; }
  </style></head><body>${BG}<div class="main">
    <div class="header"><div><h1 style="font-size:2.5rem;font-weight:900;margin:0;letter-spacing:-0.04em;">D1 概览</h1><p style="color:#94a3b8;font-weight:600;margin-top:8px">统计周期: ${date} <a href="/admin/logout" class="logout">安全退出</a></p></div>
    <div class="total-card"><span style="font-size:0.8rem;font-weight:800;opacity:0.9;text-transform:uppercase;letter-spacing:0.1em;">全站总点击</span><div class="total-val">${GT}</div></div></div>
    <div style="margin-bottom:35px"><label style="font-weight:700;margin-right:10px">数据筛选:</label><select onchange="location.href='?m='+this.value"><option value="${date}">当前月份</option><option value="2025_12">2025年 12月</option></select></div>
    <div class="grid">${results.map(r=>{const p=GT>0?((r.total_clicks/GT)*100).toFixed(1):0; return `
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><span class="tag">${r.type}</span><span style="font-weight:800;font-size:0.85rem;color:#a78bfa">${p}%</span></div>
        <div style="font-size:1.3rem;font-weight:800;margin:18px 0;letter-spacing:-0.02em;">${r.name || r.id}</div>
        <div style="display:flex;justify-content:space-between;font-size:0.9rem;font-weight:600;"><span>本月: <b style="color:#fcd34d">${r.month_clicks}</b></span><span>年度: <b>${r.year_clicks}</b></span></div>
        <div style="height:6px;background:rgba(0,0,0,0.3);border-radius:10px;margin:15px 0;overflow:hidden;"><div style="height:100%;background:#a78bfa;width:${p}%"></div></div>
        <div style="font-size:0.75rem;color:#94a3b8;font-weight:500">最后点击：${r.last_month}</div></div>`}).join('')}</div></div></body></html>`;
}

function renderLoginPageV6(T, BG, FS) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>后台登录</title><style>
    body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: ${FS}; color: #fff; letter-spacing: -0.01em; }
    .card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(30px); padding: 50px 40px; border-radius: 32px; text-align: center; width: 340px; box-shadow: 0 30px 60px rgba(0,0,0,0.4); }
    h1 { font-size: 2.2rem; font-weight: 900; letter-spacing: -0.05em; margin-bottom: 35px; background: linear-gradient(135deg, #7dd3fc, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    input { width: 100%; padding: 16px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); border-radius: 14px; color: #fff; font-size: 1rem; margin-bottom: 25px; box-sizing: border-box; outline: none; }
    button { width: 100%; padding: 16px; background: #6366f1; border: none; border-radius: 14px; color: #fff; font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: 0.3s; }
    button:hover { background: #4f46e5; transform: scale(1.03); box-shadow: 0 0 30px rgba(99,102,241,0.4); }
  </style></head><body>${BG}<div class="card"><h1>安全验证</h1><form method="POST"><input type="password" name="password" placeholder="请输入管理口令" required autofocus><button type="submit">立即进入</button></form></div></body></html>`;
}
