const mysql = require('mysql2/promise');
require('dotenv').config();

// 메시지 템플릿 타입들
const MESSAGE_TYPES = [
  'maintenance',
  'event',
  'announcement',
  'notification',
  'warning',
  'emergency',
  'update',
  'promotion'
];

// 온라인 게임 관련 메시지 템플릿들
const GAME_TEMPLATES = {
  maintenance: [
    {
      name: "정기 점검 안내",
      content: "안녕하세요. 더 나은 서비스 제공을 위해 정기 점검을 실시합니다. 점검 시간: {{startTime}} ~ {{endTime}}"
    },
    {
      name: "긴급 점검 공지",
      content: "긴급 점검으로 인해 일시적으로 서비스가 중단됩니다. 빠른 시일 내에 정상화하겠습니다."
    },
    {
      name: "서버 업데이트 점검",
      content: "서버 안정성 향상을 위한 업데이트 점검을 진행합니다. 이용에 불편을 드려 죄송합니다."
    },
    {
      name: "데이터베이스 최적화 점검",
      content: "게임 성능 향상을 위한 데이터베이스 최적화 작업을 진행합니다."
    },
    {
      name: "보안 패치 적용 점검",
      content: "보안 강화를 위한 패치 적용으로 인해 서비스가 일시 중단됩니다."
    }
  ],
  event: [
    {
      name: "신규 이벤트 시작",
      content: "🎉 새로운 이벤트가 시작되었습니다! 특별한 보상을 놓치지 마세요!"
    },
    {
      name: "더블 경험치 이벤트",
      content: "⚡ 더블 경험치 이벤트 진행 중! 이 기회를 놓치지 마세요!"
    },
    {
      name: "레어 아이템 드롭 이벤트",
      content: "💎 레어 아이템 드롭률이 2배 증가했습니다! 지금 바로 사냥을 시작하세요!"
    },
    {
      name: "길드 대전 이벤트",
      content: "⚔️ 길드 대전이 시작됩니다! 최강 길드를 가려보세요!"
    },
    {
      name: "시즌 이벤트 종료 안내",
      content: "🍂 가을 시즌 이벤트가 곧 종료됩니다. 마지막 기회를 놓치지 마세요!"
    }
  ],
  announcement: [
    {
      name: "신규 콘텐츠 업데이트",
      content: "🆕 새로운 던전과 보스가 추가되었습니다! 도전해보세요!"
    },
    {
      name: "밸런스 패치 안내",
      content: "⚖️ 게임 밸런스 조정이 적용되었습니다. 패치 노트를 확인해주세요."
    },
    {
      name: "신규 캐릭터 출시",
      content: "👤 새로운 캐릭터 클래스가 출시되었습니다! 지금 바로 체험해보세요!"
    },
    {
      name: "UI 개선 업데이트",
      content: "🎨 사용자 인터페이스가 더욱 편리하게 개선되었습니다."
    },
    {
      name: "커뮤니티 기능 추가",
      content: "💬 새로운 커뮤니티 기능이 추가되었습니다. 다른 플레이어들과 소통해보세요!"
    }
  ],
  notification: [
    {
      name: "친구 접속 알림",
      content: "👋 {{friendName}}님이 접속하셨습니다!"
    },
    {
      name: "길드 초대 알림",
      content: "🏰 {{guildName}} 길드에서 초대장을 보냈습니다."
    },
    {
      name: "레벨업 축하",
      content: "🎊 축하합니다! 레벨 {{level}}에 도달하셨습니다!"
    },
    {
      name: "퀘스트 완료 알림",
      content: "✅ 퀘스트 '{{questName}}'을 완료하셨습니다!"
    },
    {
      name: "아이템 획득 알림",
      content: "💰 {{itemName}}을(를) 획득하셨습니다!"
    }
  ],
  warning: [
    {
      name: "계정 보안 경고",
      content: "⚠️ 비정상적인 접속이 감지되었습니다. 비밀번호를 변경해주세요."
    },
    {
      name: "부정 행위 경고",
      content: "🚫 부정 행위가 감지되었습니다. 계정 제재 조치가 취해질 수 있습니다."
    },
    {
      name: "연결 불안정 경고",
      content: "📶 네트워크 연결이 불안정합니다. 연결을 확인해주세요."
    },
    {
      name: "과도한 접속 시도 경고",
      content: "🔒 과도한 로그인 시도로 인해 계정이 일시 잠금되었습니다."
    },
    {
      name: "계정 만료 경고",
      content: "⏰ 계정 유효기간이 {{days}}일 남았습니다. 갱신해주세요."
    }
  ],
  emergency: [
    {
      name: "서버 장애 긴급 공지",
      content: "🚨 서버 장애로 인해 서비스가 불안정합니다. 복구 작업 중입니다."
    },
    {
      name: "보안 침해 긴급 대응",
      content: "🔐 보안 침해가 감지되어 긴급 보안 조치를 시행합니다."
    },
    {
      name: "데이터 손실 방지 조치",
      content: "💾 데이터 보호를 위해 긴급 백업 작업을 진행합니다."
    },
    {
      name: "DDoS 공격 대응",
      content: "🛡️ DDoS 공격으로 인한 서비스 지연이 발생할 수 있습니다."
    },
    {
      name: "결제 시스템 장애",
      content: "💳 결제 시스템 장애로 인해 일시적으로 결제가 불가능합니다."
    }
  ],
  update: [
    {
      name: "클라이언트 업데이트 필수",
      content: "📱 새로운 버전이 출시되었습니다. 업데이트 후 이용해주세요."
    },
    {
      name: "게임 엔진 업그레이드",
      content: "🔧 게임 엔진이 업그레이드되어 더욱 부드러운 게임플레이를 제공합니다."
    },
    {
      name: "그래픽 개선 업데이트",
      content: "🎮 그래픽 품질이 향상되었습니다. 더욱 생생한 게임을 즐겨보세요!"
    },
    {
      name: "버그 수정 업데이트",
      content: "🐛 여러 버그가 수정되어 게임이 더욱 안정적으로 동작합니다."
    },
    {
      name: "성능 최적화 업데이트",
      content: "⚡ 게임 성능이 최적화되어 더욱 빠르고 쾌적한 플레이가 가능합니다."
    }
  ],
  promotion: [
    {
      name: "신규 유저 혜택",
      content: "🎁 신규 가입 축하! 특별 아이템을 받아가세요!"
    },
    {
      name: "VIP 멤버십 혜택",
      content: "👑 VIP 멤버십 가입 시 독점 혜택을 누리세요!"
    },
    {
      name: "할인 이벤트 진행",
      content: "💸 모든 아이템 50% 할인! 지금이 기회입니다!"
    },
    {
      name: "프리미엄 패스 출시",
      content: "🎫 프리미엄 패스로 더 많은 보상을 획득하세요!"
    },
    {
      name: "친구 추천 이벤트",
      content: "👥 친구를 추천하고 특별 보상을 받아보세요!"
    }
  ]
};

// 추가 상세 템플릿들
const DETAILED_TEMPLATES = {
  maintenance: [
    "서버 하드웨어 교체 작업", "네트워크 인프라 업그레이드", "데이터센터 이전 작업",
    "백업 시스템 점검", "로드밸런서 설정 변경", "CDN 최적화 작업",
    "SSL 인증서 갱신", "방화벽 규칙 업데이트", "모니터링 시스템 점검",
    "로그 시스템 정리", "캐시 서버 최적화", "API 서버 업데이트"
  ],
  event: [
    "크리스마스 특별 이벤트", "신년 맞이 이벤트", "발렌타인데이 이벤트",
    "화이트데이 이벤트", "어린이날 이벤트", "어버이날 감사 이벤트",
    "여름 휴가철 이벤트", "추석 연휴 이벤트", "할로윈 특별 이벤트",
    "블랙프라이데이 세일", "사이버먼데이 할인", "연말 감사 이벤트"
  ],
  announcement: [
    "신규 던전 오픈", "PvP 시스템 개편", "길드 시스템 업데이트",
    "펫 시스템 추가", "탈것 시스템 도입", "하우징 시스템 오픈",
    "크래프팅 시스템 개선", "경매장 시스템 업데이트", "친구 시스템 확장",
    "채팅 시스템 개선", "인벤토리 확장", "스킬 트리 개편"
  ],
  notification: [
    "일일 퀘스트 완료", "주간 퀘스트 완료", "월간 미션 달성",
    "업적 달성 알림", "타이틀 획득", "랭킹 순위 변동",
    "길드 레벨업", "길드 멤버 가입", "길드 이벤트 시작",
    "친구 생일 알림", "접속 보상 수령", "출석 체크 완료"
  ],
  warning: [
    "계정 해킹 시도 감지", "비정상적인 게임 플레이 패턴", "매크로 사용 의심",
    "RMT 거래 의심", "욕설 및 비방 경고", "스팸 메시지 발송 경고",
    "계정 공유 의심", "IP 변경 감지", "다중 계정 의심",
    "게임 내 사기 신고", "부적절한 닉네임 사용", "커뮤니티 가이드라인 위반"
  ],
  emergency: [
    "해킹 공격 탐지", "서버 과부하 상황", "데이터베이스 오류",
    "결제 시스템 오류", "로그인 서버 장애", "게임 서버 크래시",
    "네트워크 연결 장애", "보안 취약점 발견", "개인정보 유출 의심",
    "시스템 리소스 부족", "백업 시스템 실패", "모니터링 시스템 알람"
  ],
  update: [
    "모바일 앱 업데이트", "웹 클라이언트 업데이트", "게임 런처 업데이트",
    "그래픽 드라이버 호환성", "운영체제 호환성 개선", "메모리 사용량 최적화",
    "배터리 소모량 개선", "네트워크 연결 안정성", "터치 인터페이스 개선",
    "키보드 단축키 추가", "마우스 감도 설정", "화면 해상도 지원"
  ],
  promotion: [
    "첫 구매 50% 할인", "주말 특가 이벤트", "월말 정산 세일",
    "신규 아이템 출시 기념", "업데이트 기념 할인", "서버 오픈 기념",
    "플레이어 수 돌파 기념", "리뷰 이벤트 참여", "SNS 공유 이벤트",
    "스트리밍 시청 이벤트", "커뮤니티 참여 보상", "베타 테스터 감사"
  ]
};

// 추가 템플릿 생성 함수
function generateAdditionalTemplates() {
  const templates = [];
  let counter = 1;

  // 기본 템플릿들 추가
  Object.keys(GAME_TEMPLATES).forEach(type => {
    const baseTemplates = GAME_TEMPLATES[type];

    baseTemplates.forEach(template => {
      templates.push({
        name: `${template.name}_${counter++}`,
        type: type,
        content: template.content
      });
    });
  });

  // 상세 템플릿들 추가
  Object.keys(DETAILED_TEMPLATES).forEach(type => {
    const detailTemplates = DETAILED_TEMPLATES[type];

    detailTemplates.forEach((templateName, index) => {
      templates.push({
        name: `${templateName}_${counter++}`,
        type: type,
        content: generateDetailedContent(templateName, type)
      });
    });
  });

  // 추가 변형 템플릿들 생성 (1000개까지 채우기)
  while (templates.length < 1000) {
    const randomType = MESSAGE_TYPES[Math.floor(Math.random() * MESSAGE_TYPES.length)];
    const randomNumber = Math.floor(Math.random() * 1000) + 1;

    templates.push({
      name: `자동생성_${randomType}_템플릿_${randomNumber}_${counter++}`,
      type: randomType,
      content: generateRandomContent(randomType, randomNumber)
    });
  }

  return templates.slice(0, 1000); // 정확히 1000개만 반환
}

function generateDetailedContent(templateName, type) {
  const contentTemplates = {
    maintenance: [
      `${templateName} 작업을 진행합니다. 예상 소요 시간: {{duration}}분`,
      `${templateName}으로 인해 서비스가 일시 중단됩니다. 양해 부탁드립니다.`,
      `${templateName} 완료 후 더욱 안정적인 서비스를 제공하겠습니다.`,
      `${templateName} 진행 중입니다. 진행 상황은 공지사항에서 확인하세요.`
    ],
    event: [
      `🎉 ${templateName}이 시작되었습니다! 특별 보상을 놓치지 마세요!`,
      `⭐ ${templateName} 기간: {{startDate}} ~ {{endDate}}`,
      `🎁 ${templateName} 참여 시 독점 아이템을 획득하세요!`,
      `🏆 ${templateName}에서 최고 순위를 달성해보세요!`
    ],
    announcement: [
      `📢 ${templateName}에 대한 안내입니다.`,
      `🆕 ${templateName}이 업데이트되었습니다. 자세한 내용을 확인하세요.`,
      `✨ ${templateName}으로 게임이 더욱 재미있어집니다!`,
      `🔧 ${templateName}을 통해 사용자 경험이 개선됩니다.`
    ],
    notification: [
      `✅ ${templateName}되었습니다!`,
      `🔔 ${templateName} 알림: 확인해주세요.`,
      `📬 ${templateName} 관련 새로운 소식이 있습니다.`,
      `⏰ ${templateName} 시간이 되었습니다.`
    ],
    warning: [
      `⚠️ ${templateName}이 감지되었습니다. 주의하세요.`,
      `🚨 ${templateName}으로 인한 보안 경고입니다.`,
      `❗ ${templateName} 관련 중요한 알림입니다.`,
      `🔒 ${templateName}으로 인해 계정 보안 조치가 필요합니다.`
    ],
    emergency: [
      `🚨 긴급: ${templateName}이 발생했습니다.`,
      `⚡ ${templateName}으로 인한 긴급 상황입니다.`,
      `🔴 ${templateName} 대응 중입니다. 잠시만 기다려주세요.`,
      `🆘 ${templateName} 해결을 위해 최선을 다하고 있습니다.`
    ],
    update: [
      `📱 ${templateName}이 완료되었습니다.`,
      `🔄 ${templateName}을 적용해주세요.`,
      `⬆️ ${templateName}으로 성능이 향상됩니다.`,
      `🛠️ ${templateName} 후 재시작이 필요할 수 있습니다.`
    ],
    promotion: [
      `💰 ${templateName}! 지금 바로 확인하세요!`,
      `🎯 ${templateName} 기회를 놓치지 마세요!`,
      `💎 ${templateName}으로 특별한 혜택을 받으세요!`,
      `🌟 ${templateName} 한정 시간 동안만 제공됩니다!`
    ]
  };

  const templates = contentTemplates[type] || contentTemplates.announcement;
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateRandomContent(type, number) {
  const randomContents = {
    maintenance: [
      `시스템 점검 ${number}번째 작업을 진행합니다.`,
      `서버 최적화 작업 #${number}을 실시합니다.`,
      `정기 점검 ${number}차를 진행합니다.`,
      `보안 업데이트 ${number}번을 적용합니다.`
    ],
    event: [
      `특별 이벤트 #${number}이 시작됩니다!`,
      `시즌 ${number} 이벤트에 참여하세요!`,
      `한정 이벤트 ${number}번째 기회입니다!`,
      `이벤트 ${number}: 놓치면 후회할 보상!`
    ],
    announcement: [
      `공지사항 ${number}: 중요한 업데이트입니다.`,
      `알림 ${number}번: 새로운 소식을 확인하세요.`,
      `업데이트 ${number}: 게임이 더욱 재미있어집니다.`,
      `소식 ${number}: 플레이어 여러분께 알려드립니다.`
    ],
    notification: [
      `알림 ${number}: 새로운 활동이 있습니다.`,
      `메시지 ${number}: 확인이 필요합니다.`,
      `업데이트 ${number}: 상태가 변경되었습니다.`,
      `정보 ${number}: 새로운 정보가 도착했습니다.`
    ],
    warning: [
      `경고 ${number}: 주의가 필요한 상황입니다.`,
      `주의 ${number}: 보안 관련 알림입니다.`,
      `위험 ${number}: 즉시 확인이 필요합니다.`,
      `경고 메시지 ${number}: 중요한 보안 알림입니다.`
    ],
    emergency: [
      `긴급 ${number}: 즉시 대응이 필요합니다.`,
      `응급 상황 ${number}: 긴급 조치 중입니다.`,
      `위급 ${number}: 시스템 복구 작업 중입니다.`,
      `긴급 알림 ${number}: 서비스 장애 대응 중입니다.`
    ],
    update: [
      `업데이트 ${number}: 새로운 버전이 출시되었습니다.`,
      `패치 ${number}: 개선사항이 적용되었습니다.`,
      `버전 ${number}: 업그레이드가 완료되었습니다.`,
      `릴리즈 ${number}: 새로운 기능이 추가되었습니다.`
    ],
    promotion: [
      `프로모션 ${number}: 특별 할인 혜택!`,
      `이벤트 ${number}: 한정 시간 특가!`,
      `세일 ${number}: 놓치면 후회할 기회!`,
      `혜택 ${number}: 독점 보상을 받으세요!`
    ]
  };

  const contents = randomContents[type] || randomContents.announcement;
  return contents[Math.floor(Math.random() * contents.length)];
}

function generateVariation(baseContent, type) {
  const variations = {
    maintenance: [
      "서비스 품질 향상을 위한 점검을 진행합니다.",
      "시스템 안정성 확보를 위해 점검을 실시합니다.",
      "더 나은 게임 환경 제공을 위한 점검 작업입니다.",
      "서버 성능 최적화를 위한 점검을 진행합니다.",
      "보안 강화 및 안정성 향상을 위한 점검입니다."
    ],
    event: [
      "특별한 이벤트가 진행됩니다! 놓치지 마세요!",
      "한정 시간 이벤트가 시작되었습니다!",
      "독점 보상을 획득할 수 있는 기회입니다!",
      "이번 주 특별 이벤트에 참여해보세요!",
      "시즌 한정 이벤트가 진행 중입니다!"
    ],
    announcement: [
      "중요한 업데이트 소식을 알려드립니다.",
      "새로운 기능이 추가되었습니다.",
      "게임 시스템이 개선되었습니다.",
      "플레이어 경험 향상을 위한 업데이트입니다.",
      "커뮤니티 피드백을 반영한 개선사항입니다."
    ]
  };

  const typeVariations = variations[type] || variations.announcement;
  return typeVariations[Math.floor(Math.random() * typeVariations.length)];
}

async function main() {
  let connection;
  
  try {
    // 데이터베이스 연결
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'uwo_gate'
    });

    console.log('데이터베이스에 연결되었습니다.');

    // 기존 템플릿 수 확인
    const [existingCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM g_message_templates'
    );
    console.log(`기존 템플릿 수: ${existingCount[0].count}`);

    // 관리자 사용자 ID 가져오기
    const [users] = await connection.execute(
      'SELECT id FROM g_users WHERE role = "admin" LIMIT 1'
    );
    
    if (users.length === 0) {
      console.error('관리자 사용자를 찾을 수 없습니다.');
      return;
    }

    const adminUserId = users[0].id;
    console.log(`관리자 사용자 ID: ${adminUserId}`);

    // 1000개의 템플릿 생성
    const templates = generateAdditionalTemplates();
    
    // 1000개까지 제한
    const templatesTo1000 = templates.slice(0, 1000);
    
    console.log(`${templatesTo1000.length}개의 템플릿을 생성합니다...`);

    // 배치로 삽입 (100개씩)
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < templatesTo1000.length; i += batchSize) {
      const batch = templatesTo1000.slice(i, i + batchSize);
      
      const values = batch.map(template => [
        template.name,
        template.type,
        true, // isEnabled
        false, // supportsMultiLanguage
        template.content, // defaultMessage
        adminUserId, // createdBy
        adminUserId, // updatedBy
        new Date(),
        new Date()
      ]);

      await connection.query(
        `INSERT INTO g_message_templates 
         (name, type, isEnabled, supportsMultiLanguage, defaultMessage, createdBy, updatedBy, createdAt, updatedAt) 
         VALUES ?`,
        [values]
      );

      inserted += batch.length;
      console.log(`${inserted}/${templatesTo1000.length} 템플릿 삽입 완료`);
    }

    console.log('✅ 모든 메시지 템플릿이 성공적으로 추가되었습니다!');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('데이터베이스 연결이 종료되었습니다.');
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateAdditionalTemplates, generateVariation };
