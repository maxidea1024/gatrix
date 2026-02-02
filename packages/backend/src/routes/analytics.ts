import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import logger from "../config/logger";

const router = express.Router();

// Event Lens 서버 URL
const EVENT_LENS_URL = process.env.EVENT_LENS_URL || "http://localhost:5200";

// Event Lens Proxy
router.use(
  "/",
  createProxyMiddleware({
    target: EVENT_LENS_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/v1/analytics": "", // /api/v1/analytics/* -> /*
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        logger.debug("Proxying to Event Lens", {
          method: (req as any).method,
          path: (req as any).path,
          target: EVENT_LENS_URL,
        });
      },
      proxyRes: (proxyRes, req, res) => {
        logger.debug("Event Lens response", {
          statusCode: proxyRes.statusCode,
          path: (req as any).path,
        });
      },
      error: (err, req, res) => {
        logger.error("Event Lens proxy error", {
          error: (err as Error).message,
          path: (req as any).path,
        });

        if ("status" in res && typeof res.status === "function") {
          res.status(502).json({
            error: "Bad Gateway",
            message: "Event Lens service is unavailable",
          });
        }
      },
    },
  }),
);

export default router;
