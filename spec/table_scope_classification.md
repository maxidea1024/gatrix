# Gatrix 테이블 스코프 분류

모든 DB 테이블을 스코프별로 분류합니다.

## 🟣 Global (스코핑 없음)

| 테이블                    | 설명                                         |
| ------------------------- | -------------------------------------------- |
| `g_organisations`         | 조직 목록 (최상위)                           |
| `g_users`                 | 사용자 (org에 속하지만 테이블 자체는 global) |
| `g_oauth_accounts`        | OAuth 계정 연결                              |
| `g_password_reset_tokens` | 비밀번호 재설정                              |
| `g_feature_flag_types`    | 플래그 타입 정의 (release, experiment 등)    |
| `g_sessions`              | 사용자 세션                                  |
| `g_mails`                 | 메일 발송 로그                               |

## 🔵 Org 레벨 (orgId FK)

| 테이블                       | 설명             | 백엔드 필터링              |
| ---------------------------- | ---------------- | -------------------------- |
| `g_organisation_members`     | 조직 멤버        | ✅ RBAC API에서 orgId 사용  |
| `g_roles`                    | 역할 정의        | ✅ RBAC API에서 orgId 사용  |
| `g_projects`                 | 프로젝트         | ✅ RBAC API에서 orgId 사용  |
| `g_groups`                   | 그룹             | ✅ RBAC API에서 orgId 사용  |
| `g_admin_api_tokens`         | Admin API 토큰   | ✅ RBAC API에서 orgId 사용  |
| `g_sso_providers`            | SSO 설정         | ✅ orgId 사용               |
| `g_invitations`              | 초대             | ✅ orgId 사용               |
| `g_audit_logs`               | 감사 로그        | ⚠️ orgId 있으나 필터 미확인 |
| `g_user_roles`               | 사용자-역할 연결 | ✅ roleId/userId로 간접     |
| `g_group_members`            | 그룹 멤버        | ✅ groupId로 간접           |
| `g_group_roles`              | 그룹-역할 연결   | ✅ groupId/roleId로 간접    |
| `g_role_org_permissions`     | Org 권한         | ✅ roleId로 간접            |
| `g_role_project_permissions` | Project 권한     | ✅ roleId+projectId         |

## 🟢 Project 레벨 (projectId FK)

| 테이블                     | 설명                     | 백엔드 필터링                        |
| -------------------------- | ------------------------ | ------------------------------------ |
| `g_client_versions`        | 클라이언트 버전           | ✅ projectId FK 직접 사용             |
| `g_feature_flags`          | 피처 플래그              | 🔧 모델에 추가, 라우트 미적용         |
| `g_feature_segments`       | 세그먼트                 | ❌ 미적용                             |
| `g_feature_context_fields` | 컨텍스트 필드            | ❌ 미적용                             |
| `g_tags`                   | 태그                     | ✅ 완료                               |
| `g_environments`           | 환경 (project NULL 가능) | ⚠️ `getByProject` 존재, 라우트 미적용 |

## 🟡 Environment 레벨 (environmentId FK)

### 002_application_tables (게임/앱 데이터)
| 테이블                    | 설명              |
| ------------------------- | ----------------- |
| `g_game_worlds`           | 게임 월드         |
| `g_account_whitelist`     | 계정 화이트리스트 |
| `g_ip_whitelist`          | IP 화이트리스트   |
| `g_vars`                  | Key-Value 변수    |
| `g_message_templates`     | 메시지 템플릿     |
| `g_job_types`             | 작업 타입         |
| `g_jobs`                  | 작업              |
| `g_service_notices`       | 서비스 공지       |
| `g_ingame_popup_notices`  | 인게임 팝업       |
| `g_surveys`               | 설문              |
| `g_coupon_settings`       | 쿠폰 설정         |
| `g_banners`               | 배너              |
| `g_store_products`        | 스토어 상품       |
| `g_store_product_locales` | 상품 로컬라이징   |
| `g_reward_templates`      | 보상 템플릿       |
| `g_planning_data`         | 플래닝 데이터     |
| `g_campaigns`             | 캠페인            |
| `g_campaign_schedules`    | 캠페인 스케줄     |
| `g_crash_events`          | 크래시 이벤트     |

> ⚠️ 이 테이블들은 environment를 통해 **간접적으로** project에 속함 (`g_environments.projectId`).
> 별도로 projectId 컬럼을 추가할 필요는 없으나, **environment가 project에 묶여야** 정상 작동함.

### 003_feature_flags_system (피처 플래그 하위)
| 테이블                        | 설명                          |
| ----------------------------- | ----------------------------- |
| `g_feature_flag_environments` | 플래그별 환경 설정            |
| `g_feature_strategies`        | 전략 (flagId + environmentId) |
| `g_feature_variants`          | 변형 (flagId + environmentId) |
| `g_feature_metrics`           | 메트릭스                      |
| `g_feature_variant_metrics`   | 변형 메트릭스                 |
| `g_unknown_flags`             | 미등록 플래그 감지            |

### 004_cr_release_integration
| 테이블                     | 설명              |
| -------------------------- | ----------------- |
| `g_change_requests`        | 변경 요청         |
| `g_outbox_events`          | 이벤트 아웃박스   |
| `g_release_flows`          | 릴리즈 플로우     |
| `g_integrations`           | 통합 연동         |
| `g_signal_endpoints`       | 시그널 엔드포인트 |
| `g_action_sets`            | 액션 세트         |
| `g_service_account_tokens` | 서비스 계정 토큰  |

## 🔴 Flag 레벨 (flagId FK, 환경 무관)

| 테이블                      | 설명                 |
| --------------------------- | -------------------- |
| `g_feature_code_references` | 코드 참조            |
| `g_impact_metric_configs`   | 메트릭 설정          |
| `g_feature_flag_segments`   | 플래그-세그먼트 연결 |
| `g_tag_assignments`         | 태그 할당            |

## 🔑 Environment Key 레벨

| 테이블                           | 설명                      |
| -------------------------------- | ------------------------- |
| `g_environment_keys`             | SDK 키 (environmentId FK) |
| `g_role_environment_permissions` | 환경별 권한               |

---

## 핵심 스코핑 체인

```
Organisation → Project → Environment → Data
     │             │           │
     │             ├─ Feature Flags
     │             ├─ Segments
     │             ├─ Context Fields
     │             └─ Tags
     │
     ├─ Roles, Groups
     ├─ Admin API Tokens
     └─ SSO Providers
```

## 현재 작업 우선순위

1. **Project 레벨 필터링 완성**: feature_flags, segments, context_fields 라우트
2. **Environment ↔ Project 연동**: environments 라우트에서 projectId 필터
3. **간접 스코핑 확인**: environment-level 데이터가 project 전환 시 자동으로 분리되는지 검증
