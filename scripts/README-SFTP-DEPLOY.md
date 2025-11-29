# SFTP Deploy Script

SFTP 배포 스크립트가 추가되었습니다.

## 사용법

```bash
# 기본 레이블 (cbt) 사용
yarn deploy:ftp

# 커스텀 레이블 사용
yarn deploy:ftp prod
yarn deploy:ftp staging

# 로컬에만 압축 파일 생성 (업로드 안 함)
yarn deploy:ftp cbt --local-only
yarn deploy:ftp prod --local-only
```

## 파일명 형식

```
uwo.{label}.YYYYMMDD-HHMM.{commit}.tgz
```

예시:
- `uwo.cbt.20251129-2348.9ae080.tgz`
- `uwo.prod.20251129-2348.9ae080.tgz`

## SFTP 서버 정보

- **Host**: 43.135.7.155:22
- **User**: build1_dev
- **Base Path**: `/build/03. server_packages/`
- **Upload Path**: `/build/03. server_packages/{label}/`

## 동작 방식

1. 현재 커밋 해시 가져오기 (6자리)
2. 현재 날짜/시간으로 파일명 생성
3. `git archive`로 main 브랜치 export
4. SFTP로 서버에 업로드
5. 임시 파일 정리

## 필요 패키지

스크립트 실행 시 자동으로 `ssh2-sftp-client`가 설치됩니다.
