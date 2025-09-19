import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { LinkPreviewService } from '../services/LinkPreviewService';

const router = Router();

// 링크 미리보기 추출 API
router.post('/', authenticate, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL이 필요합니다.'
      });
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 URL입니다.'
      });
    }

    // 링크 미리보기 추출
    const preview = await LinkPreviewService.extractPreview(url);

    if (!preview) {
      return res.status(404).json({
        success: false,
        error: '링크 미리보기를 생성할 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: preview
    });

  } catch (error) {
    console.error('링크 미리보기 API 오류:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    });
  }
});

// 여러 URL 일괄 처리 API
router.post('/batch', authenticate, async (req, res) => {
  try {
    const { urls } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URL 배열이 필요합니다.'
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: '한 번에 최대 10개의 URL만 처리할 수 있습니다.'
      });
    }

    // 모든 URL에 대해 병렬로 미리보기 추출
    const previews = await Promise.allSettled(
      urls.map(url => LinkPreviewService.extractPreview(url))
    );

    const results = previews.map((result, index) => ({
      url: urls[index],
      success: result.status === 'fulfilled' && result.value !== null,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason?.message : null
    }));

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('일괄 링크 미리보기 API 오류:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    });
  }
});

export default router;
