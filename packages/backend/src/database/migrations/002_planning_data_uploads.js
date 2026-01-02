/**
 * Migration: Add planningDataUploads table
 * Tracks planning data upload history with hash, uploader info, and timestamps
 */

exports.up = async function (knex) {
    await knex.schema.createTable('planningDataUploads', (table) => {
        table.increments('id').primary();
        table.string('environment', 100).notNullable().index();
        table.string('uploadHash', 64).notNullable(); // SHA-256 hash of all content
        table.json('filesUploaded').notNullable(); // Array of file names
        table.json('fileHashes').notNullable(); // Per-file hashes for diff tracking { fileName: hash }
        table.integer('filesCount').notNullable();
        table.bigInteger('totalSize').notNullable();
        table.integer('uploadedBy').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
        table.string('uploaderName', 255).nullable(); // Display name or token name
        table.string('uploadSource', 50).notNullable().defaultTo('web'); // 'web' or 'cli'
        table.text('uploadComment').nullable(); // Optional comment from uploader
        table.json('changedFiles').nullable(); // Files that changed compared to previous upload
        table.timestamp('uploadedAt').notNullable().defaultTo(knex.fn.now());

        table.index(['environment', 'uploadedAt']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('planningDataUploads');
};
