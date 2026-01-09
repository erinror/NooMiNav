export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_session_v10_final";

  // --- 1. 配置区域 ---
  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质资源推荐 · 随时畅联";
  const ADMIN_PASS = env.admin || "123456";  
  const RAW_IMG = env.img || ""; 
  const BG_CSS = RAW_IMG ? `url('${RAW_IMG}')` : 'none';
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";

  const getJson = (k) => { try { return env[k] ? JSON.parse(env[k]) : []; } catch(e) { return []; } };
  const LINKS_DATA = getJson('LINKS');
  const FRIENDS_DATA = getJson('FRIENDS');

  // 时间 (UTC+8)
  const getNow = () => new Date(new Date().getTime() + 8 * 3600000);
  const now = getNow();
  const currYear = now.getFullYear().toString();
  const currMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const dateKey = `${currYear}_${currMonth}`;
  const fullTimeStr = now.toISOString().replace('T', ' ').substring(0, 19);

  // 背景逻辑
  const SHARED_BG_HTML = `
    <div style="position:fixed;inset:0;background:#1e293b;z-index:-3;"></div>
    <div class="bg-img" style="position:fixed;inset:0;background:${BG_CSS} center/cover;z-index:-2;opacity:0;transition:opacity 0.5s ease-in;"></div>
    <div style="position:fixed;inset:0;background:radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.3));pointer-events:none;z-index:-1;"></div>
    <script>
      const img = new Image();
      img.src = "${RAW_IMG}";
      img.onload = () => { document.querySelector('.bg-img').style.opacity = 1; };
    </script>
  `;

  const FONT_STACK = `'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

  try {
    // API 查询
    if (url.pathname === "/admin/api/logs") {
      const id = url.searchParams.get('id');
      const m = url.searchParams.get('m') || dateKey;
      if (!env.db) return new Response("{}", {status: 500});
      
      // 优化查询：按时间倒序
      const { results } = await env.db.prepare("SELECT click_time FROM logs WHERE link_id = ? AND month_key = ? ORDER BY id DESC LIMIT 50").bind(id, m).all();
      return new Response(JSON.stringify(results || []), { headers: { "content-type": "application/json" } });
    }

    // 后台管理
    if (url.pathname === "/admin") {
      const cookie = request.headers.get('Cookie') || '';
      if (request.method === 'POST') {
        const formData = await request.formData();
        if (formData.get('password') === ADMIN_PASS) {
          return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=true; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict` } });
        }
      }
      if (!cookie.includes(`${COOKIE_NAME}=true`)) return new Response(renderLoginPageV10(TITLE, SHARED_BG_HTML, FONT_STACK, RAW_IMG), { headers: { "content-type": "text/html;charset=UTF-8" } });

      const selectedMonth = url.searchParams.get('m') || dateKey;
      const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
      return new Response(renderStatsHTMLV10(results || [], TITLE, selectedMonth, SHARED_BG_HTML, FONT_STACK, RAW_IMG), { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // 退出登录
    if (url.pathname === "/admin/logout") return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0` } });

    // 跳转逻辑
    if (url.pathname.startsWith("/go/")) {
      const id = url.pathname.split("/")[2];
      const isBackup = url.pathname.split("/")[3] === "backup";
      const item = LINKS_DATA.find(l => l.id === id);
      if (item) {
        if (env.db) context.waitUntil(recordClick(env.db, isBackup ? `${id}_backup` : id, item.name + (isBackup ? "(备用)" : ""), 'link', currYear, dateKey, fullTimeStr));
        return Response.redirect(isBackup && item.backup_url ? item.backup_url : item.url, 302);
      }
    }

    if (url.pathname.startsWith("/fgo/")) {
      const idx = parseInt(url.pathname.split("/")[2]);
      const friend = FRIENDS_DATA[idx];
      if (friend) {
        if (env.db) context.waitUntil(recordClick(env.db, `friend_${idx}`, friend.name, 'friend', currYear, dateKey, fullTimeStr));
        return Response.redirect(friend.url, 302);
      }
    }

    // 主页
    return new Response(renderMainHTMLV10(TITLE, SUBTITLE, SHARED_BG_HTML, CONTACT_URL, LINKS_DATA, FRIENDS_DATA, FONT_STACK, RAW_IMG), { headers: { "content-type": "text/html;charset=UTF-8" } });

  } catch (err) {
    return new Response(`🚨 Error: ${err.message}`, { status: 500 });
  }
}

// 登录页面的渲染函数
function renderLoginPageV10(T, BG, FS, IMG) {
  return `<!DOCTYPE html><html><head>${getHead(T, FS, IMG)}<style>.login-box { padding: 50px; text-align: center; width: 320px; } input { width: 100%; padding: 15px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; margin-bottom: 20px; outline: none; transition: 0.3s; } input:focus { border-color: #a78bfa; background: rgba(0,0,0,0.4); } button { width: 100%; padding: 15px; background: #fff; color: #000; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; transition: 0.3s; } button:hover { transform: scale(1.03); }</style></head><body>${BG}<div class="glass-panel login-box"><h1>${T}</h1><form method="POST"><input type="password" name="password" placeholder="输入口令..." required autofocus><button type="submit">进入后台</button></form></div></body></html>`;
}

async function recordClick(db, id, name, type, y, m, timeStr) {
  try {
    // 1. 写日志
    await db.prepare("INSERT INTO logs (link_id, click_time, month_key) VALUES (?, ?, ?)").bind(id, timeStr, m).run();
    // 2. 更新统计
    await db.prepare(`INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month, last_time) VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET total_clicks = total_clicks + 1, year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, last_year = ?4, last_month = ?5, last_time = ?6, name = ?2`).bind(id, name, type, y, m, timeStr).run();
  } catch (e) { console.error(e); }
}

// 后台统计页面的渲染函数
function renderStatsHTMLV10(results, T, m, BG, FS, IMG) {
  const total = results.reduce((s, r) => s + (r.total_clicks || 0), 0);
  return `<!DOCTYPE html><html><head>${getHead(T, FS, IMG)}<style>
    .main { width: 90%; max-width: 1000px; padding: 40px 0; }
    .header { padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    h1 { font-size: 1.8rem; margin: 0; font-weight: 800; }
    .badge { background: #fff; color: #0f172a; padding: 10px 25px; border-radius: 16px; font-weight: 800; text-shadow: none; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .card { padding: 25px; transition: 0.3s; position: relative; cursor: pointer; animation: fadeUp 0.5s backwards; }
    .card:hover { transform: translateY(-3px); border-color: #a78bfa; background: rgba(30, 41, 59, 0.7); }
    .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .title { font-size: 1.2rem; font-weight: 700; }
    .data { font-family: 'SF Mono', Menlo, monospace; font-size: 0.9rem; color: #e2e8f0; }
    .bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin: 15px 0; }
    .fill { height: 100%; background: #a78bfa; border-radius: 3px; }
    .time { font-size: 0.75rem; color: #94a3b8; text-align: right; font-family: monospace; opacity: 0.8; }
  </style></head><body>${BG}<div class="main"><header class="glass-panel header">
    <div><h1>数据中心</h1><div style="font-size:0.9rem;opacity:0.8;margin-top:5px">周期: ${m}</div></div>
    <div style="text-align:right"><div class="badge">总计 ${total} 次</div><a href="/admin/logout" style="display:block;margin-top:10px;color:#f87171;font-size:0.8rem;text-decoration:none;font-weight:700">安全退出</a></div>
  </header>
  <div class="grid">${results.map((r,i)=>{const p=total>0?((r.total_clicks/total)*100).toFixed(1):0; return `
    <div class="glass-panel card" onclick="openLog('${r.id}','${m}','${r.name||r.id}')" style="animation-delay:${i*0.03}s">
      <div class="row"><span style="font-size:0.75rem;font-weight:800;color:#cbd5e1;text-transform:uppercase">#${r.type}</span><span style="font-weight:700;color:#a78bfa">${p}%</span></div>
      <div class="title">${r.name||r.id}</div>
      <div class="data"><span>本月 <b style="color:#fff">${r.month_clicks}</b></span><span>年度 <b>${r.year_clicks}</b></span></div>
      <div class="bar"><div class="fill" style="width:${p}%"></div></div>
      <div class="time">🕒 ${r.last_time || '待记录'}</div>
    </div>`}).join('')}</div></div></body></html>`;
}
