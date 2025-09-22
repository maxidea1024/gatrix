import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';

const router = Router();

// 기존 auth 미들웨어 사용 (임시)
router.use(authenticate);

// 사용자 정보 업서트
router.post('/upsert', UserController.upsertUser);

// 사용자 정보 조회
router.get('/:userId', UserController.getUser);

// 모든 사용자 목록 조회
router.get('/', UserController.getUsers);

// 사용자 상태 업데이트
router.put('/:userId/status', UserController.updateUserStatus);

// 사용자 삭제
router.delete('/:userId', UserController.deleteUser);

export default router;
