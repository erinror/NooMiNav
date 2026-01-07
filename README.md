
---

# 🚀 FlarePortal

一个极简、美观且高颜值的云端服务导航门户。支持 **Cloudflare Pages (Functions)** 与 **Cloudflare Workers** 双模式部署。

项目采用 **数据与代码解耦** 的设计理念：你的推广链接和敏感数据存储在 Cloudflare 环境变量中，而 GitHub 仓库仅保留展示逻辑，保护隐私且防爬。

## ✨ 项目特性

* 🎨 **高级视觉**：采用毛玻璃（Glassmorphism）特效，支持自定义背景图（`img` 变量）。
* 🔗 **链接解耦**：所有导航链接通过环境变量 `LINKS` 配置，GitHub 不泄露任何内容。
* 🛡️ **备用支持**：支持为每个项目配置“备用链接”，满足高可用需求。
* 📈 **点击统计**：通过绑定 `kv` 变量，实时记录每个链接的访问频次。
* 📱 **完美适配**：全响应式设计，手机、平板、电脑端均有极佳体验。
* 📊 **统计面板**：通过访问 `/stats` 路径即可查看各链接的实时点击量。

---

## 🛠️ 环境变量配置 (关键)

在部署后，请务必在 Cloudflare 后台设置以下变量。

| 变量名 | 必填 | 示例值 | 说明 |
| --- | --- | --- | --- |
| **`LINKS`** | 是 | `[{"id":"xueshan","name":"雪山","emoji":"🏔️","note":"备注","url":"https://...","backup_url":"https://..."}]` | 链接配置 (JSON 数组) |
| **`img`** | 否 | `https://cdn.com/my-bg.jpg` | **背景图片链接** (不填则显示动态渐变) |
| **`kv`** | 否 | (绑定 KV 命名空间) | **点击统计数据库** (变量名必须为 `kv`) |
| **`TITLE`** | 否 | `FlarePortal` | 网页主标题 |
| **`SUBTITLE`** | 否 | `精选套餐推荐` | 副标题 |
| **`CONTACT_URL`** | 否 | `https://t.me/your_id` | 联系按钮跳转链接 |

### `LINKS` 变量 JSON 模板：

```json
[
  { 
    "id": "name", 
    "name": "6666", 
    "emoji": "🏔️", 
    "note": "打不开就开梯", 
    "url": "https://主链接",
    "backup_url": "https://备用链接"
  },
  { 
    "id": "name", 
    "name": "6666",
    "emoji": "🐶", 
    "note": "打不开就开梯", 
    "url": "https://链接" 
  }
]

```

---

## 🚀 部署指引

### 选项 A：Cloudflare Pages (推荐)

1. **Fork 本仓库**。
2. 在 Cloudflare Pages 中点击 `Create a project` -> `Connect to Git`。
3. 在 `Settings` -> `Environment variables` 中添加上述变量（包括绑定 KV 到 `kv`）。
4. **重新部署** 即可。

### 选项 B：Cloudflare Workers

1. 复制仓库中的 `worker.js` 代码。
2. 在 Cloudflare Worker 编辑器中粘贴并保存。
3. 在 `Settings` -> `Variables` 中添加环境变量并绑定 KV。

---

## 📈 查看统计数据

部署完成后，你可以通过访问以下路径查看统计信息：

* **主页**: `https://your-domain.com/`
* **统计页**: `https://your-domain.com/stats` (仅在绑定了 `kv` 后生效)

---

## 📂 项目结构

```text
├── functions/
│   └── [[path]].js      # Pages 核心逻辑 (接管所有路由)
├── index.html           # 静态入口 (占位文件)
├── worker.js            # Worker 版本完整代码
├── README.md            # 项目说明
└── LICENSE              # MIT 协议

```

## 📄 开源协议

本项目基于 [MIT License](https://www.google.com/search?q=LICENSE) 协议。

---

### 💡 维护建议

如果你想临时更换某个链接，只需要在 Cloudflare 仪表板修改 `LINKS` 环境变量，无需操作 GitHub。修改完成后，建议手动点击一次 **"Redeploy"** 以确保 Pages Functions 立即生效。
