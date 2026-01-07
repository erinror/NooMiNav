# 🚀 极简云端服务导航页

一个基于 Cloudflare Pages/Workers 部署的轻量级、高颜值的单页导航站。专为机场套餐推荐、个人联系方式展示设计。

## ✨ 特性
- 🎨 **极简美学**：采用暗黑模式、毛玻璃特效（Glassmorphism）和动态渐变背景。
- 📱 **响应式设计**：完美适配手机、平板及电脑端。
- ⚡ **极速加载**：无第三方库依赖，纯 HTML/CSS 渲染，毫秒级响应。
- 🛠️ **易于维护**：通过修改 HTML 中的配置项即可快速更换链接。

## 🚀 部署方式

### 方式 A：Cloudflare Pages (推荐)
1. 将本项目 Fork 到你的 GitHub 仓库。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
3. 进入 `Workers & Pages` -> `Create application` -> `Pages` -> `Connect to Git`。
4. 选择此仓库并点击部署即可。

### 方式 B：Cloudflare Worker
1. 复制 `worker.js` (或 `index.html` 中的代码) 到 Worker 编辑器。
2. 保存并部署。

## ⚙️ 如何修改链接
打开 `index.html`，找到以下代码块进行修改：
```html
<div class="card-list">
    <a href="你的链接" target="_blank" class="item-link">
        ...
    </a>
</div>
