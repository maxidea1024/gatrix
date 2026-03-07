const fs = require('fs');
const path = require('path');

const base = 'c:/work/uwo/gatrix';
const koreanRegex = /[\uAC00-\uD7AF\u3131-\u3163\u318E]/;

// Common Korean comment -> English translation mapping
// Key is exact Korean text, value is English translation
const translations = {
  // Common patterns
  '필수 필드 검증': 'Validate required fields',
  '필수 파라미터 검증': 'Validate required parameters',
  '파일 업로드 URL 생성': 'Generate file upload URL',
  '파일 크기 제한': 'File size limit',
  '허용된 MIME 타입 검증': 'Validate allowed MIME types',
  '파일 확장자 추출': 'Extract file extension',
  '고유한 파일 ID 생성': 'Generate unique file ID',
  '업로드 경로 생성': 'Generate upload path',
  '이미지': 'Images',
  '문서': 'Documents',
  '압축 파일': 'Archives',
  '비디오': 'Videos',
  '오디오': 'Audio',
  '서버 정보 제거': 'Remove server info',
  '채팅 통계 보고': 'Report chat statistics',
  '서버가 등록되어 있는지 확인': 'Check if server is registered',
  '통계 정보 저장': 'Save statistics info',
  '서버 하트비트 업데이트': 'Update server heartbeat',
  '채팅 활동 보고': 'Report chat activity',
  '필수 필드 검증': 'Validate required fields',
  '활동 정보 로깅': 'Log activity info',
  '등록된 채팅 서버 목록 조회 (관리용)': 'Get registered chat server list (for admin)',
  '응답 구조를 그대로 반환': 'Return response structure as-is',
  '사용자 존재 확인': 'Check if user exists',
  '사용자 이메일을 강제 인증 처리': 'Force verify user email',
  '인증 메일 재전송': 'Resend verification email',
  '현재 MySQL 시간대 설정 확인': 'Check current MySQL timezone settings',
  '현재 MySQL 시간 확인': 'Check current MySQL time',
  '권장사항 체크': 'Check recommendations',
  '세션 시간대를 UTC로 설정': 'Set session timezone to UTC',
  '설정 확인용': 'For settings verification',
  '데이터베이스 시간대를 UTC로 설정': 'Set database timezone to UTC',
  '실제 데이터베이스에 저장/조회 테스트 (임시 테이블 사용)': 'Test save/query against actual database (using temp table)',
  '데이터 삽입': 'Insert data',
  '데이터 조회': 'Query data',
  '임시 테이블 삭제': 'Drop temporary table',
  '데이터베이스 설정 확인용 함수': 'Function for checking database settings',
  '데이터베이스 시간대 설정 확인 유틸리티': 'Database timezone settings verification utility',
  '날짜 저장/조회 테스트': 'Date save/query test',
  'MySQL 시간대 설정 확인': 'Check MySQL timezone settings',
  '변환할 타임존': 'Timezone to convert to',
  '타임존이 적용된 포맷된 날짜 문자열': 'Formatted date string with timezone applied',
  '변환할 날짜 필드명 배열': 'Array of date field names to convert',
  '현재 시간 정보 객체': 'Current time info object',
  '지정된 타임존으로 포맷': 'Format with specified timezone',
  'UTC 시간': 'UTC time',
  // Context/Service patterns
  '초기화': 'Initialization',
  '초기값 설정': 'Set initial values',
  '기본값 설정': 'Set default values',
  '기본값': 'Default values',
  '상태 관리': 'State management',
  '상태 업데이트': 'Update state',
  '상태 초기화': 'Reset state',
  '에러 처리': 'Error handling',
  '에러 메시지': 'Error message',
  '로딩 상태': 'Loading state',
  '로딩 중': 'Loading',
  '로그인': 'Login',
  '로그아웃': 'Logout',
  '인증': 'Authentication',
  '인증 상태': 'Authentication state',
  '인증 확인': 'Verify authentication',
  '토큰 갱신': 'Refresh token',
  '토큰 검증': 'Verify token',
  '토큰 만료': 'Token expired',
  '토큰 저장': 'Save token',
  '토큰 삭제': 'Delete token',
  '사용자 정보': 'User info',
  '사용자 정보 조회': 'Get user info',
  '사용자 정보 업데이트': 'Update user info',
  '환경 변수': 'Environment variables',
  '환경 설정': 'Environment settings',
  '캐시': 'Cache',
  '캐시 키': 'Cache key',
  '캐시 삭제': 'Clear cache',
  '캐시에서 조회': 'Get from cache',
  '캐시에 저장': 'Save to cache',
  '검증': 'Validation',
  '유효성 검사': 'Validation',
  '날짜 포맷': 'Date format',
  '날짜 변환': 'Date conversion',
  '타임존 변환': 'Timezone conversion',
  '페이지네이션': 'Pagination',
  '정렬': 'Sorting',
  '필터': 'Filter',
  '필터링': 'Filtering',
  '검색': 'Search',
  '검색어': 'Search term',
  '결과': 'Results',
  '성공': 'Success',
  '실패': 'Failed',
  '삭제': 'Delete',
  '삭제 확인': 'Delete confirmation',
  '수정': 'Edit',
  '생성': 'Create',
  '저장': 'Save',
  '취소': 'Cancel',
  '확인': 'Confirm',
  '닫기': 'Close',
  '열기': 'Open',
  '새로고침': 'Refresh',
  '권한 확인': 'Check permissions',
  '권한 검사': 'Permission check',
  '접근 권한': 'Access permission',
  '접근 제한': 'Access restricted',
  '응답': 'Response',
  '요청': 'Request',
  '헤더': 'Headers',
  '바디': 'Body',
  '파라미터': 'Parameters',
  '쿼리': 'Query',
  '경로': 'Path',
  '라우트': 'Route',
  '라우터': 'Router',
  '미들웨어': 'Middleware',
  '컨트롤러': 'Controller',
  '서비스': 'Service',
  '모델': 'Model',
  '타입': 'Type',
  '인터페이스': 'Interface',
  '콜백': 'Callback',
  '이벤트': 'Event',
  '이벤트 핸들러': 'Event handler',
  '이벤트 리스너': 'Event listener',
  '디바운싱': 'Debouncing',
  '디바운싱된 검색어': 'Debounced search term',
  '시스템 기본 언어로 초기화': 'Initialize with system default language',
  '언어 감지': 'Detect language',
  '언어 변경': 'Change language',
  '언어 설정': 'Language settings',
  '언어 코드 매핑': 'Language code mapping',
  '번역': 'Translation',
  '로컬라이징': 'Localization',
  '로케일': 'Locale',
  '로케일 설정': 'Locale settings',
  '로케일 데이터': 'Locale data',
  '설정 저장': 'Save settings',
  '설정 로드': 'Load settings',
  '설정 초기화': 'Reset settings',
  '테마': 'Theme',
  '테마 설정': 'Theme settings',
  '테마 변경': 'Change theme',
  '다크 모드': 'Dark mode',
  '라이트 모드': 'Light mode',
  '알림': 'Notification',
  '알림 표시': 'Show notification',
  '알림 제거': 'Remove notification',
  '모달': 'Modal',
  '다이얼로그': 'Dialog',
  '폼': 'Form',
  '폼 초기화': 'Form initialization',
  '폼 유효성 검사 스키마': 'Form validation schema',
  '폼 유효성 검사': 'Form validation',
  '폼 제출': 'Form submission',
  '폼 제출 핸들러': 'Form submission handler',
  '폼 데이터': 'Form data',
  '폼 에러': 'Form errors',
  '폼 리셋': 'Form reset',
  '현재 상태 감시': 'Watch current status',
  '현재 상태': 'Current state',
  '초기 설정': 'Initial setup',
  '정리': 'Cleanup',
  '정리 작업': 'Cleanup work',
  '유틸리티': 'Utility',
  '유틸리티 함수': 'Utility function',
  '헬퍼 함수': 'Helper function',
  '상수': 'Constants',
  '열거형': 'Enum',
  '기존 태그 모두 제거': 'Remove all existing tags',
  '존재 확인': 'Check existence',
  '존재하지 않는': 'Does not exist',
  '무시': 'Ignore',
  // dateFormat.ts specific
  '날짜/시간 포맷 유틸 - 사용자 설정(timezone, datetimeFormat)에 따라 출력': 'Date/time format utility - output based on user settings (timezone, datetimeFormat)',
  '날짜만 포맷': 'Format date only',
  '날짜/시간 포맷 - 사용자 설정 포맷 사용': 'Format date/time - using user settings format',
  '상세 포맷 - 사용자 설정 포맷 그대로 사용': 'Detailed format - using user settings format as-is',
  'UI 표시용 통일된 포맷': 'Unified format for UI display',
  '임의 포맷으로 출력 (설정된 타임존 사용)': 'Output with custom format (using configured timezone)',
  '시간 간격을 사람이 읽기 쉬운 형태로 포맷': 'Format time interval in human-readable form',
  '서버 업타임을 HH:MM:SS 형태로 포맷 (초 단위 입력)': 'Format server uptime as HH:MM:SS (input in seconds)',
  '시간만 포맷': 'Format time only',
  '상대 시간 포맷 옵션': 'Relative time format options',
  '상대 시간 포맷': 'Relative time format',
  '날짜 비교 유틸리티': 'Date comparison utility',
  // Timezone related
  'MySQL DATETIME은 UTC로 저장되므로': 'Since MySQL DATETIME is stored in UTC',
  'MySQL DATETIME 형식 문자열 또는 Date 객체': 'MySQL DATETIME format string or Date object',
  'MySQL DATETIME 형식 문자열': 'MySQL DATETIME format string',
  'ISO 8601 형식으로 변환 (프론트엔드용)': 'Convert to ISO 8601 format (for frontend)',
  '프론트엔드용': 'For frontend',
  'UTC로 저장되어 있으므로': 'Since it is stored in UTC',
  '를 추가하여 UTC임을 명시': 'add to indicate UTC',
  '정수로 변환': 'Convert to integer',
  'Node.js 시간 확인': 'Check Node.js time',
  // Router/middleware specific
  '공개 API': 'Public API',
  '인증 필요': 'Authentication required',
  '관리자 전용': 'Admin only',
  '관리자 권한 필요': 'Admin permission required',
  '권한 필요': 'Permission required',
  '읽기 권한': 'Read permission',
  '쓰기 권한': 'Write permission',
  // WeChat
  'WeChat OAuth 인증 URL 생성': 'Generate WeChat OAuth authentication URL',
  // Common comment patterns
  '주석과 빈 줄을 제거': 'Remove comments and empty lines',
  '모든 토큰도 사용됨으로 표시': 'Mark all tokens as used',
  '클라이언트 버전에 태그 설정': 'Set tags for client versions',
  '블록하지 않음': 'Non-blocking',
  '원문 해시 기반': 'Based on original text hash',
  '성공 응답': 'Success response',
  '에러 응답': 'Error response',
  '존재하지 않을 경우': 'If not exists',
  '기존 데이터 조회': 'Get existing data',
  '새로운 데이터 생성': 'Create new data',
  '데이터 업데이트': 'Update data',
  '데이터 삭제': 'Delete data',
  '데이터 조회': 'Query data',
  '데이터 목록 조회': 'Get data list',
  '데이터 상세 조회': 'Get data details',
  '트랜잭션 시작': 'Begin transaction',
  '트랜잭션 커밋': 'Commit transaction',
  '트랜잭션 롤백': 'Rollback transaction',
  '중복 확인': 'Check for duplicates',
  '중복 검사': 'Duplicate check',
  '결과 반환': 'Return results',
  '페이지 정보': 'Page info',
  '총 개수 조회': 'Get total count',
  '목록 조회': 'Get list',
  '상세 조회': 'Get details',
  '수정 권한 확인': 'Check edit permission',
  '삭제 권한 확인': 'Check delete permission',
  '관리 권한 확인': 'Check admin permission',
  '입력값 검증': 'Validate input',
  '결과 처리': 'Process results',
  '실행 결과': 'Execution result',
  '작업 완료': 'Task completed',
  '작업 실패': 'Task failed',
  '작업 중': 'In progress',
  '대기 중': 'Pending',
  '처리 중': 'Processing',
  '처리 완료': 'Processing completed',
  '처리 실패': 'Processing failed',
  '응답 데이터': 'Response data',
  '요청 데이터': 'Request data',
  '요청 본문': 'Request body',
  '요청 파라미터': 'Request parameters',
  '요청 검증': 'Validate request',
  '실제 환경에서는': 'In production environment',
  '환경변수에서 가져오기': 'Get from environment variables',
  '설정': 'Settings',
  '등록': 'Register',
  '해제': 'Unregister',
  '구글 번역 API 형식으로': 'to Google Translate API format',
  '기존': 'Existing',
  '새로운': 'New',
  '모두': 'All',
  '없음': 'None',
  // Status related
  '상태': 'Status',
  '활성': 'Active',
  '비활성': 'Inactive',
  '활성화': 'Enable',
  '비활성화': 'Disable',
  '만료': 'Expired',
  '만료됨': 'Expired',
  '사용': 'Used',
  '미사용': 'Unused',
  // Enhancedauditlog
  '육하원칙': '5W1H principle',
};

const dirs = [
  'packages/frontend/src',
  'packages/backend/src',
];

const excludeDirs = ['node_modules', 'dist', '.git', 'locales', 'contents'];
const extensions = ['.ts', '.tsx'];

function walk(dir) {
  const files = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (excludeDirs.includes(f)) continue;
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      if (st.isDirectory()) files.push(...walk(full));
      else if (extensions.some(ext => f.endsWith(ext))) files.push(full);
    }
  } catch(e) {}
  return files;
}

let totalFilesChanged = 0;
let totalLinesChanged = 0;

for (const dir of dirs) {
  const fullDir = path.join(base, dir);
  const files = walk(fullDir);
  
  for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;
    
    // Apply translations
    for (const [kr, en] of Object.entries(translations)) {
      if (content.includes(kr)) {
        // Only replace in comment contexts (be careful not to replace in strings/locale files)
        const lines = content.split('\n');
        let lineChanged = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.includes(kr)) continue;
          
          const trimmed = line.trim();
          // Is this a comment line? Check for //, /*, *, {/*
          const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || 
                           trimmed.startsWith('/*') || trimmed.includes('{/*');
          // Inline comment after code
          const commentIdx = line.indexOf('//');
          const isInlineComment = commentIdx >= 0 && line.substring(commentIdx).includes(kr);
          const jsxCommentIdx = line.indexOf('{/*');
          const isJsxComment = jsxCommentIdx >= 0 && line.substring(jsxCommentIdx).includes(kr);
          // JSDoc comment
          const isJsDocComment = trimmed.startsWith('*') && trimmed.includes('@');
          
          if (isComment || isInlineComment || isJsxComment || isJsDocComment) {
            lines[i] = line.replace(kr, en);
            lineChanged = true;
            totalLinesChanged++;
          }
        }
        
        if (lineChanged) {
          content = lines.join('\n');
          changed = true;
        }
      }
    }
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf-8');
      const rel = path.relative(base, filePath).replace(/\\/g, '/');
      console.log('UPDATED: ' + rel);
      totalFilesChanged++;
    }
  }
}

console.log('\nTotal: ' + totalFilesChanged + ' files updated, ' + totalLinesChanged + ' lines changed');
