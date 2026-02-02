import express from "express";
import { authLimiter } from "../middleware/rateLimiter";

// Import organized route modules
import clientRoutes from "./client";
import serverRoutes from "./server";
import adminRoutes from "./admin";
import { MonitoringAlertController } from "../controllers/MonitoringAlertController";
import authRoutes from "./auth";
import publicRoutes from "./public";
// chatRoutes are handled directly in app.ts before body parsing
import userRoutes from "./users";
import linkPreviewRoutes from "./linkPreview";
import mailRoutes from "./mails";
import couponRoutes from "./coupons";
import entityLockRoutes from "../controllers/EntityLockController";

const router = express.Router();

// Readiness check endpoint
router.get("/ready", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ready",
      timestamp: new Date().toISOString(),
      service: "gatrix-backend",
    },
  });
});

// Public webhook endpoint for Grafana alert notifications
router.post(
  "/monitoring/alerts",
  MonitoringAlertController.receiveAlert as any,
);

// Mount all route modules
router.use("/client", clientRoutes);
router.use("/server", serverRoutes);
router.use("/admin", adminRoutes);
router.use("/auth", authLimiter as any, authRoutes);
// chat routes are handled directly in app.ts before body parsing
router.use("/users", userRoutes);
router.use("/link-preview", linkPreviewRoutes);
router.use("/mails", mailRoutes);
router.use("/coupons", couponRoutes);
router.use("/public", publicRoutes);
router.use("/entity-locks", entityLockRoutes);

export default router;
