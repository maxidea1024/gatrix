const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';
const files = ['ko.json', 'en.json', 'zh.json'];

const serverLifecycleKeys = {
    ko: {
        sidebar: '서버 실행 이력',
        object: {
            title: '서버 실행 이력',
            subtitle: '서버의 상태 변화 이력을 모니터링합니다.',
            searchPlaceholder: '서비스 타입, 인스턴스 ID로 검색...',
            eventType: '이벤트 타입',
            service: '서비스',
            group: '그룹',
            uptime: '업타임',
            heartbeats: '하트비트',
            timestamp: '발생 시각',
            details: '상세 정보',
            metadata: '메타데이터',
            instanceId: '인스턴스 ID',
            environment: '환경',
            cloudInfo: '클라우드 정보',
            error: '오류 메시지',
            callStack: '콜 스택',
            noEvents: '표시할 이벤트가 없습니다.',
            filters: {
                serviceType: '서비스 타입',
                instanceId: '인스턴스 ID',
                eventType: '이벤트 타입'
            }
        },
        refreshed: '새로고침됨'
    },
    en: {
        sidebar: 'Server LifeCycle',
        object: {
            title: 'Server LifeCycle Events',
            subtitle: 'Monitor server status change history.',
            searchPlaceholder: 'Search by service type, instance ID...',
            eventType: 'Event Type',
            service: 'Service',
            group: 'Group',
            uptime: 'Uptime',
            heartbeats: 'Heartbeats',
            timestamp: 'Timestamp',
            details: 'Details',
            metadata: 'Metadata',
            instanceId: 'Instance ID',
            environment: 'Environment',
            cloudInfo: 'Cloud Information',
            error: 'Error Message',
            callStack: 'Call Stack',
            noEvents: 'No events to display.',
            filters: {
                serviceType: 'Service Type',
                instanceId: 'Instance ID',
                eventType: 'Event Type'
            }
        },
        refreshed: 'Refreshed'
    },
    zh: {
        sidebar: '服务器运行历史',
        object: {
            title: '服务器生命周期事件',
            subtitle: '监控服务器状态变化历史。',
            searchPlaceholder: '按服务类型、实例ID搜索...',
            eventType: '事件类型',
            service: '服务',
            group: '分组',
            uptime: '运行时间',
            heartbeats: '心跳',
            timestamp: '发生时间',
            details: '详细信息',
            metadata: '元数据',
            instanceId: '实例 ID',
            environment: '环境',
            cloudInfo: '云信息',
            error: '错误信息',
            callStack: '调用堆栈',
            noEvents: '没有可显示的事件。',
            filters: {
                serviceType: '服务类型',
                instanceId: '实例 ID',
                eventType: '事件类型'
            }
        },
        refreshed: '已刷新'
    }
};

// Also add common.columnSettings if missing
const commonKeys = {
    ko: { columnSettings: '컬럼 설정' },
    en: { columnSettings: 'Column Settings' },
    zh: { columnSettings: '列设置' }
};

files.forEach(file => {
    const lang = file.split('.')[0];
    const filePath = path.join(localesDir, file);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);

    if (!parsed.sidebar) parsed.sidebar = {};
    parsed.sidebar.serverLifecycle = serverLifecycleKeys[lang].sidebar;

    if (!parsed.common) parsed.common = {};
    parsed.common.refreshed = serverLifecycleKeys[lang].refreshed;
    if (!parsed.common.columnSettings) {
        parsed.common.columnSettings = commonKeys[lang].columnSettings;
    }

    parsed.serverLifecycle = serverLifecycleKeys[lang].object;

    delete parsed['sidebar.serverLifecycle'];

    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n');
    console.log(`Updated ${file}`);
});
