# 제 14장: 리모트 컨피그 (Remote Config)

게임 클라이언트 업데이트(빌드 배포) 없이, 서버에서 원격으로 게임 내 변수나 설정을 실시간으로 변경하는 기능입니다.

**경로:** `/admin/remote-config`  
**필요 권한:** `remote-config.manage` (관리), `remote-config.view` (조회)

---

## 1. 개요

리모트 컨피그를 사용하면 다음과 같은 작업을 수행할 수 있습니다.
- 게임 밸런스 수치 조정 (예: 몬스터 공격력, 드랍율)
- 기능 켜기/끄기 (Feature Flag)
- A/B 테스트 및 캠페인 실행
- 특정 기간 동안의 이벤트 설정

## 2. 파라미터 관리 (Parameters)

리모트 컨피그의 기본 단위는 '파라미터(Parameter)'입니다. 각 파라미터는 고유한 키(Key)와 값을 가집니다.

### 파라미터 생성 및 수정
1. **Add Parameter** 버튼을 클릭합니다.
2. **Key**: 파라미터의 고유 식별자를 입력합니다. (예: `enable_winter_event`, `daily_max_dungeon_entry`)
3. **Type**: 값의 데이터 타입을 선택합니다.
   - `String`: 문자열
   - `Number`: 숫자
   - `Boolean`: 참/거짓 (True/False)
   - `JSON`: 복잡한 데이터 구조 (JSON 편집기 제공)
4. **Value**: 설정할 값을 입력합니다.
5. **Description**: 파라미터에 대한 설명을 입력합니다.

### 지원 데이터 타입
- **Boolean:** 기능의 활성화(ON)/비활성화(OFF)를 제어할 때 유용합니다.
- **JSON:** 보상 목록이나 복잡한 설정 값을 구조화된 형태로 관리할 수 있습니다. 문법 오류 시 저장이 방지됩니다.

---

## 3. 변경 사항 배포 (Deployment Process)

리모트 컨피그의 변경 사항은 즉시 반영되지 않고, "변경 대기(Pending Changes)" 상태를 거쳐 안전하게 배포됩니다.

### 변경 대기 (Pending Changes)
파라미터를 추가, 수정, 삭제하면 화면 상단에 **Pending Changes** 알림이 표시됩니다.
아직 실제 라이브(운영) 환경에는 반영되지 않은 상태입니다.

### 배포 하기 (Deploy Changes)
1. 상단의 **Deploy Changes** 버튼을 클릭합니다.
2. 배포될 변경 내역 목록(Type, Action, Item, Description)을 최종 확인합니다.
3. 확인 후 **Deploy**를 클릭하면 즉시 반영됩니다.

### 변경 취소 (Discard Changes)
실수로 변경한 내용이 있다면 **Discard Changes** 버튼을 눌러 모든 변경 대기 사항을 취소하고 원래 상태로 되돌릴 수 있습니다.

---

## 4. 캠페인 및 타겟팅 (Campaigns & Targeting)

특정 사용자 그룹(세그먼트)에게만 다른 값을 적용하거나, 기간 한정 이벤트를 설정할 때 캠페인을 사용합니다.
(현재 버전에서는 기능이 활성화되어 있지 않을 수 있습니다. 화면에 탭이 보이는 경우에만 사용 가능합니다.)

---

**이전 장:** [← 제 13장: 기획 데이터 관리](13-planning-data.md)  
**다음 장:** [제 15장: 서버 생명주기 관리 →](15-server-management.md)  
**처음으로:** [목차로 돌아가기](00-table-of-contents.md)
