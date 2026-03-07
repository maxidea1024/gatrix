import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { BannerController } from '../../controllers/banner-controller';

const router = Router();

// All banner routes require authentication and admin role
router.use(authenticate as any);
// Banner CRUD routes
router.get('/', BannerController.getBanners);
router.get('/:bannerId', BannerController.getBannerById);
router.post('/', BannerController.createBanner);
router.put('/:bannerId', BannerController.updateBanner);
router.delete('/:bannerId', BannerController.deleteBanner);

// Banner action routes
router.post('/:bannerId/publish', BannerController.publishBanner);
router.post('/:bannerId/archive', BannerController.archiveBanner);
router.post('/:bannerId/duplicate', BannerController.duplicateBanner);

export default router;
