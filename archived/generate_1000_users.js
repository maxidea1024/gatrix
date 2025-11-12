// 1000명의 테스트 사용자 생성 스크립트
const fs = require('fs');

// 한국 성씨와 이름 목록
const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전', '홍', '고', '문', '양', '손', '배', '조', '백', '허', '유', '남', '심', '노', '정', '하', '곽', '성', '차', '주', '우', '구', '신', '임', '나', '전', '민', '유', '진', '지', '엄', '채', '원', '천', '방', '공', '강', '현', '함', '변', '염', '양', '변', '여', '추', '노', '도', '소', '신', '석', '선', '설', '마', '길', '주', '연', '방', '위', '표', '명', '기', '반', '왕', '금', '옥', '육', '인', '맹', '제', '모', '장', '남', '탁', '국', '여', '진', '어', '은', '편', '구', '용'];

const maleNames = ['민수', '영수', '철수', '현우', '태호', '동민', '성훈', '재원', '세라', '길동', '준호', '성민', '준석', '도현', '시우', '민재', '건우', '태윤', '준영', '민서', '서진', '준혁', '현수', '민규', '도윤', '하준', '지훈', '승현', '태민', '준서', '시현', '도영', '재현', '민준', '서준', '지훈', '준우', '성준', '우성', '지호', '준혁', '태영', '동현', '민혁', '시원', '도현', '지성'];

const femaleNames = ['영희', '지영', '수진', '소영', '미라', '현정', '세라', '예린', '아름', '다은', '수빈', '하늘', '서연', '채원', '소율', '예은', '유진', '가은', '다인', '소희', '예나', '지우', '시은', '하린', '예린', '서윤', '유리', '서현', '수아', '하은', '지민', '수진', '나연', '서연', '채영', '아린', '소민', '하은', '지수', '예원', '서영', '다은', '서연', '지수', '예원', '서영', '다은'];

const statuses = ['active', 'pending', 'suspended'];
const emailVerified = [0, 1];

// 영어 이름 변환 함수
function toEnglishName(koreanName) {
  const nameMap = {
    '김': 'kim', '이': 'lee', '박': 'park', '최': 'choi', '정': 'jung', '강': 'kang', '조': 'cho', '윤': 'yoon', '장': 'jang', '임': 'lim', '한': 'han', '오': 'oh', '서': 'seo', '신': 'shin', '권': 'kwon', '황': 'hwang', '안': 'ahn', '송': 'song', '류': 'ryu', '전': 'jeon', '홍': 'hong', '고': 'ko', '문': 'moon', '양': 'yang', '손': 'son', '배': 'bae', '백': 'baek', '허': 'heo', '유': 'yoo', '남': 'nam', '심': 'sim', '노': 'noh', '하': 'ha', '곽': 'kwak', '성': 'sung', '차': 'cha', '주': 'joo', '우': 'woo', '구': 'koo', '나': 'na', '민': 'min', '진': 'jin', '지': 'ji', '엄': 'eom', '채': 'chae', '원': 'won', '천': 'cheon', '방': 'bang', '공': 'kong', '현': 'hyun', '함': 'ham', '변': 'byun', '염': 'yeom', '여': 'yeo', '추': 'chu', '도': 'do', '소': 'so', '석': 'seok', '선': 'sun', '설': 'seol', '마': 'ma', '길': 'gil', '연': 'yeon', '위': 'wi', '표': 'pyo', '명': 'myung', '기': 'ki', '반': 'ban', '왕': 'wang', '금': 'keum', '옥': 'ok', '육': 'yook', '인': 'in', '맹': 'maeng', '제': 'je', '모': 'mo', '탁': 'tak', '국': 'kook', '어': 'eo', '은': 'eun', '편': 'pyun', '용': 'yong',
    '민수': 'minsu', '영수': 'youngsu', '철수': 'cheolsu', '현우': 'hyunwoo', '태호': 'taeho', '동민': 'dongmin', '성훈': 'sunghoon', '재원': 'jaewon', '길동': 'gildong', '준호': 'junho', '성민': 'seongmin', '준석': 'junseok', '도현': 'dohyun', '시우': 'siwoo', '민재': 'minjae', '건우': 'gunwoo', '태윤': 'taeyoon', '준영': 'junyoung', '민서': 'minseo', '서진': 'seojin', '준혁': 'junhyuk', '현수': 'hyunsu', '민규': 'mingyu', '도윤': 'doyoon', '하준': 'hajun', '지훈': 'jihoon', '승현': 'seunghyun', '태민': 'taemin', '준서': 'junseo', '시현': 'sihyun', '도영': 'doyoung', '재현': 'jaehyun', '민준': 'minjun', '서준': 'seojun', '준우': 'junwoo', '성준': 'sungjun', '우성': 'woosung', '지호': 'jiho', '태영': 'taeyoung', '동현': 'donghyun', '민혁': 'minhyuk', '시원': 'siwon', '지성': 'jisung',
    '영희': 'younghee', '지영': 'jiyoung', '수진': 'sujin', '소영': 'soyoung', '미라': 'mira', '현정': 'hyunjung', '세라': 'sera', '예린': 'yerin', '아름': 'areum', '다은': 'daeun', '수빈': 'subin', '하늘': 'haneul', '서연': 'seoyeon', '채원': 'chaewon', '소율': 'soyul', '예은': 'yeeun', '유진': 'yujin', '가은': 'gaeun', '다인': 'dain', '소희': 'sohee', '예나': 'yena', '지우': 'jiwoo', '시은': 'sieun', '하린': 'harin', '서윤': 'seoyoon', '유리': 'yuri', '서현': 'seohyun', '수아': 'sua', '하은': 'haeun', '지민': 'jimin', '나연': 'nayeon', '채영': 'chaeyoung', '아린': 'arin', '소민': 'somin', '지수': 'jisu', '예원': 'yewon', '서영': 'seoyoung'
  };
  
  return nameMap[koreanName] || koreanName.toLowerCase();
}

// 랜덤 선택 함수
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// SQL 생성
let sql = "-- 1000명의 테스트 사용자 생성\nINSERT INTO g_users (name, email, passwordHash, role, status, emailVerified, createdAt, updatedAt) VALUES\n";

const users = [];
for (let i = 1; i <= 1000; i++) {
  const surname = getRandomItem(surnames);
  const firstName = Math.random() > 0.5 ? getRandomItem(maleNames) : getRandomItem(femaleNames);
  const koreanName = surname + firstName;

  const englishSurname = toEnglishName(surname);
  const englishFirstName = toEnglishName(firstName);
  const email = `${englishSurname}.${englishFirstName}${i}@gatrix.com`;

  // status는 active, inactive, deleted 중 하나 (pending은 없음)
  const validStatuses = ['active', 'inactive'];
  const status = getRandomItem(validStatuses);
  const verified = getRandomItem(emailVerified);

  const userSql = `('${koreanName}', '${email}', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', '${status}', ${verified}, NOW(), NOW())`;

  users.push(userSql);
}

sql += users.join(',\n') + ';';

// 파일 저장
fs.writeFileSync('insert_1000_users.sql', sql);
console.log('1000명의 사용자 SQL 파일이 생성되었습니다: insert_1000_users.sql');
