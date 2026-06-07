const fs = require('fs');
const path = require('path');

const localesDir = 'C:\\work\\uwo\\gatrix\\packages\\frontend\\src\\locales';
const koFile = path.join(localesDir, 'ko.ini');
const enFile = path.join(localesDir, 'en.ini');
const zhFile = path.join(localesDir, 'zh.ini');

const newKoKeys = `
argus.settings.repoAdded=리포지토리가 추가되었습니다
argus.settings.repoAddFailed=리포지토리 추가에 실패했습니다
argus.settings.integrationSettings=연동 설정
argus.settings.configureIntegrationDesc=리포지토리를 추가하고 연동을 관리합니다
argus.settings.repositories=리포지토리
argus.settings.codeMappings=코드 매핑
argus.settings.connectedRepos=연결된 리포지토리
argus.settings.noConnectedRepos=연결된 리포지토리가 없습니다
argus.settings.addRepoHint=아래 목록에서 리포지토리를 찾아 추가하세요
argus.settings.availableRepos=추가 가능한 리포지토리
argus.settings.searchRepos=리포지토리 검색...
argus.settings.noReposFound=GitHub App이 접근할 수 있는 리포지토리가 없습니다.
argus.settings.noSearchResults=검색 결과가 없습니다
argus.settings.connected=연결됨
argus.settings.codeMappingsComingSoon=코드 매핑 기능은 곧 지원될 예정입니다.
argus.issues.aiAnalysis=AI 분석
argus.issues.viewTrace=Trace 보기
argus.issues.traceLoadFailed=Trace 정보를 불러오지 못했습니다.
argus.issues.sort=정렬
argus.settings.noActiveKeys=활성화된 키가 없습니다
argus.settings.integrationDisconnected=글로벌 App 연동이 해제되었습니다.
argus.settings.integrationDisconnectFailed=연동 해제에 실패했습니다.
argus.settings.integration=연동
argus.settings.integrationDesc={{name}} App이 설정되어 있습니다. 저장소를 연결하여 커밋, PR, 릴리스를 연동하세요.
argus.settings.addRepositoryConnection=저장소 연결 추가
argus.settings.disconnect=연동 해제
argus.settings.connectedStatus=연결 완료됨
argus.settings.addRepoHintGlobal=우측 상단의 '저장소 연결 추가' 버튼을 눌러 연동할 저장소를 선택하세요.
argus.settings.repository=저장소
argus.settings.defaultBranch=기본 브랜치
argus.settings.status=상태
argus.settings.connectedDate=연결일
argus.settings.disabledStatus=비활성화
argus.settings.appConnected=App 연동이 완료되었습니다.
`;

const newEnKeys = `
argus.settings.repoAdded=Repository added
argus.settings.repoAddFailed=Failed to add repository
argus.settings.integrationSettings=Integration Settings
argus.settings.configureIntegrationDesc=Add repositories and manage integration.
argus.settings.repositories=Repositories
argus.settings.codeMappings=Code Mappings
argus.settings.connectedRepos=Connected Repositories
argus.settings.noConnectedRepos=No repositories connected.
argus.settings.addRepoHint=Find a repository from the list below and add it
argus.settings.availableRepos=Available Repositories
argus.settings.searchRepos=Search repositories...
argus.settings.noReposFound=No repositories available for the GitHub App.
argus.settings.noSearchResults=No search results
argus.settings.connected=Connected
argus.settings.codeMappingsComingSoon=Code mapping feature will be supported soon.
argus.issues.aiAnalysis=AI Analysis
argus.issues.viewTrace=View Trace
argus.issues.traceLoadFailed=Failed to load trace information.
argus.issues.sort=Sort
argus.settings.noActiveKeys=No active keys found.
argus.settings.integrationDisconnected=Global App disconnected successfully.
argus.settings.integrationDisconnectFailed=Failed to disconnect.
argus.settings.integration=Integration
argus.settings.integrationDesc={{name}} App is configured. Connect repositories to link commits, PRs, and releases.
argus.settings.addRepositoryConnection=Add Repository
argus.settings.disconnect=Disconnect
argus.settings.connectedStatus=Connected
argus.settings.addRepoHintGlobal=Click 'Add Repository' button to select a repository to connect.
argus.settings.repository=Repository
argus.settings.defaultBranch=Default Branch
argus.settings.status=Status
argus.settings.connectedDate=Connected Date
argus.settings.disabledStatus=Disabled
argus.settings.appConnected=App connected successfully.
`;

fs.appendFileSync(koFile, '\\n' + newKoKeys.trim() + '\\n', 'utf8');
fs.appendFileSync(enFile, '\\n' + newEnKeys.trim() + '\\n', 'utf8');
fs.appendFileSync(zhFile, '\\n' + newEnKeys.trim() + '\\n', 'utf8');

console.log("Locales updated!");
