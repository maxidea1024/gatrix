# 제 18장: 시스템 설정 (System Settings)

Gatrix 시스템 전반에 영향을 미치는 설정들을 관리합니다.

**경로:** 설정 (Settings)  
**필요 권한:** `system-settings.manage`, `tags.manage` (Admin 역할 필요)

---

## 1. 태그 관리 (Tags)

**경로:** `/settings/tags`

게임 월드, 상점 상품 등 다양한 곳에서 사용되는 '태그'를 중앙에서 관리합니다.
미리 태그를 정의해두면, 각 메뉴에서 일관된 태그 색상과 이름을 사용할 수 있습니다.

- **Name:** 태그 이름 (예: `VIP`, `Event`, `New`)
- **Color:** 태그 배경색 지정
- **Description:** 태그 용도 설명

---

## 2. 환경 관리 (Environments)

**경로:** `/settings/environments`

Gatrix가 관리하는 운영 환경(Dev, Stage, Prod 등) 목록을 관리합니다.
각 환경의 식별자, UI 표시 색상 등을 설정하여 관리자가 현재 작업 중인 환경을 명확히 인지하도록 돕습니다.

---

## 3. KV 설정 (KV Settings)

**경로:** `/settings/kv`

시스템 내부에서 사용하는 Key-Value 형태의 정적 설정값들을 관리합니다.
리모트 컨피그(Remote Config)가 게임 클라이언트를 위한 설정이라면, KV 설정은 주로 백엔드 시스템이나 대시보드 자체의 동작을 제어하기 위한 용도로 사용됩니다.

- **Key:** 설정 키 이름 (예: `help_center_url`, `maintenance_allowed_ips`)
- **Value:** 설정 값

---

**이전 장:** [← 제 17장: 감사 로그 및 모니터링](16-monitoring.md)  
**처음으로:** [목차로 돌아가기](00-table-of-contents.md)
