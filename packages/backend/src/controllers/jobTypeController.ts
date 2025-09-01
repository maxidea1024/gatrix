import { Request, Response } from 'express';
import { JobTypeModel } from '../models/JobType';
import logger from '../config/logger';

// Job 타입 목록 조회
export const getJobTypes = async (req: Request, res: Response) => {
  try {
    const { enabled } = req.query;

    let jobTypes;
    if (enabled === 'true') {
      jobTypes = await JobTypeModel.findEnabled();
    } else {
      jobTypes = await JobTypeModel.findAll();
    }

    res.json({
      success: true,
      data: jobTypes
    });
  } catch (error) {
    logger.error('Error getting job types:', error);

    // 오류 발생 시 하드코딩된 데이터 반환
    const fallbackJobTypes = [
      {
        id: 1,
        name: 'mailsend',
        displayName: '메일 발송',
        description: '이메일을 발송하는 Job',
        isEnabled: true,
        schemaDefinition: {
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
        displayName: 'HTTP 요청',
        description: 'HTTP API를 호출하는 Job',
        isEnabled: true,
        schemaDefinition: {
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
        displayName: 'SSH 명령',
        description: '원격 서버에서 SSH 명령을 실행하는 Job',
        isEnabled: true,
        schemaDefinition: {
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
        displayName: '로그 메시지',
        description: '지정된 로그 레벨로 메시지를 기록하는 Job',
        isEnabled: true,
        schemaDefinition: {
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
    ];

    res.json({
      success: true,
      data: fallbackJobTypes
    });
  }
};

// Job 타입 상세 조회
export const getJobType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobType = await JobTypeModel.findById(parseInt(id));
    
    if (!jobType) {
      return res.status(404).json({
        success: false,
        message: 'Job type not found'
      });
    }
    
    res.json({
      success: true,
      data: jobType
    });
  } catch (error) {
    logger.error('Error getting job type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job type',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
