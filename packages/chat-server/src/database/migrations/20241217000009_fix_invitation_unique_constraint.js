exports.up = function(knex) {
  // 이 마이그레이션은 건너뛰기 (테이블이 새로 생성되므로 불필요)
  return Promise.resolve();
};

exports.down = function(knex) {
  // 이 마이그레이션은 건너뛰기
  return Promise.resolve();
};
