/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 인덱스 제거 (존재하는 경우에만)
  try {
    await knex.schema.alterTable('g_jobs', function(table) {
      table.dropIndex(['schedule'], 'idx_schedule');
    });
  } catch (error) {
    console.log('Index idx_schedule does not exist or already dropped');
  }

  try {
    await knex.schema.alterTable('g_jobs', function(table) {
      table.dropIndex(['isActive'], 'idx_active');
    });
  } catch (error) {
    console.log('Index idx_active does not exist or already dropped');
  }

  try {
    await knex.schema.alterTable('g_jobs', function(table) {
      table.dropIndex(['nextRunAt'], 'idx_next_run');
    });
  } catch (error) {
    console.log('Index idx_next_run does not exist or already dropped');
  }

  // 스케줄 관련 필드들 제거
  return knex.schema.alterTable('g_jobs', function(table) {
    table.dropColumn('schedule');
    table.dropColumn('isActive');
    table.dropColumn('lastRunAt');
    table.dropColumn('nextRunAt');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('g_jobs', function(table) {
    // 롤백 시 필드들 복원
    table.string('schedule', 100).nullable();
    table.boolean('isActive').defaultTo(true);
    table.timestamp('lastRunAt').nullable();
    table.timestamp('nextRunAt').nullable();

    // 인덱스 복원
    table.index(['schedule'], 'idx_schedule');
    table.index(['isActive'], 'idx_active');
    table.index(['nextRunAt'], 'idx_next_run');
  });
};
