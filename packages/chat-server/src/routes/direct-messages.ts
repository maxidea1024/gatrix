import { Router } from "express";
import { DirectMessageController } from "../controllers/DirectMessageController";
import { authenticate, rateLimiter } from "../middleware/auth";

const router = Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 1:1 대화 시작 또는 기존 대화 조회
router.post(
  "/",
  rateLimiter(60000, 30), // 1분에 30회 DM 생성 제한
  DirectMessageController.createOrGetDirectMessage,
);

// 사용자의 모든 1:1 대화 목록 조회
router.get(
  "/",
  rateLimiter(60000, 60), // 1분에 60회 요청 제한
  DirectMessageController.getDirectMessageChannels,
);

// 1:1 대화 채널 아카이브
router.delete(
  "/:channelId",
  rateLimiter(60000, 20), // 1분에 20회 아카이브 제한
  DirectMessageController.archiveDirectMessage,
);

// 1:1 대화 상대방 상태 확인
router.get(
  "/:channelId/status",
  rateLimiter(60000, 100), // 1분에 100회 상태 확인 제한
  DirectMessageController.getDirectMessageStatus,
);

export default router;
