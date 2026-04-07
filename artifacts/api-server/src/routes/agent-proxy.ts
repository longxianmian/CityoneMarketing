import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const router = Router();

router.use(
  "/agent",
  createProxyMiddleware({
    target: "http://localhost:3100",
    changeOrigin: true,
    pathRewrite: { "^/api/agent": "/api/agent" },
    proxyTimeout: 60000,
    timeout: 60000,
  })
);

export default router;
