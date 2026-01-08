export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_admin_session";

  // --- 1. 获取基础变量 ---
  let LINKS_DATA = [];
  try { LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : []; } catch (e) { LINKS_DATA = []; }
  let FRIENDS_DATA = [];
  try { FRIENDS_DATA = env.FRIENDS ? JSON.parse(env.FRIENDS) : []; } catch (e) { FRIENDS_DATA = []; }

  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质套餐推荐 · 随时畅联";
  const ADMIN_PASS = env.admin || "admin"; 
  const BG_IMG = env.img ? `url('${env.img}')` : 'none';
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";

  // 时间逻辑 (UTC+8)
  const now = new Date(new Date().getTime() + 8 * 3600000);
  const currYear = now.getFullYear().toString();
  const currMonth = `${currYear}_${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  // --- 2. 路由分发 ---

  // A. 退出登录
  if (url.pathname === "/admin/logout") {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly` }
    });
  }

  // B. 管理后台 (/admin)
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

    if (!env.db) return new Response("❌ 错误：D1 数据库未绑定，请检查设置。", { status: 500 });
    
    try {
      const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
      return new Response(renderStatsHTML(results, TITLE, currYear, now.getMonth() + 1), { 
        headers: { "content-type": "text/html;charset=UTF-8" } 
      });
    } catch (err) {
      return new Response("❌ 数据库查询失败：" + err.message, { status: 500 });
    }
  }

  // C. 跳转逻辑 (统计点击)
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

  // D. 默认返回主页
  return new Response(renderMainHTML(TITLE, SUBTITLE, BG_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA), { 
    headers: { "content-type": "text/html;charset=UTF-8" } 
  });
}

/** --- 功能函数 --- **/

async function updateStats(db, id, name, type, y, m) {
  if (!db) return;
  try {
    await db.prepare(`
      INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month)
      VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5)
      ON CONFLICT(id) DO UPDATE SET
        total_clicks = total_clicks + 1,
        year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END,
        month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END,
        last_year = ?4, last_month = ?5, name = ?2
    `).bind(id, name, type, y, m).run();
  } catch (e) { console.error(e); }
}

/** --- 界面模板 --- **/

function renderLoginPage(title) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>验证 - ${title}</title><style>body{background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{background:#111;border:1px solid #222;padding:40px;border-radius:12px;width:90%;max-width:380px;text-align:left;box-shadow:0 10px 30px rgba(0,0,0,0.8)}h1{font-size:2rem;background:linear-gradient(to right,#7dd3fc,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;margin-bottom:20px}input{width:100%;padding:15px;border-radius:8px;border:2px solid #333;background:#000;color:#fff;font-size:1.1rem;margin-bottom:20px;box-sizing:border-box;outline:0}button{width:100%;padding:15px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-weight:700;font-size:1.1rem;cursor:pointer}</style></head><body><div class="card"><h1>访问验证</h1><p style="color:#94a3b8;margin-bottom:20px">请输入密码继续访问</p><form method="POST"><input type="password" name="password" placeholder="密码..." required autofocus><button type="submit">提交</button></form></div></body></html>`;
}

function renderMainHTML(TITLE, SUBTITLE, BG_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE}</title><style>:root{--primary:#8b5cf6;--bg-color:#030712;--card-bg:rgba(255,255,255,0.12);--border:rgba(255,255,255,0.2);--blur:blur(30px) saturate(160%)}*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background-color:var(--bg-color);font-family:-apple-system,system-ui,sans-serif;color:#fff;overflow-x:hidden}.bg-layer{position:fixed;top:0;left:0;width:100%;height:100%;background-image:${BG_IMG};background-size:cover;background-position:center;z-index:-2}.bg-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:-1}.container{width:95%;max-width:700px;padding:20px 0;display:flex;flex-direction:column;gap:18px;text-align:center}header{padding:20px;background:var(--card-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--border);border-radius:20px}header h1{font-size:1.6rem;background:linear-gradient(to right,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800;margin-bottom:5px}header p{color:#f1f5f9;font-size:0.85rem;opacity:.8}.section-title{font-size:0.85rem;color:#94a3b8;text-align:left;margin:10px 0 2px 5px;font-weight:600;text-transform:uppercase}.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:15px}.card-group{display:flex;height:76px}.item-link{flex:1;display:flex;align-items:center;padding:0 18px;background:var(--card-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--border);border-radius:18px;text-decoration:none;color:#fff;transition:.3s;z-index:1}.has-backup .item-link{border-top-right-radius:0;border-bottom-right-radius:0;border-right:none}.item-link:hover{background:rgba(255,255,255,.2);border-color:var(--primary);z-index:2}.backup-link{display:flex;align-items:center;justify-content:center;width:44px;background:rgba(255,255,255,.08);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--border);border-radius:0 18px 18px 0;text-decoration:none;color:#f1f5f9;font-size:.75rem;writing-mode:vertical-lr;transition:.3s}.backup-link:hover{background:var(--primary);color:#fff;border-color:var(--primary);z-index:2}.emoji{font-size:1.3rem;margin-right:12px}.info{text-align:left}.name{font-weight:700;font-size:.95rem;margin-bottom:2px}.note{font-size:.72rem;color:#fcd34d;font-weight:600}.friends-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.friend-link{padding:12px;background:rgba(255,255,255,.08);border-radius:12px;border:1px solid var(--border);backdrop-filter:var(--blur);-webkit-backdrop-filter:blur(10px);text-decoration:none;color:#cbd5e1;font-size:.85rem;transition:.3s;text-align:center}.friend-link:hover{background:rgba(255,255,255,.18);color:#fff;border-color:var(--primary)}.footer{margin-top:10px}.contact-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#6366f1 0%,#a855f7 100%);padding:10px 30px;border-radius:50px;color:#fff;text-decoration:none;font-size:.9rem;font-weight:600;transition:.3s}.contact-btn:hover{transform:scale(1.05)}</style></head><body><div class="bg-layer"></div><div class="bg-overlay"></div><div class="container"><header><h1>${TITLE}</h1><p>${SUBTITLE}</p></header><div class="section-title">💎 精选套餐</div><div class="card-grid">${LINKS_DATA.map(link=>`<div class="card-group ${link.backup_url?'has-backup':''}"><a href="/go/${link.id}" class="item-link"><span class="emoji">${link.emoji}</span><div class="info"><div class="name">${link.name}</div><div class="note">⚠️ ${link.note}</div></div></a>${link.backup_url?`<a href="/go/${link.id}/backup" class="backup-link">备用</a>`:''}</div>`).join('')}</div>${FRIENDS_DATA.length>0?`<div class="section-title">🔗 友情链接</div><div class="friends-grid">${FRIENDS_DATA.map((f,idx)=>`<a href="/fgo/${idx}" target="_blank" class="friend-link">${f.name}</a>`).join('')}</div>`:''} <div class="footer"><a href="${CONTACT_URL}" target="_blank" class="contact-btn">💬 联系我们</a></div></div></body></html>`;
}

function renderStatsHTML(results, title, year, month) {
  const grandTotal = results.reduce((s, r) => s + r.total_clicks, 0);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仪表盘 - ${title}</title><style>body{background:#030712;color:#fff;font-family:sans-serif;padding:20px;display:flex;justify-content:center}.dashboard{width:100%;max-width:800px}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}.total-badge{background:linear-gradient(135deg,#8b5cf6,#ec4899);padding:10px 20px;border-radius:12px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}.card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;backdrop-filter:blur(10px)}.card-header{display:flex;justify-content:space-between;margin-bottom:15px;color:#94a3b8;font-size:.9rem}.card-title{font-size:1.1rem;font-weight:700;color:#fff}.stat-row{margin-bottom:15px}.stat-info{display:flex;justify-content:space-between;margin-bottom:5px;font-size:.85rem}.progress-bg{height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden}.progress-bar{height:100%;background:#8b5cf6;border-radius:3px;transition:1s}.tag{padding:2px 6px;border-radius:4px;font-size:.7rem;font-weight:700}.tag-link{background:rgba(139,92,246,0.2);color:#a78bfa}.tag-friend{background:rgba(16,185,129,0.2);color:#34d399}.val{color:#fcd34d;font-weight:700}a.logout{color:#94a3b8;text-decoration:none;font-size:0.8rem;}</style></head><body><div class="dashboard"><div class="header"><h1>📊 数据分析</h1><a href="/admin/logout" class="logout">登出</a><div class="total-badge">总计点击: ${grandTotal}</div></div><p style="margin-bottom:20px;opacity:.7">统计周期: ${year}年 / ${month}月</p><div class="grid">${results.map(r=>{const p=grandTotal>0?(r.total_clicks/grandTotal*100).toFixed(1):0;return `<div class="card"><div class="card-header"><span class="tag ${r.type==='link'?'tag-link':'tag-friend'}">${r.type==='link'?'套餐':'友链'}</span><span>占 ${p}%</span></div><div class="stat-row"><div class="card-title">${r.name||r.id}</div></div><div class="stat-row"><div class="stat-info"><span>本月: <span class="val">${r.month_clicks}</span></span><span>总计: <span class="val">${r.total_clicks}</span></span></div><div class="progress-bg"><div class="progress-bar" style="width:${p}%"></div></div></div><div class="stat-info" style="color:#64748b;font-size:.75rem;"><span>今年累计: ${r.year_clicks}</span><span>最后点击: ${r.last_month}</span></div></div>`}).join('')}</div></div></body></html>`;
}
