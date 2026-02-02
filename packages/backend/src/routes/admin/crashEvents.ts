import { Router } from "express";
import { param, query, validationResult } from "express-validator";
import { GatrixError } from "../../middleware/errorHandler";
import { CrashEventController } from "../../controllers/CrashEventController";

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((err: any) => err.msg)
      .join(", ");
    throw new GatrixError(`Validation failed: ${errorMessages}`, 400);
  }
  next();
};

const router = Router();

/**
 * @route   GET /admin/crash-events
 * @desc    Get all crash events with pagination and filters
 * @access  Admin
 */
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("search").optional().isString(),
    query("platform").optional().isString(),
    query("environment").optional().isString(),
    query("branch").optional().isString(),
    query("marketType").optional().isString(),
    query("isEditor").optional().isBoolean(),
    query("appVersion").optional().isString(),
    query("dateFrom").optional().isISO8601(),
    query("dateTo").optional().isISO8601(),
    validateRequest,
  ],
  CrashEventController.getCrashEvents as any,
);

/**
 * @route   GET /admin/crash-events/filter-options
 * @desc    Get filter options for crash events
 * @access  Admin
 */
router.get("/filter-options", CrashEventController.getFilterOptions as any);

/**
 * @route   GET /admin/crash-events/:id
 * @desc    Get crash event by ID
 * @access  Admin
 */
router.get(
  "/:id",
  [param("id").isString(), validateRequest],
  CrashEventController.getCrashEventById as any,
);

/**
 * @route   GET /admin/crash-events/:id/log
 * @desc    Get log file content for a crash event
 * @access  Admin
 */
router.get(
  "/:id/log",
  [param("id").isString(), validateRequest],
  CrashEventController.getLogFile as any,
);

/**
 * @route   GET /admin/crash-events/:id/stack-trace
 * @desc    Get stack trace for a crash event
 * @access  Admin
 */
router.get(
  "/:id/stack-trace",
  [param("id").isString(), validateRequest],
  CrashEventController.getStackTrace as any,
);

export default router;
