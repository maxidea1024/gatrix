
import { Model } from 'objection';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env before importing knex config
const result = dotenv.config({ path: path.join(__dirname, '../.env') });
if (result.error) {
    console.error('Error loading .env file:', result.error);
} else {
    console.log('.env file loaded successfully');
}

console.log('DB Config Check:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    hasPassword: !!process.env.DB_PASSWORD,
    db: process.env.DB_NAME
});

// Fallback for dev environment if password is missing
if (!process.env.DB_PASSWORD) {
    console.log('DB_PASSWORD missing, using provided password');
    process.env.DB_PASSWORD = 'gatrix_rootpassword';
}



const knex = require('../src/config/knex').default;
import { ActionGroup } from '../src/models/ActionGroup';
import { Approval } from '../src/models/Approval';
import { ChangeItem } from '../src/models/ChangeItem';
import { ChangeRequest } from '../src/models/ChangeRequest';
import logger from '../src/config/logger';

async function resetTables() {
    try {
        logger.info('Starting to truncate Change Request tables...');

        await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

        await ActionGroup.query().truncate();
        logger.info('Truncated g_action_groups');

        await Approval.query().truncate();
        logger.info('Truncated g_approvals');

        await ChangeItem.query().truncate();
        logger.info('Truncated g_change_items');

        await ChangeRequest.query().truncate();
        logger.info('Truncated g_change_requests');

        await knex.raw('SET FOREIGN_KEY_CHECKS = 1');

        logger.info('All Change Request tables truncated successfully.');
    } catch (error) {
        logger.error('Error truncating tables:', error);
    } finally {
        await knex.destroy();
    }
}

resetTables();
