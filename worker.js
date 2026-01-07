export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- 1. 配置读取 ---
    let LINKS_DATA = [];
    try {
      LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : [];
    } catch (e) {
      return new Response("LINKS 格式错误", { status: 500 });
    }

    const TITLE = env.TITLE || "云端加速 · 精选导航";
    const SUBTITLE = env.SUBTITLE || "优质套餐推荐 · 随时畅联";
    const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";
    const BG_IMG = env.img ? `url('${env.img}')` : 'none';

    // --- 2. 路由逻辑 (跳转统计) ---
    if (url.pathname.startsWith("/go/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts[1];
      const isBackup = parts[2] === "backup";
      const item = LINKS_DATA.find(l => l.id === id);
      if (item) {
        if (env.kv) {
          const statsKey = isBackup ? `click_${id}_backup` : `click_${id}`;
          const count = await env.kv.get(statsKey) || 0;
          await env.kv.put(statsKey, (parseInt(count) + 1).toString());
        }
        return Response.redirect(isBackup && item.backup_url ? item.backup_url : item.url, 302);
      }
    }

    // 统计页 (/stats)
    if (url.pathname === "/stats" && env.kv) {
      let statsHtml = `<html><head><meta charset="UTF-8"><title>统计</title><style>body{background:#030712;color:#fff;font-family:sans-serif;padding:40px;}</style></head><body><h1>📊 点击统计</h1><ul>`;
      for (const item of LINKS_DATA) {
        const c1 = await env.kv.get(`click_${item.id}`) || 0;
        statsHtml += `<li>${item.name}: ${c1} 次</li>`;
      }
      return new Response(statsHtml + "</ul></body></html>", { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // --- 3. 页面渲染 ---
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${TITLE}</title>
        <style>
            :root { 
                --primary: #8b5cf6; --bg-color: #030712; 
                --card-bg: rgba(255, 255, 255, 0.12); 
                --border: rgba(255, 255, 255, 0.2); 
                --blur: blur(30px) saturate(160%);
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: var(--bg-color); font-family: -apple-system, system-ui, sans-serif; color: white; overflow-x: hidden; }
            .bg-layer { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-image: ${BG_IMG}; background-size: cover; background-position: center; z-index: -2; }
            .bg-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: ${env.img ? 'rgba(0,0,0,0.4)' : 'radial-gradient(circle at 10% 10%, rgba(139,92,246,0.2) 0%, transparent 50%), radial-gradient(circle at 90% 90%, rgba(236,72,193,0.2) 0%, transparent 50%)'}; z-index: -1; }
            .container { width: 90%; max-width: 440px; padding: 40px 0; display: flex; flex-direction: column; gap: 20px; text-align: center; }
            header { padding: 30px 20px; background: var(--card-bg); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: 24px; }
            header h1 { font-size: 2rem; background: linear-gradient(to right, #a78bfa, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800; margin-bottom: 8px; }
            header p { color: #f1f5f9; font-size: 0.95rem; opacity: 0.9; }
            .section-title { font-size: 0.9rem; color: #94a3b8; text-align: left; margin: 10px 0 0 5px; font-weight: 600; letter-spacing: 1px; }
            .card-list { display: grid; gap: 14px; }
            .card-wrapper { display: flex; gap: 10px; height: 86px; }
            .item-link { flex: 1; display: flex; align-items: center; padding: 0 20px; background: var(--card-bg); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: 20px; text-decoration: none; color: white; transition: 0.3s; }
            .item-link:hover { border-color: var(--primary); transform: translateY(-3px); background: rgba(255,255,255,0.2); }
            .backup-link { display: flex; align-items: center; justify-content: center; width: 54px; background: var(--card-bg); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: 18px; text-decoration: none; color: #f1f5f9; font-size: 0.8rem; writing-mode: vertical-lr; transition: 0.3s; }
            .backup-link:hover { background: var(--primary); color: white; transform: translateY(-3px); }
            .emoji { font-size: 1.4rem; margin-right: 14px; }
            .info { text-align: left; }
            .name { font-weight: 700; font-size: 1.05rem; }
            .note { font-size: 0.75rem; color: #fcd34d; margin-top: 4px; font-weight: 600; }
            /* 友链特有样式 */
            .friend-link { padding: 15px 20px; background: rgba(255,255,255,0.06); border-radius: 16px; border: 1px solid var(--border); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); text-decoration: none; color: #cbd5e1; display: flex; align-items: center; justify-content: space-between; transition: 0.3s; }
            .friend-link:hover { background: rgba(255,255,255,0.15); color: white; border-color: var(--primary); }
            .footer { margin-top: 20px; }
            .contact-btn { display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 12px 35px; border-radius: 50px; color: white; text-decoration: none; font-size: 1rem; font-weight: 600; box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4); }
        </style>
    </head>
    <body>
        <div class="bg-layer"></div>
        <div class="bg-overlay"></div>
        <div class="container">
            <header>
                <h1>${TITLE}</h1>
                <p>${SUBTITLE}</p>
            </header>

            <div class="section-title">💎 精选套餐</div>
            <div class="card-list">
                ${LINKS_DATA.map(link => `
                    <div class="card-wrapper">
                        <a href="/go/${link.id}" class="item-link">
                            <span class="emoji">${link.emoji}</span>
                            <div class="info">
                                <div class="name">${link.name}</div>
                                <div class="note">⚠️ ${link.note}</div>
                            </div>
                        </a>
                        ${link.backup_url ? `<a href="/go/${link.id}/backup" class="backup-link">备用</a>` : ''}
                    </div>
                `).join('')}
            </div>

            <div class="section-title">🔗 友情链接</div>
            <div class="card-list">
                <a href="https://blog.009223.xyz/article/dltools" target="_blank" class="friend-link">
                    <span>代理客户端推荐</span>
                    <span>➜</span>
                </a>
            </div>

            <div class="footer">
                <a href="${CONTACT_URL}" target="_blank" class="contact-btn">💬 联系我们</a>
            </div>
        </div>
    </body>
    </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
  }
};
