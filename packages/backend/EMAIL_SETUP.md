# 이메일 설정 가이드

Gate 애플리케이션에서 실제 이메일 발송을 위한 설정 방법을 안내합니다.
**SendGrid (권장)** 또는 **Gmail SMTP** 중 하나를 선택해서 설정할 수 있습니다.

## 🚀 옵션 1: SendGrid 설정 (권장)

### **1. SendGrid 계정 생성**
1. [SendGrid](https://sendgrid.com/)에 가입
2. 무료 플랜: 월 100통까지 무료 발송 가능
3. 이메일 인증 완료

### **2. API 키 생성**
1. SendGrid 대시보드 로그인
2. **Settings** > **API Keys** 메뉴 이동
3. **Create API Key** 클릭
4. **API Key Name**: `Gate Application`
5. **API Key Permissions**: **Full Access** 선택
6. **Create & View** 클릭
7. 생성된 API 키 복사 (한 번만 표시됨)

### **3. Sender Identity 설정**
1. **Settings** > **Sender Authentication** 메뉴 이동
2. **Single Sender Verification** 선택
3. 발신자 정보 입력:
   - **From Name**: `Gate`
   - **From Email**: 실제 사용할 이메일 주소
   - **Reply To**: 동일한 이메일 주소
4. **Create** 클릭 후 이메일 인증 완료

### **4. .env 파일 설정**
```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your-api-key-here
SENDGRID_FROM=Gate <noreply@yourdomain.com>
SENDGRID_VERIFIED_SENDER=noreply@yourdomain.com
```

---

## 📧 옵션 2: Gmail SMTP 설정

### 1. Google 계정 설정
1. [Google 계정 관리](https://myaccount.google.com/)에 접속
2. **보안** 탭으로 이동
3. **2단계 인증**이 활성화되어 있는지 확인 (필수)

### 2. 앱 비밀번호 생성
1. **보안** > **Google에 로그인** > **앱 비밀번호** 클릭
2. **앱 선택** > **기타(맞춤 이름)** 선택
3. 앱 이름 입력: `Gate Application`
4. **생성** 클릭
5. 생성된 16자리 비밀번호를 복사 (공백 제거)

## ⚙️ 환경 변수 설정

### **자동 제공자 선택**
시스템이 다음 우선순위로 이메일 제공자를 자동 선택합니다:
1. **SendGrid** (SENDGRID_API_KEY가 설정된 경우)
2. **SMTP** (SMTP 설정이 완료된 경우)
3. **Console** (설정이 없는 경우 - 개발용)

### **SendGrid 설정 (권장)**
```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your-sendgrid-api-key-here
SENDGRID_FROM=Gate <noreply@yourdomain.com>
SENDGRID_VERIFIED_SENDER=noreply@yourdomain.com
```

### **Gmail SMTP 설정**
```env
# SMTP Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-digit-app-password
SMTP_FROM=Gate <your-gmail@gmail.com>
```

### **설정 값 설명**

#### SendGrid:
- **SENDGRID_API_KEY**: SendGrid에서 생성한 API 키
- **SENDGRID_FROM**: 발신자 정보 (인증된 이메일)
- **SENDGRID_VERIFIED_SENDER**: 인증된 발신자 이메일

#### SMTP:
- **SMTP_HOST**: SMTP 서버 주소
- **SMTP_PORT**: SMTP 포트 (587 권장)
- **SMTP_SECURE**: TLS 사용 여부
- **SMTP_USER**: 이메일 계정
- **SMTP_PASS**: 앱 비밀번호
- **SMTP_FROM**: 발신자 정보

## 📨 발송되는 이메일 종류

### 1. 비밀번호 재설정 이메일
- 사용자가 비밀번호 재설정을 요청할 때 발송
- 재설정 링크 포함 (1시간 유효)

### 2. 계정 승인 알림 이메일
- 관리자가 사용자 계정을 승인할 때 발송
- 로그인 링크 포함
- 환영 메시지와 사용 가능한 기능 안내

## 🚨 주의사항

### 보안
- 앱 비밀번호는 절대 공유하지 마세요
- .env 파일을 Git에 커밋하지 마세요
- 프로덕션 환경에서는 전용 이메일 계정 사용 권장

### 제한사항
- Gmail은 일일 발송 제한이 있습니다 (개인 계정: 500통/일)
- 대량 발송이 필요한 경우 전문 이메일 서비스 고려

## 🔍 테스트 방법

### **1. 제공자 확인**
```bash
# 백엔드 서버 시작
npm run dev

# 로그에서 이메일 제공자 확인
# "Email provider initialized: SendGrid" 또는
# "Email provider initialized: SMTP" 또는
# "No email provider configured"
```

### **2. 승인 이메일 테스트**
1. 새 계정 생성 (pending 상태)
2. 관리자로 로그인
3. 사용자 관리에서 계정 승인
4. 이메일 수신 확인

### **3. 제공자별 로그 확인**
- **SendGrid**: `Email sent successfully via SendGrid`
- **SMTP**: `Email sent successfully via SMTP`
- **Console**: `EMAIL CONTENT (NO PROVIDER CONFIGURED)`

## 🛠️ 문제 해결

### **SendGrid 오류**
```
Error: Forbidden
```
- API 키가 올바른지 확인
- Sender Identity가 인증되었는지 확인
- API 키 권한이 Full Access인지 확인

### **SMTP 연결 오류**
```
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```
- 앱 비밀번호가 올바른지 확인
- 2단계 인증이 활성화되어 있는지 확인

### **발신자 인증 오류**
```
Error: The from address does not match a verified Sender Identity
```
- SendGrid에서 발신자 이메일 인증 필요
- SENDGRID_FROM과 인증된 이메일이 일치하는지 확인

### **환경 변수 인식 안됨**
- .env 파일 위치 확인 (`packages/backend/.env`)
- 서버 재시작 필요
- 환경 변수명 오타 확인

## 📞 지원

설정에 문제가 있거나 추가 도움이 필요한 경우:
1. 로그 파일 확인
2. 환경 변수 설정 재확인
3. Gmail 계정 보안 설정 확인
