import { Router, Request } from 'express';
import multer from 'multer';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { PlanningDataController } from '../../controllers/PlanningDataController';

const router = Router() as any;

// Configure multer for file uploads (memory storage)
// 100MB file size limit for planning data uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// All planning data routes require authentication and admin role
router.use(authenticate as any);
router.use(requireAdmin as any);

// Planning data routes
router.get('/reward-lookup', PlanningDataController.getRewardLookup);
router.get('/reward-types', PlanningDataController.getRewardTypeList);
router.get('/reward-types/:rewardType/items', PlanningDataController.getRewardTypeItems);
router.get('/ui-list', PlanningDataController.getUIListData);
router.get('/ui-list/:category/items', PlanningDataController.getUIListItems);
router.get('/stats', PlanningDataController.getStats);

// HotTimeBuff routes
router.get('/hottimebuff', PlanningDataController.getHotTimeBuffLookup);

// EventPage routes
router.get('/eventpage', PlanningDataController.getEventPageLookup);

// LiveEvent routes
router.get('/liveevent', PlanningDataController.getLiveEventLookup);

// MateRecruitingGroup routes
router.get('/materecruiting', PlanningDataController.getMateRecruitingGroupLookup);

// OceanNpcAreaSpawner routes
router.get('/oceannpcarea', PlanningDataController.getOceanNpcAreaSpawnerLookup);

// File upload route (drag & drop)
router.post('/upload', upload.any(), PlanningDataController.uploadPlanningData);

// Preview diff route (preview changes before upload)
router.post('/preview-diff', upload.any(), PlanningDataController.previewDiff);

// Upload history routes
router.get('/history', PlanningDataController.getUploadHistory);
router.get('/latest', PlanningDataController.getLatestUpload);
router.delete('/history', PlanningDataController.resetUploadHistory);

export default router;
