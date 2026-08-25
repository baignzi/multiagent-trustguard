const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 恶意行为检测中心 Mock 服务 (Flask, :5000) — 优先匹配更长的 /api/v1 前缀
  app.use(
    createProxyMiddleware({
      pathFilter: (path) => path.startsWith('/api/v1'),
      target: 'http://localhost:5000',
      changeOrigin: true
    })
  );

  // 主后端 FastAPI 智能体注册/信任服务 (:8000) — 其余 /api 请求
  app.use(
    createProxyMiddleware({
      pathFilter: (path) => path.startsWith('/api') && !path.startsWith('/api/v1'),
      target: 'http://localhost:8000',
      changeOrigin: true
    })
  );
};
