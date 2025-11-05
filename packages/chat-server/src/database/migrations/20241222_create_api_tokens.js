exports.up = function(knex) {
  // This migration is now handled by 20250105_fix_api_tokens_schema.js
  // Skip this migration
  return Promise.resolve();
};

exports.down = function(knex) {
  // This is a no-op migration
  return Promise.resolve();
};
