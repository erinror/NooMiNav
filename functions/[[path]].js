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

async function recordClick(db, id, name, type, y, m, timeStr) {
  try {
    // 1. 写日志
    await db.prepare("INSERT INTO logs (link_id, click_time, month_key) VALUES (?, ?, ?)").bind(id, timeStr, m).run();
    // 2. 更新统计
    await db.prepare(`INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month, last_time) VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET total_clicks = total_clicks + 1, year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, last_year = ?4, last_month = ?5, last_time = ?6, name = ?2`).bind(id, name, type, y, m, timeStr).run();
  } catch (e) { console.error(e); }
}

/** --- 界面V10 --- **/

const getHead = (t, fs, img) => `
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>${img ? `<link rel="preload" as="image" href="${img}">` : ''}
<style>
  :root { --glass: rgba(15, 23, 42, 0.45); --border: rgba(255,255,255,0.18); --text-shadow: 0 2px 4px rgba(0,0,0,0.6); }
  body { margin: 0; min-height: 100vh; font-family: ${fs}; color: #fff; display: flex; justify-content: center; align-items: center; -webkit-font-smoothing: antialiased; }
  .glass-panel { background: var(--glass); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.2); border-radius: 20px; }
  h1, h2, h3, div, span, a { text-shadow: var(--text-shadow); }
</style>`;

function renderMainHTMLV10(T, S, BG, C, L, F, FS, IMG) {
  return `<!DOCTYPE html><html><head>${getHead(T, FS, IMG)}<style>
    .container { width: 90%; max-width: 680px; padding: 40px 0; }
    header { padding: 40px; text-align: center; margin-bottom: 30px; border-radius: 24px; animation: fadeUp 0.6s ease; }
    h1 { font-size: 2.4rem; margin: 0; font-weight: 800; letter-spacing: -0.03em; background: linear-gradient(180deg, #fff, #e2e8f0); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 4px 10px rgba(0,0,0,0.3); }
    .sub { color: #e2e8f0; margin-top: 12px; font-weight: 500; font-size: 1rem; opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .card { display: flex; height: 85px; transition: 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); cursor: pointer; text-decoration: none; color: #fff; overflow: hidden; position: relative; animation: fadeUp 0.6s backwards; }
    .card:hover { transform: translateY(-4px); background: rgba(30, 41, 59, 0.7); border-color: #a78bfa; box-shadow: 0 15px 30px rgba(0,0,0,0.25); }
    .emoji { font-size: 2rem; margin: 0 20px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
    .info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .name { font-weight: 700; font-size: 1.15rem; letter-spacing: -0.01em; }
    .note { font-size: 0.75rem; color: #fcd34d; margin-top: 4px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
    .backup { width: 40px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-left: 1px solid var(--border); font-size: 0.7rem; writing-mode: vertical-lr; color: #cbd5e1; transition: 0.2s; }
    .backup:hover { background: #8b5cf6; color: #fff; }
    .f-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-top: 10px; }
    .f-item { padding: 12px; text-align: center; color: #cbd5e1; text-decoration: none; font-size: 0.9rem; transition: 0.2s; border-radius: 14px; }
    .f-item:hover { background: rgba(255,255,255,0.15); color: #fff; transform: translateY(-2px); }
    .btn { display: inline-block; padding: 14px 40px; background: #fff; color: #0f172a; border-radius: 50px; font-weight: 800; text-decoration: none; text-shadow: none; margin-top: 40px; transition: 0.3s; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
    .btn:hover { transform: scale(1.05); background: #f1f5f9; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
  </style></head><body>${BG}<div class="container"><header class="glass-panel"><h1>${T}</h1><div class="sub">${S}</div></header>
    <div style="margin: 0 0 15px 5px; font-size: 0.8rem; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; opacity:0.8">精选资源</div>
    <div class="grid">${L.map((l,i)=>`<div class="glass-panel card" style="animation-delay:${i*0.04}s"><a href="/go/${l.id}" style="display:flex;flex:1;align-items:center;text-decoration:none;color:#fff"><span class="emoji">${l.emoji}</span><div class="info"><div class="name">${l.name}</div><div class="note"><svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/></svg>${l.note}</div></div></a>${l.backup_url?`<a href="/go/${l.id}/backup" class="backup">备用</a>`:''}</div>`).join('')}</div>
    ${F.length>0?`<div style="margin: 30px 0 15px 5px; font-size: 0.8rem; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; opacity:0.8">合作伙伴</div><div class="f-grid">${F.map(f=>`<a href="${f.url}" target="_blank" class="glass-panel f-item">${f.name}</a>`).join('')}</div>`:''}
    <div style="text-align:center"><a href="${C}" class="btn">💬 联系支持</a></div></div></body></html>`;
}

// 后台统计页面
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
    .drawer { position: fixed; top: 0; right: -420px; width: 380px; height: 100vh; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(30px); border-left: 1px solid var(--border); transition: 0.4s cubic-bezier(0.19, 1, 0.22, 1); z-index: 99; display: flex; flex-direction: column; }
    .drawer.open { right: 0; box-shadow: -20px 0 50px rgba(0,0,0,0.5); }
    .d-head { padding: 25px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); }
    .d-list { flex: 1; overflow-y: auto; padding: 0; margin: 0; list-style: none; }
    .d-item { padding: 15px 25px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1; }
    .d-item:hover { background: rgba(255,255,255,0.05); }
    .time-tag { font-family: monospace; color: #a78bfa; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 90; opacity: 0; pointer-events: none; transition: 0.3s; }
    .overlay.show { opacity: 1; pointer-events: auto; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
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
    </div>`}).join('')}</div></div>
  <div class="overlay" id="mask" onclick="closeDrawer()"></div>
  <div class="drawer" id="drawer"><div class="d-head"><h3 style="margin:0;font-size:1.1rem">详细记录</h3><button onclick="closeDrawer()" style="background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer">×</button></div><ul class="d-list" id="d-list"><li style="padding:25px;text-align:center;color:#94a3b8">加载中...</li></ul></div>
  <script>
    async function openLog(id,m,n){document.getElementById('drawer').classList.add('open');document.getElementById('mask').classList.add('show');document.querySelector('.d-head h3').innerText=n;const l=document.getElementById('d-list');l.innerHTML='<li style="padding:25px;text-align:center">📡 查询云端数据...</li>';try{const r=await fetch(\`/admin/api/logs?id=\${id}&m=\${m}\`);const d=await r.json();l.innerHTML=d.length?d.map((x,i)=>\`<li class="d-item"><span>#\${i+1}</span><span class="time-tag">\${x.click_time}</span></li>\`).join(''):'<li style="padding:25px;text-align:center;opacity:0.5">本月暂无点击</li>';}catch(e){l.innerHTML='<li style="padding:25px;text-align:center;color:#f87171">查询失败</li>';}}
    function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('mask').classList.remove('show');}
  </script></body></html>`;
}
