import express from "express";
import { PlatformDefaultsController } from "../../controllers/PlatformDefaultsController";

const router = express.Router();

// GET /api/v1/admin/platform-defaults - Get all platform defaults
router.get("/", PlatformDefaultsController.getAllDefaults);

// GET /api/v1/admin/platform-defaults/:platform - Get platform defaults for a specific platform
router.get("/:platform", PlatformDefaultsController.getPlatformDefaults);

// PUT /api/v1/admin/platform-defaults/:platform - Set platform defaults for a specific platform
router.put("/:platform", PlatformDefaultsController.setPlatformDefaults);

// PUT /api/v1/admin/platform-defaults - Set all platform defaults
router.put("/", PlatformDefaultsController.setAllDefaults);

// DELETE /api/v1/admin/platform-defaults/:platform - Delete platform defaults for a specific platform
router.delete("/:platform", PlatformDefaultsController.deletePlatformDefaults);

export default router;
