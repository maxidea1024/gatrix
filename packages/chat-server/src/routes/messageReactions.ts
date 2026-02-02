import { Router } from "express";
import { MessageReactionController } from "../controllers/MessageReactionController";
import { authenticate } from "../middleware/auth";

const router = Router();

// 모든 리액션 라우트에 인증 미들웨어 적용
router.use(authenticate);

/**
 * 메시지 리액션 관련 라우트
 */

// 메시지에 리액션 추가/제거 (토글)
router.post(
  "/messages/:messageId/reactions",
  MessageReactionController.toggleReaction,
);

// 메시지의 리액션 목록 조회
router.get(
  "/messages/:messageId/reactions",
  MessageReactionController.getReactions,
);

// 특정 리액션 제거
router.delete(
  "/messages/:messageId/reactions/:emoji",
  MessageReactionController.removeReaction,
);

export default router;
