# 부록 A: 시스템 설정 가이드 (System Setup)

본 문서는 시스템 엔지니어 및 서버 관리자를 위한 설정 가이드입니다. 
Gatrix의 이메일 발송 기능을 활성화하기 위한 SMTP 설정 방법을 안내합니다.

---

## 1. SMTP 이메일 설정

Gatrix는 사용자 초대, 비밀번호 재설정 등을 위해 SMTP 서버가 필요합니다.
서버 배포 시 아래 **환경 변수(Environment Variables)**를 설정해야 합니다.

### 필수 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `SMTP_HOST` | SMTP 서버 주소 | `smtp.gmail.com` 또는 `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_PORT` | 포트 번호 | `587` (TLS) 또는 `465` (SSL) |
| `SMTP_USER` | SMTP 사용자 계정 | `admin@gatrix.com` |
| `SMTP_PASS` | SMTP 비밀번호 | `app-password-xxxx` |
| `SMTP_FROM` | 발신자 주소 | `"Gatrix Support" <noreply@gatrix.com>` |
| `SMTP_SECURE` | 보안 연결 사용 여부 | `true` 또는 `false` |

### 주요 서비스별 설정 예시

#### 1) Gmail 사용 시 (테스트용)

Google 계정 설정에서 **앱 비밀번호 (App Password)**를 생성하여 사용해야 합니다.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
SMTP_SECURE=false
```

#### 2) AWS SES (Amazon Simple Email Service)

프로덕션 환경에서 가장 권장되는 방식입니다.

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIAxxxxxxxxxxxx
SMTP_PASS=Bxxxxxxxxxxxxxxxxxxxx
SMTP_SECURE=true
```

#### 3) Tencent Cloud SES (Simple Email Service)

중국 지역에서 운영하는 경우 권장되는 방식입니다.
Tencent Cloud 콘솔에서 SES 서비스를 활성화하고 SMTP 비밀번호를 생성해야 합니다.

```env
SMTP_HOST=smtp.qcloudmail.com
SMTP_PORT=465
SMTP_USER=your-sender@yourdomain.com
SMTP_PASS=xxxxxxxxxxxxxxxxxxxx
SMTP_FROM="Gatrix Support" <your-sender@yourdomain.com>
SMTP_SECURE=true
```

> **📌 Tencent Cloud SES 설정 시 주의사항:**
>
> 1. **발신자 도메인 인증:** Tencent Cloud SES를 사용하기 전에 발신 도메인의 DNS에 SPF, DKIM, DMARC 레코드를 설정해야 합니다.
> 2. **발신자 주소 등록:** `SMTP_FROM`에 사용할 이메일 주소를 Tencent Cloud 콘솔에서 사전에 등록하고 인증해야 합니다.
> 3. **SMTP 비밀번호:** Tencent Cloud 콘솔 > SES > 설정 > SMTP 비밀번호에서 생성한 비밀번호를 사용합니다. (로그인 비밀번호와 다릅니다.)
> 4. **리전 선택:** 중국 내 서버인 경우 `smtp.qcloudmail.com`을, 홍콩/해외 서버인 경우 `sg-smtp.qcloudmail.com` (싱가포르) 등 해당 리전의 엔드포인트를 사용하세요.

---

## 2. 문제 해결 (Troubleshooting)

### 이메일 발송 실패 시 점검 항목

1. **방화벽 확인:** 서버에서 SMTP 포트(587, 465, 25) 아웃바운드가 차단되어 있는지 확인하세요. (특히 AWS EC2의 경우 25번 포트는 기본 차단됩니다.)
2. **인증 정보 확인:** 아이디/비밀번호가 정확한지, 특수문자가 포함되어 있다면 이스케이프 처리가 필요한지 확인하세요.
3. **발신자 주소 확인:** 일부 SMTP 서버(AWS SES 등)는 사전에 인증된 발신자 도메인/이메일만 허용합니다.

---

## 📬 문의처

본 매뉴얼 또는 Gatrix 시스템에 대해 질문이 있으시면 **Gatrix 개발팀**에 문의해 주세요.

> 💡 **Tip:** 문의 시 환경(Environment), 오류 메시지, 재현 절차를 함께 알려주시면 더 빠른 지원이 가능합니다.
