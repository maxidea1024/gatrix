---
sidebar_position: 2
sidebar_label: 화이트리스트
---

# 화이트리스트

## 개요

점검 중이나 접속 제한 시 예외적으로 접속을 허용할 계정 및 IP를 관리합니다.

**접근 경로:** 시스템 관리 → 화이트리스트

## 기능

- 계정 ID별 화이트리스트 등록
- IP 또는 IP 대역별 화이트리스트 등록
- 항목별 활성화/비활성화 제어
- 항목별 메모 작성

## 계정 추가 방법

1. **시스템 관리** > **화이트리스트**로 이동합니다.
2. **계정 추가** 버튼을 클릭합니다.
3. 계정 ID를 입력합니다.
4. 필요시 메모를 추가합니다.
5. **추가**를 클릭합니다.

## IP 추가 방법

1. **시스템 관리** > **화이트리스트**로 이동합니다.
2. **IP 추가** 버튼을 클릭합니다.
3. IP 주소 또는 CIDR 대역을 입력합니다.
4. 필요시 메모를 추가합니다.
5. **추가**를 클릭합니다.

## 주요 활용 사례

- 점검 중 QA 팀의 테스트 접속
- 개발자 접근 허용
- VIP 사용자 조기 접속 권한 부여
- 파트너사 계정 관리

## API 연동

SDK를 통해 화이트리스트 상태를 확인합니다:

```typescript
const isWhitelisted = await medical.whitelist.isAccountWhitelisted(accountId);
const isIpWhitelisted = await medical.whitelist.isIpWhitelisted(ipAddress);
```
