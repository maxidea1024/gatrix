# 제 15장: 서버 생명주기 관리 (Server Lifecycle Management)

게임 서버들의 실행, 종료, 오류 등 생명 주기 이벤트(Lifecycle Events)를 모니터링하는 대시보드입니다.

**경로:** 관리자 (Admin) → 서버 생명주기 (Server Lifecycle)  
**필요 권한:** `server-lifecycle_view`

---

## 1. 이벤트 모니터링

각 서버 인스턴스에서 발생하는 주요 이벤트를 실시간으로 수집하여 보여줍니다.

### 주요 이벤트 타입 (Event Types)
- **INITIALIZING:** 서버가 시작되어 초기화 중인 단계
- **READY:** 초기화가 완료되어 정상 서비스가 가능한 상태
- **SHUTTING_DOWN:** 정상적인 종료 절차가 진행 중인 상태
- **TERMINATED:** 서버가 완전히 종료된 상태
- **ERROR:** 서버 실행 중 오류가 발생한 상태

---

## 2. 상세 정보 확인

목록의 각 항목을 클릭하면 해당 이벤트의 상세 정보를 볼 수 있습니다.

- **기본 정보:** Instance ID, Service Type, Group, Hostname
- **네트워크:** Internal/External Address, Ports
- **클라우드:** Cloud Provider, Region, Zone
- **버전:** App Version, SDK Version
- **오류 정보:** Error가 발생한 경우, 오류 메시지(Show Error)와 호출 스택(Stack Trace)을 확인할 수 있어 디버깅에 유용합니다.

---

## 3. 필터 및 검색

수많은 서버 로그 중에서 원하는 정보를 찾기 위해 다양한 필터를 제공합니다.
- **Service Type:** 특정 종류의 서버(예: `login-server`, `game-server`)만 조회
- **Event Type:** 특정 상태(예: `ERROR`만 필터링) 조회
- **Instance ID / Hostname:** 특정 서버 인스턴스 추적

---

**이전 장:** [← 제 14장: 리모트 컨피그](14-remote-config.md)  
**다음 장:** [제 16장: 문제 해결 및 FAQ →](16-troubleshooting.md)
