import { Router } from "express";
import { authenticate, requireAdmin } from "../../middleware/auth";
import {
  AdminInvitationController,
  createInvitationValidation,
} from "../../controllers/AdminInvitationController";
import {
  enhancedAuditLog,
  fetchInvitationById,
} from "../../utils/enhancedAuditLog";

const router = Router();

router.use(authenticate as any);
router.use(requireAdmin as any);

// POST /api/v1/admin/invitations - 사용자 초대 생성
router.post(
  "/",
  createInvitationValidation,
  enhancedAuditLog({
    action: "invitation_create",
    resourceType: "invitation",
    getResourceIdFromResponse: (responseBody) => responseBody?.invitation?.id,
    getNewValues: (req, res) => ({
      email: req.body?.email,
      role: req.body?.role || "user",
      expirationHours: req.body?.expirationHours || 168,
    }),
    getContext: (req) => ({
      operation: "create_invitation",
      targetEmail: req.body?.email || "No email (open invitation)",
      targetRole: req.body?.role || "user",
      expiresIn: `${req.body?.expirationHours || 168} hours`,
    }),
  }) as any,
  AdminInvitationController.createInvitation as any,
);

// GET /api/v1/admin/invitations/current
router.get("/current", AdminInvitationController.getCurrent as any);

// GET /api/v1/admin/invitations - 초대 목록 조회
router.get("/", AdminInvitationController.getInvitations as any);

// DELETE /api/v1/admin/invitations/:id - 초대 삭제
router.delete(
  "/:id",
  enhancedAuditLog({
    action: "invitation_delete",
    resourceType: "invitation",
    getResourceId: (req) => req.params?.id,
    fetchOldValues: async (req) => {
      const id = req.params?.id;
      if (!id) return null;
      return await fetchInvitationById(id);
    },
    getNewValues: (req, _res, oldValues) => ({
      deletedInvitation: {
        id: oldValues?.id,
        email: oldValues?.email,
        role: oldValues?.role,
        wasActive: oldValues?.isActive,
        wasExpired: oldValues?.expiresAt
          ? new Date(oldValues.expiresAt) < new Date()
          : false,
      },
    }),
    getContext: (req, oldValues) => ({
      operation: "delete_invitation",
      targetEmail: oldValues?.email || "No email (open invitation)",
      targetRole: oldValues?.role,
      wasActive: oldValues?.isActive,
    }),
  }) as any,
  AdminInvitationController.deleteInvitation as any,
);

export default router;
