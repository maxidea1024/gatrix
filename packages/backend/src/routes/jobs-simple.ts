import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

// 테스트용 라우트 (인증 없음)
router.get('/test-jobs', (req, res) => {
  res.json({
    success: true,
    message: 'Job API is working',
    data: []
  });
});

// 모든 라우트에 인증 및 관리자 권한 필요
router.use(authenticate as any);
router.use(requireAdmin as any);

// 간단한 Job 라우트들
router.get('/jobs', (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

// Job 생성
router.post('/jobs', (req, res) => {
  console.log('Job creation request:', req.body);
  res.status(201).json({
    success: true,
    data: {
      id: Math.floor(Math.random() * 1000) + 1,
      name: req.body.name,
      job_type_id: req.body.job_type_id,
      description: req.body.description,
      memo: req.body.memo,
      is_enabled: req.body.is_enabled,
      max_retry_count: req.body.max_retry_count,
      timeout_seconds: req.body.timeout_seconds,
      job_data_map: req.body.job_data_map,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    message: 'Job created successfully (simulated)'
  });
});

// Job 상세 조회
router.get('/jobs/:id', (req, res) => {
  res.json({
    success: true,
    data: {
      id: parseInt(req.params.id),
      name: 'Sample Job',
      job_type_id: 1,
      description: 'Sample description',
      memo: 'Sample memo',
      is_enabled: true,
      max_retry_count: 3,
      timeout_seconds: 300,
      job_data_map: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });
});

// Job 수정
router.put('/jobs/:id', (req, res) => {
  console.log('Job update request:', req.params.id, req.body);
  res.json({
    success: true,
    data: {
      id: parseInt(req.params.id),
      ...req.body,
      updated_at: new Date().toISOString()
    },
    message: 'Job updated successfully (simulated)'
  });
});

// Job 삭제
router.delete('/jobs/:id', (req, res) => {
  console.log('Job delete request:', req.params.id);
  res.json({
    success: true,
    message: 'Job deleted successfully (simulated)'
  });
});

// Job 실행
router.post('/jobs/:id/execute', (req, res) => {
  console.log('Job execution request:', req.params.id);
  const executionId = Math.floor(Math.random() * 1000) + 1;
  res.json({
    success: true,
    data: { executionId },
    message: 'Job execution started (simulated)'
  });
});

// Job 실행 이력
router.get('/jobs/:id/executions', (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

router.get('/job-types', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'mailsend',
        display_name: '메일 발송',
        description: '이메일을 발송하는 Job',
        is_enabled: true,
        schema_definition: {
          to: {
            type: 'string',
            label: '받는 사람',
            required: true,
            description: '이메일 주소'
          },
          subject: {
            type: 'string',
            label: '제목',
            required: true
          },
          body: {
            type: 'text',
            label: '내용',
            required: true
          }
        }
      },
      {
        id: 2,
        name: 'http_request',
        display_name: 'HTTP 요청',
        description: 'HTTP API를 호출하는 Job',
        is_enabled: true,
        schema_definition: {
          url: {
            type: 'string',
            label: 'URL',
            required: true,
            description: '요청할 URL'
          },
          method: {
            type: 'select',
            label: 'HTTP 메서드',
            required: true,
            options: ['GET', 'POST', 'PUT', 'DELETE'],
            default: 'GET'
          },
          headers: {
            type: 'object',
            label: '헤더',
            description: 'HTTP 헤더 (JSON 형식)'
          },
          body: {
            type: 'text',
            label: '요청 본문',
            description: 'POST/PUT 요청 시 본문 데이터'
          }
        }
      },
      {
        id: 3,
        name: 'ssh_command',
        display_name: 'SSH 명령',
        description: '원격 서버에서 SSH 명령을 실행하는 Job',
        is_enabled: true,
        schema_definition: {
          host: {
            type: 'string',
            label: '호스트',
            required: true,
            description: '접속할 서버 주소'
          },
          port: {
            type: 'number',
            label: '포트',
            default: 22
          },
          username: {
            type: 'string',
            label: '사용자명',
            required: true
          },
          password: {
            type: 'string',
            label: '비밀번호',
            required: true,
            description: '보안상 실제 운영에서는 키 파일 사용 권장'
          },
          command: {
            type: 'text',
            label: '실행할 명령',
            required: true,
            description: '실행할 SSH 명령어'
          }
        }
      },
      {
        id: 4,
        name: 'log_message',
        display_name: '로그 메시지',
        description: '지정된 로그 레벨로 메시지를 기록하는 Job',
        is_enabled: true,
        schema_definition: {
          message: {
            type: 'text',
            label: '로그 메시지',
            required: true,
            description: '기록할 로그 메시지 내용'
          },
          level: {
            type: 'select',
            label: '로그 레벨',
            required: true,
            options: ['debug', 'info', 'warn', 'error'],
            default: 'info',
            description: '로그 레벨을 선택하세요'
          },
          category: {
            type: 'string',
            label: '카테고리',
            required: false,
            default: 'job',
            description: '로그 카테고리 (선택사항)'
          },
          metadata: {
            type: 'object',
            label: '추가 메타데이터',
            required: false,
            description: '로그와 함께 기록할 추가 정보 (JSON 형식)'
          }
        }
      }
    ]
  });
});

export default router;
