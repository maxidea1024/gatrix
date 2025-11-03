exports.up = function(knex) {
  // Tables already created in initial setup
  return Promise.resolve();
};

exports.down = function(knex) {
  // This is a no-op migration
  return Promise.resolve();
};
