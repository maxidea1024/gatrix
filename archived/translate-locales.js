/**
 * Translate ko.json to en.json and zh.json
 * This script reads ko.json and creates translated versions
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../packages/frontend/src/locales');
const koPath = path.join(localesDir, 'ko.json');

// Read Korean JSON
const koContent = fs.readFileSync(koPath, 'utf8');
const koJson = JSON.parse(koContent);

// Simple translation dictionary for common Korean -> English
const koToEn = {
  // Common
  확인: 'Confirm',
  취소: 'Cancel',
  저장: 'Save',
  삭제: 'Delete',
  수정: 'Edit',
  생성: 'Create',
  추가: 'Add',
  닫기: 'Close',
  검색: 'Search',
  필터: 'Filter',
  전체: 'All',
  활성: 'Active',
  비활성: 'Inactive',
  예: 'Yes',
  아니오: 'No',
  로딩중: 'Loading',
  '저장 중': 'Saving',
  오류: 'Error',
  성공: 'Success',
  경고: 'Warning',
  정보: 'Info',
  없음: 'None',
  '알 수 없음': 'Unknown',
  필수: 'Required',
  선택: 'Optional',
  이름: 'Name',
  설명: 'Description',
  상태: 'Status',
  작업: 'Actions',
  날짜: 'Date',
  시간: 'Time',
  유형: 'Type',
  값: 'Value',
  필드: 'Field',
  제목: 'Title',
  내용: 'Content',
  카테고리: 'Category',
  우선순위: 'Priority',
  저장됨: 'Saved',
  삭제됨: 'Deleted',
  수정됨: 'Updated',
  생성됨: 'Created',

  // Change Request specific
  '변경 요청': 'Change Request',
  '변경 요청이': 'Change request',
  초안: 'Draft',
  검토중: 'Open',
  승인됨: 'Approved',
  적용됨: 'Applied',
  거절됨: 'Rejected',
  거부됨: 'Rejected',
  거부: 'Reject',
  거절: 'Reject',
  승인: 'Approve',
  제출: 'Submit',
  재오픈: 'Reopen',
  적용: 'Execute',
  거부자: 'Rejected By',
  '거부 일시': 'Rejected At',
  '거부 사유': 'Rejection Reason',
  '거부 정보': 'Rejection Info',
  '클릭하여 검토하세요': 'Click to review',
  '승인 대기 중인 변경 요청이': 'change request(s) pending review',
  '건 있습니다': '',
  '승인 후 적용됩니다': 'Will be applied after approval',
  요청자: 'Requester',
  '승인 현황': 'Approval Progress',
  '최종 수정': 'Last Updated',
  '항목 수': 'Items',
  '변경 항목': 'Change Items',
  '대상 테이블': 'Target Table',
  '대상 ID': 'Target ID',
  '승인 내역': 'Approvals',
  '영향 분석': 'Impact Analysis',
  '이전 값': 'Previous',
  '변경 후': 'New Value',
  '변경사항이 없습니다': 'No changes',
  '전체 보기': 'Show All',
  '변경사항만 보기': 'Changes Only',
  삭제하시겠습니까: 'Delete?',
  낮음: 'Low',
  보통: 'Medium',
  높음: 'High',
  긴급: 'Critical',
  '거절 사유를 입력해주세요': 'Please enter rejection reason',
  '다시 제출할 수 있습니다': 'can revise and resubmit',
  '수정 후 다시 제출하시겠습니까': 'Modify and resubmit?',
  '제목과 변경 사유를 모두 입력해주세요': 'Please enter both title and reason',
  '제목과 변경 사유를 입력해주세요': 'Enter title and reason to submit',
  '변경 사유': 'Reason',
};

// Korean -> Chinese simple mapping
const koToZh = {
  // Common
  확인: '确认',
  취소: '取消',
  저장: '保存',
  삭제: '删除',
  수정: '编辑',
  생성: '创建',
  추가: '添加',
  닫기: '关闭',
  검색: '搜索',
  필터: '筛选',
  전체: '全部',
  활성: '启用',
  비활성: '停用',
  예: '是',
  아니오: '否',
  로딩중: '加载中',
  '저장 중': '保存中',
  오류: '错误',
  성공: '成功',
  경고: '警告',
  정보: '信息',
  없음: '无',
  '알 수 없음': '未知',
  필수: '必填',
  선택: '可选',
  이름: '名称',
  설명: '描述',
  상태: '状态',
  작업: '操作',
  날짜: '日期',
  시간: '时间',
  유형: '类型',
  값: '值',
  필드: '字段',
  제목: '标题',
  내용: '内容',
  카테고리: '类别',
  우선순위: '优先级',
  저장됨: '已保存',
  삭제됨: '已删除',
  수정됨: '已更新',
  생성됨: '已创建',

  // Change Request specific
  '변경 요청': '变更请求',
  '변경 요청이': '变更请求',
  초안: '草稿',
  검토중: '审核中',
  승인됨: '已批准',
  적용됨: '已应用',
  거절됨: '已拒绝',
  거부됨: '已拒绝',
  거부: '拒绝',
  거절: '拒绝',
  승인: '批准',
  제출: '提交',
  재오픈: '重新打开',
  적용: '执行',
  거부자: '拒绝人',
  '거부 일시': '拒绝时间',
  '거부 사유': '拒绝原因',
  '거부 정보': '拒绝信息',
  '클릭하여 검토하세요': '点击查看',
  '승인 대기 중인 변경 요청이': '个变更请求待审核',
  '건 있습니다': '',
  '승인 후 적용됩니다': '批准后将应用',
  요청자: '请求人',
  '승인 현황': '审批进度',
  '최종 수정': '最后更新',
  '항목 수': '项目数',
  '변경 항목': '变更项',
  '대상 테이블': '目标表',
  '대상 ID': '目标ID',
  '승인 내역': '审批记录',
  '영향 분석': '影响分析',
  '이전 값': '原值',
  '변경 후': '新值',
  '변경사항이 없습니다': '无变更',
  '전체 보기': '全部显示',
  '변경사항만 보기': '仅显示变更',
  삭제하시겠습니까: '确定删除？',
  낮음: '低',
  보통: '中',
  높음: '高',
  긴급: '紧急',
  '거절 사유를 입력해주세요': '请输入拒绝原因',
  '다시 제출할 수 있습니다': '可以修改后重新提交',
  '수정 후 다시 제출하시겠습니까': '修改后重新提交？',
  '제목과 변경 사유를 모두 입력해주세요': '请输入标题和原因',
  '제목과 변경 사유를 입력해주세요': '输入标题和原因以提交',
  '변경 사유': '变更原因',
};

function translateValue(value, dict) {
  if (typeof value !== 'string') return value;

  let result = value;
  // Sort by length descending to replace longer phrases first
  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

  for (const ko of sortedKeys) {
    if (result.includes(ko)) {
      result = result.replace(new RegExp(ko, 'g'), dict[ko]);
    }
  }
  return result;
}

function translateObject(obj, dict) {
  if (typeof obj === 'string') {
    return translateValue(obj, dict);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => translateObject(item, dict));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = translateObject(obj[key], dict);
    }
    return result;
  }
  return obj;
}

// Create English version
const enJson = translateObject(koJson, koToEn);
fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(enJson, null, 2), 'utf8');
console.log('Created en.json');

// Create Chinese version
const zhJson = translateObject(koJson, koToZh);
fs.writeFileSync(path.join(localesDir, 'zh.json'), JSON.stringify(zhJson, null, 2), 'utf8');
console.log('Created zh.json');

console.log('Translation complete!');
