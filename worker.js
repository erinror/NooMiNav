export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- 1. 读取配置 (优先从环境变量读取) ---
    let LINKS_DATA = [];
    try {
      // 这里的 LINKS 变量需要在 CF 后台 Variables 页面配置
      LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : [];
    } catch (e) {
      return new Response("环境变量 LINKS 格式有误，请检查 JSON 内容", { status: 500 });
    }

    const TITLE = env.TITLE || "云端加速 · 精选导航";
    const SUBTITLE = env.SUBTITLE || "优质套餐推荐 · 随时畅联";
    const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";
    
    // 按照你的要求：背景图变量名为 img
    const BG_IMG = env.img ? `url('${env.img}')` : 'none';

    // --- 2. 路由分发逻辑 ---

    // A. 统计与跳转路由 (/go/:id 或 /go/:id/backup)
    if (url.pathname.startsWith("/go/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts[1];
      const isBackup = parts[2] === "backup";
      
      const item = LINKS_DATA.find(l => l.id === id);
      if (item) {
        // 按照你的要求：KV 变量名为 kv
        if (env.kv) {
          const statsKey = isBackup ? `click_${id}_backup` : `click_${id}`;
          // 异步更新统计，不阻塞跳转
          const count = await env.kv.get(statsKey) || 0;
          await env.kv.put(statsKey, parseInt(count) + 1);
        }
        return Response.redirect(isBackup && item.backup_url ? item.backup_url : item.url, 302);
      }
    }

    // B. 查看统计路由 (可选：/stats)
    if (url.pathname === "/stats" && env.kv) {
      let statsHtml = "<h1>点击统计</h1><ul>";
      for (const item of LINKS_DATA) {
        const c1 = await env.kv.get(`click_${item.id}`) || 0;
        statsHtml += `<li>${item.name}: ${c1} 次</li>`;
        if (item.backup_url) {
          const c2 = await env.kv.get(`click_${item.id}_backup`) || 0;
          statsHtml += `<li>${item.name} (备用): ${c2} 次</li>`;
        }
      }
      return new Response(statsHtml + "</ul>", { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // --- 3. 页面渲染渲染 ---
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${TITLE}</title>
        <style>
            :root { 
                --primary: #8b5cf6; 
                --bg-color: #030712; 
                --card-bg: rgba(255, 255, 255, 0.05); 
                --border: rgba(255, 255, 255, 0.1); 
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                min-height: 100vh; display: flex; align-items: center; justify-content: center; 
                background-color: var(--bg-color); 
                font-family: -apple-system, "Noto Sans SC", sans-serif; color: white; overflow-x: hidden; 
            }
            .bg-layer {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-image: ${BG_IMG};
                background-size: cover; background-position: center; z-index: -2;
            }
            .bg-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: ${env.img ? 'rgba(0,0,0,0.5)' : 
                  'radial-gradient(circle at 10% 10%, rgba(139,92,246,0.15) 0%, transparent 50%), radial-gradient(circle at 90% 90%, rgba(236,72,193,0.15) 0%, transparent 50%)'};
                z-index: -1;
                ${env.img ? '' : 'filter: blur(80px);'}
            }
            .container { width: 90%; max-width: 440px; padding: 40px 0; text-align: center; }
            header { margin-bottom: 40px; }
            header h1 { font-size: 2.2rem; background: linear-gradient(to right, #a78bfa, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800; margin-bottom: 10px; }
            header p { color: #94a3b8; font-size: 0.95rem; }
            .card-list { display: grid; gap: 18px; }
            .card-wrapper { display: flex; gap: 10px; height: 86px; }
            .item-link { flex: 1; display: flex; align-items: center; padding: 0 20px; background: var(--card-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 20px; text-decoration: none; color: white; transition: 0.3s; }
            .item-link:hover { border-color: var(--primary); transform: translateY(-3px); background: rgba(255,255,255,0.08); }
            .backup-link { display: flex; align-items: center; justify-content: center; width: 54px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 18px; text-decoration: none; color: #94a3b8; font-size: 0.8rem; writing-mode: vertical-lr; transition: 0.3s; }
            .backup-link:hover { background: var(--primary); color: white; transform: translateY(-3px); }
            .emoji-box { width: 46px; height: 46px; background: rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; margin-right: 14px; }
            .info { text-align: left; }
            .name { font-weight: 600; font-size: 1.05rem; }
            .note { font-size: 0.75rem; color: #fbbf24; margin-top: 4px; }
            .footer { margin-top: 50px; }
            .contact-btn { display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 12px 28px; border-radius: 50px; color: white; text-decoration: none; font-size: 0.9rem; font-weight: 600; }
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
            <div class="card-list">
                ${LINKS_DATA.map(link => `
                    <div class="card-wrapper">
                        <a href="/go/${link.id}" class="item-link">
                            <div class="emoji-box">${link.emoji}</div>
                            <div class="info">
                                <div class="name">${link.name}</div>
                                <div class="note">⚠️ ${link.note}</div>
                            </div>
                        </a>
                        ${link.backup_url ? `<a href="/go/${link.id}/backup" class="backup-link">备用</a>` : ''}
                    </div>
                `).join('')}
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
