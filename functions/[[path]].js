export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_session_v10_final";

  // --- 1. 配置区域 ---
  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质资源推荐 · 随时畅联";
  const ADMIN_PASS = env.admin || "qwer1234"; 
  const RAW_IMG = env.img || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073"; // 默认给了一张图，防止没配置时太丑
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

  // 后台/通用背景逻辑 (仅后台使用旧版背景逻辑，前台用新CSS)
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
    // API
    if (url.pathname === "/admin/api/logs") {
      const id = url.searchParams.get('id');
      const m = url.searchParams.get('m') || dateKey;
      if (!env.db) return new Response("{}", {status: 500});
      // 优化查询：按时间倒序
      const { results } = await env.db.prepare("SELECT click_time FROM logs WHERE link_id = ? AND month_key = ? ORDER BY id DESC LIMIT 50").bind(id, m).all();
      return new Response(JSON.stringify(results || []), { headers: { "content-type": "application/json" } });
    }

    // 后台管理 (保持原有逻辑不变)
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

    if (url.pathname === "/admin/logout") return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0` } });

    // 跳转逻辑 (保持不变，用于统计)
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

    // --- 主页渲染 (已替换为新UI) ---
    return new Response(renderNewNavHTML(TITLE, SUBTITLE, RAW_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA), { headers: { "content-type": "text/html;charset=UTF-8" } });

  } catch (err) {
    return new Response(`🚨 Error: ${err.message}`, { status: 500 });
  }
}

async function recordClick(db, id, name, type, y, m, timeStr) {
  try {
    await db.prepare("INSERT INTO logs (link_id, click_time, month_key) VALUES (?, ?, ?)").bind(id, timeStr, m).run();
    await db.prepare(`INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month, last_time) VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET total_clicks = total_clicks + 1, year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, last_year = ?4, last_month = ?5, last_time = ?6, name = ?2`).bind(id, name, type, y, m, timeStr).run();
  } catch (e) { console.error(e); }
}

/** * ✨ 全新 NAV 界面渲染函数
 * 完全替换了旧版 renderMainHTMLV10
 */
function renderNewNavHTML(TITLE, SUBTITLE, BG_IMG_URL, CONTACT, LINKS, FRIENDS) {
  // 生成资源卡片 HTML
  const cardsHtml = LINKS.map(item => {
    // 主链接
    const mainUrl = `/go/${item.id}`;
    // 备用链接 (如果有)
    const backupHtml = item.backup_url 
      ? `<a href="/go/${item.id}/backup" class="tag-backup" title="点击跳转备用线路">备用</a>` 
      : '';
    
    return `
    <div class="glass-card resource-card-wrap">
        <a href="${mainUrl}" class="resource-main-link">
            <div class="card-icon">${item.emoji}</div>
            <div class="card-info">
                <h3>${item.name}</h3>
                <p>
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="margin-right:4px"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/></svg>
                    ${item.note}
                </p>
            </div>
        </a>
        ${backupHtml}
    </div>
    `;
  }).join('');

  // 生成友链 HTML
  const friendsHtml = FRIENDS.map((f, i) => 
    `<a href="/fgo/${i}" target="_blank" class="glass-card partner-card">${f.name}</a>`
  ).join('');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${TITLE}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #ffffff;
            background: url('${BG_IMG_URL}') no-repeat center center fixed;
            background-size: cover;
            min-height: 100vh;
            display: flex; flex-direction: column; align-items: center;
            padding: 40px 20px 100px;
        }
        body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); z-index: -1; }
        
        .container { width: 100%; max-width: 800px; margin: 0 auto; }
        
        /* 玻璃拟态基础类 */
        .glass-card {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
            transition: transform 0.2s, background 0.2s;
        }

        /* 头部 */
        .header { text-align: center; padding: 40px 20px; margin-bottom: 30px; }
        .header h1 { font-size: 3rem; font-weight: 800; letter-spacing: 2px; text-shadow: 0 4px 15px rgba(0,0,0,0.3); margin-bottom: 10px; }
        .header p { font-size: 1.1rem; opacity: 0.9; font-weight: 400; letter-spacing: 1px; }

        /* 分区标题 */
        .section-title { font-size: 1rem; font-weight: 700; color: #7dd3fc; margin-bottom: 15px; margin-left: 5px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 1px; }

        /* 资源网格 */
        .grid-resources { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-bottom: 40px; }
        
        /* 单个资源卡片容器 */
        .resource-card-wrap {
            display: flex; position: relative; overflow: hidden;
            padding: 0; /* 内部布局自己控制padding */
        }
        .resource-card-wrap:hover { background: rgba(255, 255, 255, 0.25); transform: translateY(-3px); }

        /* 卡片主体点击区域 */
        .resource-main-link {
            flex: 1; display: flex; align-items: center; text-decoration: none; color: white; padding: 20px;
        }
        .card-icon { font-size: 2.5rem; margin-right: 15px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
        .card-info h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 4px; }
        .card-info p { font-size: 0.85rem; color: #fcd34d; font-weight: 500; display: flex; align-items: center; gap: 4px; }

        /* 备用标签 */
        .tag-backup {
            width: 36px;
            background: rgba(0, 0, 0, 0.2);
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            display: flex; align-items: center; justify-content: center;
            font-size: 0.75rem; color: #e2e8f0;
            writing-mode: vertical-rl; letter-spacing: 2px;
            text-decoration: none; transition: 0.2s;
            cursor: pointer;
        }
        .tag-backup:hover { background: #8b5cf6; color: white; }

        /* 合作伙伴网格 */
        .grid-partners { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 40px; }
        .partner-card { text-decoration: none; color: rgba(255, 255, 255, 0.9); text-align: center; padding: 15px 10px; font-size: 0.9rem; border-radius: 12px; }
        .partner-card:hover { background: rgba(255, 255, 255, 0.25); transform: translateY(-2px); color: #fff; }

        /* 底部悬浮按钮 */
        .fab-support {
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #8b5cf6, #a855f7); color: white;
            padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: bold;
            box-shadow: 0 10px 25px rgba(139, 92, 246, 0.5); display: flex; align-items: center; gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s; z-index: 100;
        }
        .fab-support:hover { transform: translateX(-50%) scale(1.05); box-shadow: 0 15px 35px rgba(139, 92, 246, 0.6); }

        @media (max-width: 600px) {
            .header h1 { font-size: 2.5rem; }
            .grid-resources { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header glass-card">
            <h1>${TITLE}</h1>
            <p>${SUBTITLE}</p>
        </div>

        <div class="section-title">💎 精选资源</div>
        <div class="grid-resources">
            ${cardsHtml}
        </div>

        <div class="section-title">🔗 合作伙伴</div>
        <div class="grid-partners">
            ${friendsHtml}
        </div>
    </div>

    <a href="${CONTACT}" class="fab-support">
        💬 获取支持
    </a>
</body>
</html>
  `;
}

// --- 下面是后台和登录页的渲染函数，保持原样即可 (为了节省字数，这里引用你原来的函数名) ---

const getHead = (t, fs, img) => `
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>${img ? `<link rel="preload" as="image" href="${img}">` : ''}
<style>
  :root { --glass: rgba(15, 23, 42, 0.45); --border: rgba(255,255,255,0.18); --text-shadow: 0 2px 4px rgba(0,0,0,0.6); }
  body { margin: 0; min-height: 100vh; font-family: ${fs}; color: #fff; display: flex; justify-content: center; align-items: center; -webkit-font-smoothing: antialiased; }
  .glass-panel { background: var(--glass); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.2); border-radius: 20px; }
  h1, h2, h3, div, span, a { text-shadow: var(--text-shadow); } 
</style>`;

function renderStatsHTMLV10(results, T, m, BG, FS, IMG) {
  // ... 这里是你原来的统计页代码，我没改动，为了代码简洁我直接省略了内部细节 ...
  // 如果你复制时发现这部分缺失，请保留你原始代码中 renderStatsHTMLV10 函数的完整内容
  // 为了方便，我下面直接贴出简化的完整版，确保你能直接运行
  
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

function renderLoginPageV10(T, BG, FS, IMG) {
  return `<!DOCTYPE html><html><head>${getHead(T, FS, IMG)}<style>.login-box { padding: 50px; text-align: center; width: 320px; } input { width: 100%; padding: 15px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; margin-bottom: 20px; outline: none; transition: 0.3s; } input:focus { border-color: #a78bfa; background: rgba(0,0,0,0.4); } button { width: 100%; padding: 15px; background: #fff; color: #000; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; transition: 0.3s; } button:hover { transform: scale(1.03); }</style></head><body>${BG}<div class="glass-panel login-box"><h1>${T}</h1><form method="POST"><input type="password" name="password" placeholder="输入口令..." required autofocus><button type="submit">进入后台</button></form></div></body></html>`;
}
