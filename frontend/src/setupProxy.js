const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Express 的 app.use('/api', mw) 会 strip /api 前缀，导致后端收到 /tree 而不是 /api/tree。
  // 使用 pathFilter 让 http-proxy-middleware 自行匹配，保留完整路径。
  app.use(
    createProxyMiddleware({
      pathFilter: '/api',
      target: 'http://localhost:8000',
      changeOrigin: true
    })
  );
};
