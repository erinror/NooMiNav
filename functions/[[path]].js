export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_admin_session";

  // --- 1. 安全解析环境变量 ---
  const getEnvJSON = (key) => {
    try {
      return env[key] ? JSON.parse(env[key]) : [];
    } catch (e) {
      console.error(`JSON Parse Error for ${key}:`, e);
      return [];
    }
  };

  const LINKS_DATA = getEnvJSON('LINKS');
  const FRIENDS_DATA = getEnvJSON('FRIENDS');
  const TITLE = env.TITLE || "我的导航站";
  const ADMIN_PASS = env.admin;
  const BG_IMG = env.img ? `url('${env.img}')` : 'none';

  const now = new Date(new Date().getTime() + 8 * 3600000);
  const currYear = now.getFullYear().toString();
  const currMonth = `${currYear}_${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  try {
    // --- 路由：后台管理 ---
    if (url.pathname === "/admin") {
      if (!ADMIN_PASS) return new Response("❌ 错误：未设置 admin 变量", { status: 500 });
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

      // 数据库查询保护
      if (!env.db) return new Response("❌ D1 绑定丢失，请检查环境变量和绑定名称是否为 db", { status: 500 });
      
      try {
        const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
        return new Response(renderStatsHTML(results || [], TITLE, currYear, now.getMonth() + 1), { 
          headers: { "content-type": "text/html;charset=UTF-8" } 
        });
      } catch (dbErr) {
        return new Response(`❌ 数据库读取崩溃: ${dbErr.message}`, { status: 500 });
      }
    }

    // --- 路由：跳转逻辑 (加入重定向保护) ---
    if (url.pathname.startsWith("/go/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts[1];
      const isBackup = parts[2] === "backup";
      const item = LINKS_DATA.find(l => l.id === id);
      
      if (item) {
        const target = (isBackup && item.backup_url) ? item.backup_url : item.url;
        // 使用 try-catch 包裹统计，确保即使数据库挂了也能跳转
        if (env.db) {
          context.waitUntil(
            updateStats(env.db, isBackup ? `${id}_backup` : id, item.name + (isBackup ? "(备用)" : ""), 'link', currYear, currMonth)
            .catch(e => console.error("Stats update failed", e))
          );
        }
        return Response.redirect(target, 302);
      }
    }

    // 默认返回主页
    return new Response(renderMainHTML(TITLE, env, BG_IMG, LINKS_DATA, FRIENDS_DATA), { 
      headers: { "content-type": "text/html;charset=UTF-8" } 
    });

  } catch (err) {
    return new Response(`🚨 全局运行崩溃: ${err.message}\n${err.stack}`, { status: 500 });
  }
}

async function updateStats(db, id, name, type, y, m) {
  // 严格检查 db 对象
  if (!db || typeof db.prepare !== 'function') return;
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

// 渲染函数保持逻辑，这里仅展示主页的部分修正防止 undefined 崩溃
function renderMainHTML(TITLE, env, BG_IMG, LINKS_DATA, FRIENDS_DATA) {
  const SUBTITLE = env.SUBTITLE || "资源导航";
  const CONTACT_URL = env.CONTACT_URL || "#";
  return `<!DOCTYPE html>...主页代码...`; // 请使用之前提供的完整 HTML 模板
}

// ... 其它 renderLoginPage 和 renderStatsHTML 函数 ...

/** --- HTML 模板 --- **/
function renderLoginPage(title) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>验证 - ${title}</title><style>body{background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{background:#111;border:1px solid #222;padding:40px;border-radius:12px;width:90%;max-width:380px;text-align:left}h1{font-size:2rem;background:linear-gradient(to right,#7dd3fc,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px}input{width:100%;padding:15px;border-radius:8px;border:2px solid #333;background:#000;color:#fff;font-size:1.1rem;margin-bottom:20px;box-sizing:border-box}button{width:100%;padding:15px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}</style></head><body><div class="card"><h1>访问验证</h1><p style="color:#94a3b8;margin-bottom:20px">请输入后台密码</p><form method="POST"><input type="password" name="password" placeholder="密码..." required autofocus><button type="submit">提交</button></form></div></body></html>`;
}

function renderMainHTML(TITLE, SUBTITLE, BG_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE}</title><style>:root{--primary:#8b5cf6;--bg-color:#030712;--card-bg:rgba(255,255,255,0.12);--border:rgba(255,255,255,0.2);--blur:blur(30px)}*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background-color:var(--bg-color);font-family:sans-serif;color:#fff;overflow-x:hidden}.bg-layer{position:fixed;top:0;left:0;width:100%;height:100%;background-image:${BG_IMG};background-size:cover;background-position:center;z-index:-2}.bg-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:-1}.container{width:95%;max-width:700px;display:flex;flex-direction:column;gap:18px}header{padding:20px;background:var(--card-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--border);border-radius:20px;text-align:center}header h1{font-size:1.6rem;background:linear-gradient(to right,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}header p{color:#ccc;font-size:0.85rem}.section-title{font-size:0.85rem;color:#94a3b8;text-align:left;margin-left:5px}.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:15px}.card-group{display:flex;height:76px}.item-link{flex:1;display:flex;align-items:center;padding:0 18px;background:var(--card-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--border);border-radius:18px;text-decoration:none;color:#fff;transition:.3s}.has-backup .item-link{border-top-right-radius:0;border-bottom-right-radius:0;border-right:none}.backup-link{display:flex;align-items:center;justify-content:center;width:44px;background:rgba(255,255,255,.08);backdrop-filter:var(--blur);border:1px solid var(--border);border-radius:0 18px 18px 0;text-decoration:none;color:#fff;font-size:.75rem;writing-mode:vertical-lr}.emoji{font-size:1.3rem;margin-right:12px}.name{font-weight:700;font-size:.95rem}.note{font-size:.72rem;color:#fcd34d}.friends-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.friend-link{padding:12px;background:rgba(255,255,255,.08);border-radius:12px;border:1px solid var(--border);backdrop-filter:var(--blur);text-decoration:none;color:#cbd5e1;font-size:.85rem;text-align:center}.footer{text-align:center;margin-top:10px}.contact-btn{display:inline-flex;padding:10px 30px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:50px;color:#fff;text-decoration:none;font-weight:700}</style></head><body><div class="bg-layer"></div><div class="bg-overlay"></div><div class="container"><header><h1>${TITLE}</h1><p>${SUBTITLE}</p></header><div class="section-title">💎 套餐</div><div class="card-grid">${LINKS_DATA.map(link=>`<div class="card-group ${link.backup_url?'has-backup':''}"><a href="/go/${link.id}" class="item-link"><span class="emoji">${link.emoji}</span><div><div class="name">${link.name}</div><div class="note">${link.note}</div></div></a>${link.backup_url?`<a href="/go/${link.id}/backup" class="backup-link">备用</a>`:''}</div>`).join('')}</div>${FRIENDS_DATA.length>0?`<div class="section-title">🔗 友链</div><div class="friends-grid">${FRIENDS_DATA.map((f,i)=>`<a href="/fgo/${i}" target="_blank" class="friend-link">${f.name}</a>`).join('')}</div>`:''}<div class="footer"><a href="${CONTACT_URL}" class="contact-btn">联系我们</a></div></div></body></html>`;
}

function renderStatsHTML(results, title, year, month) {
  const grandTotal = results.reduce((s, r) => s + (r.total_clicks || 0), 0);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仪表盘 - ${title}</title><style>body{background:#030712;color:#fff;font-family:sans-serif;padding:20px;display:flex;justify-content:center}.dashboard{width:100%;max-width:800px}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}.total-badge{background:linear-gradient(135deg,#8b5cf6,#ec4899);padding:10px 20px;border-radius:12px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}.card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;backdrop-filter:blur(10px)}.tag{padding:2px 6px;border-radius:4px;font-size:.7rem;font-weight:700;background:rgba(139,92,246,0.2);color:#a78bfa}.val{color:#fcd34d;font-weight:700}.progress-bg{height:6px;background:rgba(255,255,255,0.1);border-radius:3px;margin:10px 0;overflow:hidden}.progress-bar{height:100%;background:#8b5cf6}</style></head><body><div class="dashboard"><div class="header"><h1>📊 数据看板</h1><div class="total-badge">总点击: ${grandTotal}</div></div><p style="margin-bottom:20px;opacity:.7">统计周期: ${year} / ${month} | <a href="/admin/logout" style="color:#aaa">登出</a></p><div class="grid">${results.length===0?'<p>暂无点击数据</p>':results.map(r=>{const p=grandTotal>0?(r.total_clicks/grandTotal*100).toFixed(1):0;return `<div class="card"><div style="display:flex;justify-content:space-between"><span class="tag">${r.type}</span><span>占 ${p}%</span></div><div style="font-weight:700;margin:10px 0">${r.name||r.id}</div><div style="font-size:0.85rem">本月: <span class="val">${r.month_clicks}</span> | 总计: <span class="val">${r.total_clicks}</span></div><div class="progress-bg"><div class="progress-bar" style="width:${p}%"></div></div><div style="font-size:0.75rem;color:#64748b">今年累计: ${r.year_clicks}</div></div>`}).join('')}</div></div></body></html>`;
}
