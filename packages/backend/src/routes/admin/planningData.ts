import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { PlanningDataController } from '../../controllers/PlanningDataController';

const router = Router();

// All planning data routes require authentication and admin role
router.use(authenticate as any);
router.use(requireAdmin as any);

// Planning data routes
router.get('/reward-lookup', PlanningDataController.getRewardLookup);
router.get('/reward-types', PlanningDataController.getRewardTypeList);
router.get('/reward-types/:rewardType/items', PlanningDataController.getRewardTypeItems);
router.get('/localization/:language', PlanningDataController.getLocalization);
router.get('/ui-list', PlanningDataController.getUIListData);
router.get('/ui-list/:category/items', PlanningDataController.getUIListItems);
router.post('/rebuild', PlanningDataController.rebuildRewardLookup);
router.get('/stats', PlanningDataController.getStats);

// HotTimeBuff routes
router.get('/hottimebuff', PlanningDataController.getHotTimeBuffLookup);
router.post('/hottimebuff/build', PlanningDataController.buildHotTimeBuffLookup);

// EventPage routes
router.get('/eventpage', PlanningDataController.getEventPageLookup);
router.post('/eventpage/build', PlanningDataController.buildEventPageLookup);

// LiveEvent routes
router.get('/liveevent', PlanningDataController.getLiveEventLookup);
router.post('/liveevent/build', PlanningDataController.buildLiveEventLookup);

// MateRecruitingGroup routes
router.get('/materecruiting', PlanningDataController.getMateRecruitingGroupLookup);
router.post('/materecruiting/build', PlanningDataController.buildMateRecruitingGroupLookup);

// OceanNpcAreaSpawner routes
router.get('/oceannpcarea', PlanningDataController.getOceanNpcAreaSpawnerLookup);
router.post('/oceannpcarea/build', PlanningDataController.buildOceanNpcAreaSpawnerLookup);

export default router;

