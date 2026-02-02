import { Router } from "express";
import { UserController } from "../controllers/UserController";
import { authenticate } from "../middleware/auth";

const router = Router();

// 기존 auth 미들웨어 사용 (임시)
router.use(authenticate);

// 사용자 동기화 (백엔드에서 프록시로 호출)
// 동기화 라우트 별칭 (백엔드의 /upsert 호출과 호환)
router.post("/upsert", UserController.upsertUser);

router.post("/sync-user", UserController.upsertUser);

// 여러 사용자 일괄 동기화 (관리자용)
router.post("/sync-users", UserController.bulkUpsertUsers);

// 사용자 존재 확인
router.get("/check/:userId", UserController.checkUser);

// 사용자 정보 조회
router.get("/:userId", UserController.getUser);

// 모든 사용자 목록 조회
router.get("/", UserController.getUsers);

// 사용자 상태 업데이트
router.put("/:userId/status", UserController.updateUserStatus);

// 사용자 삭제
router.delete("/:userId", UserController.deleteUser);

export default router;
