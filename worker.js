const CONFIG = {
  links: {
    "xueshan": "https://x4.xueshan.shop/#/register?code=vh0YtHJJ",
    "gouzi": "https://gz-cloud.top/#/register?code=mXtLgkhc",
    "baipiao": "https://www.xn--9kqx21a0sv.top/#/register?code=wU5jRt3H"
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 处理 /go/ 开头的统计跳转链接
    if (url.pathname.startsWith("/go/")) {
      const id = url.pathname.split("/")[2];
      const targetUrl = CONFIG.links[id];
      if (targetUrl) {
        // 如果绑定了 KV (变量名为 STATS)，则记录点击次数
        if (env.STATS) {
          const count = await env.STATS.get(id) || 0;
          await env.STATS.put(id, parseInt(count) + 1);
        }
        return Response.redirect(targetUrl, 302);
      }
    }

    // 默认返回主页（如果 Worker 和 Pages 绑定在同一个域名）
    return fetch(request);
  }
};
