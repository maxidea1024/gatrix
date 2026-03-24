# Gatrix Design Principles

## 1. Minimize Complexity
- Entity와 관련된 부가 데이터(tags 등)는 별도 API를 만들지 말고 entity의 create/update에 통합 처리
- 캐시 무효화도 entity 업데이트 흐름에서 자연스럽게 처리되도록 설계 (별도 무효화 로직 X)
- 새 기능 추가 시 기존 흐름에 자연스럽게 녹아들 수 있는지 먼저 검토

## 2. Centralized Patterns
- 태그 관리: `TagAssignmentModel` / `TagService`를 통한 중앙 관리
- 개별 entity model에 tag 메서드를 만들지 않음

## 3. Consistent API Design
- Environment는 `X-API-Token` 헤더로 식별 (경로에 `:env` 사용 X)
- 주석의 경로 문서는 실제 경로와 일치시킬 것

## 4. Code Standards
- 코드 주석은 영어
- 대화/계획은 한글
