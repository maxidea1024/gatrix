/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  // This table is already created in 20241217000006_create_message_reactions.js
  // This is a no-op migration
  return Promise.resolve();
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // This is a no-op migration
  return Promise.resolve();
};
