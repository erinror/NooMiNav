export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- 1. 配置读取 ---
    let LINKS_DATA = [];
    try { LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : []; } catch (e) {}
    let FRIENDS_DATA = [];
    try { FRIENDS_DATA = env.FRIENDS ? JSON.parse(env.FRIENDS) : []; } catch (e) {}

    const TITLE = env.TITLE || "云端加速 · 精选导航";
    const SUBTITLE = env.SUBTITLE || "优质套餐推荐 · 随时畅联";
    const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";
    const BG_IMG = env.img ? `url('${env.img}')` : 'none';

    // --- 2. 跳转逻辑 ---
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
            
            .container { width: 95%; max-width: 700px; padding: 20px 0; display: flex; flex-direction: column; gap: 18px; text-align: center; }

            header { padding: 20px; background: var(--card-bg); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: 20px; }
            header h1 { font-size: 1.6rem; background: linear-gradient(to right, #a78bfa, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800; margin-bottom: 5px; }
            header p { color: #f1f5f9; font-size: 0.85rem; opacity: 0.8; }

            .section-title { font-size: 0.85rem; color: #94a3b8; text-align: left; margin: 10px 0 2px 5px; font-weight: 600; }

            /* 双列网格 */
            .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; }
            
            /* 【核心修正】连体卡片容器 */
            .card-group { display: flex; height: 76px; position: relative; }
            
            .item-link { 
                flex: 1; display: flex; align-items: center; padding: 0 18px; 
                background: var(--card-bg); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
                border: 1px solid var(--border); border-radius: 18px; 
                text-decoration: none; color: white; transition: all 0.3s;
                z-index: 1;
            }
            /* 有备用链接时，右侧变直角并去掉边框，防止重叠变粗 */
            .has-backup .item-link { border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: none; }
            
            .item-link:hover { background: rgba(255,255,255,0.2); border-color: var(--primary); z-index: 2; }

            /* 备用按钮：左侧变直角，紧贴主按钮 */
            .backup-link { 
                display: flex; align-items: center; justify-content: center; 
                width: 44px; background: rgba(255,255,255,0.08); 
                backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
                border: 1px solid var(--border);
                border-radius: 0 18px 18px 0;
                text-decoration: none; color: #f1f5f9; font-size: 0.75rem; 
                writing-mode: vertical-lr; transition: all 0.3s; 
            }
            .backup-link:hover { background: var(--primary); color: white; border-color: var(--primary); z-index: 2; }

            .emoji { font-size: 1.3rem; margin-right: 12px; }
            .info { text-align: left; }
            .name { font-weight: 700; font-size: 0.95rem; margin-bottom: 2px; }
            .note { font-size: 0.72rem; color: #fcd34d; font-weight: 600; }

            .friends-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
            .friend-link { padding: 12px; background: rgba(255,255,255,0.08); border-radius: 12px; border: 1px solid var(--border); backdrop-filter: var(--blur); -webkit-backdrop-filter: blur(10px); text-decoration: none; color: #cbd5e1; font-size: 0.85rem; transition: 0.3s; text-align: center; }
            .friend-link:hover { background: rgba(255,255,255,0.18); color: white; border-color: var(--primary); }

            .footer { margin-top: 10px; }
            .contact-btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 10px 30px; border-radius: 50px; color: white; text-decoration: none; font-size: 0.9rem; font-weight: 600; transition: 0.3s; }
            .contact-btn:hover { transform: scale(1.05); }
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
            <div class="card-grid">
                ${LINKS_DATA.map(link => `
                    <div class="card-group ${link.backup_url ? 'has-backup' : ''}">
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

            ${FRIENDS_DATA.length > 0 ? `
            <div class="section-title">🔗 友情链接</div>
            <div class="friends-grid">
                ${FRIENDS_DATA.map(f => `<a href="${f.url}" target="_blank" class="friend-link">${f.name}</a>`).join('')}
            </div>
            ` : ''}

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
