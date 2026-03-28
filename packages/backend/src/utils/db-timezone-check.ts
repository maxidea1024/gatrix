/**
 * Database timezone settings verification utility
 */

import db from '../config/knex';
import { createLogger } from '../config/logger';

const logger = createLogger('dbTimezoneCheck');

/**
 * Check MySQL timezone settings
 */
export async function checkDatabaseTimezone() {
  try {
    // Check current MySQL timezone settings
    const [timezoneResult] = await db.raw(
      'SELECT @@global.time_zone as global_tz, @@session.time_zone as session_tz'
    );

    // Check current MySQL time
    const [timeResult] = await db.raw(
      'SELECT NOW() as mysql_now, UTC_TIMESTAMP() as mysql_utc'
    );

    // Check Node.js time
    const nodeNow = new Date();
    const nodeUTC = new Date().toISOString();

    const info = {
      mysql: {
        globalTimezone: timezoneResult.global_tz,
        sessionTimezone: timezoneResult.session_tz,
        currentTime: timeResult.mysql_now,
        utcTime: timeResult.mysql_utc,
      },
      nodejs: {
        currentTime: nodeNow.toISOString(),
        utcTime: nodeUTC,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    logger.info('Database timezone check:', info);

    // Check recommendations
    const recommendations = [];

    if (
      timezoneResult.global_tz !== 'UTC' &&
      timezoneResult.global_tz !== '+00:00'
    ) {
      recommendations.push('MySQL global timezone should be set to UTC');
    }

    if (
      timezoneResult.session_tz !== 'UTC' &&
      timezoneResult.session_tz !== '+00:00'
    ) {
      recommendations.push('MySQL session timezone should be set to UTC');
    }

    if (recommendations.length > 0) {
      logger.warn('Database timezone recommendations:', recommendations);
      logger.warn(
        'To fix: SET GLOBAL time_zone = "+00:00"; SET SESSION time_zone = "+00:00";'
      );
    } else {
      logger.info('✅ Database timezone is properly configured for UTC');
    }

    return info;
  } catch (error) {
    logger.error('Error checking database timezone:', error);
    throw error;
  }
}

/**
 * Set database timezone to UTC
 */
export async function setDatabaseTimezoneToUTC() {
  try {
    // Set session timezone to UTC
    await db.raw('SET SESSION time_zone = "+00:00"');

    logger.info('✅ Database session timezone set to UTC');

    // Settings Confirm
    await checkDatabaseTimezone();
  } catch (error) {
    logger.error('Error setting database timezone to UTC:', error);
    throw error;
  }
}

/**
 * Date save/query test
 */
export async function testDateHandling() {
  try {
    const testDate = new Date('2025-09-15T15:00:00.000Z'); // UTC time
    const mysqlFormat = testDate.toISOString().slice(0, 19).replace('T', ' ');

    logger.info('Date handling test:', {
      originalDate: testDate.toISOString(),
      mysqlFormat: mysqlFormat,
      reconstructed: new Date(mysqlFormat + 'Z').toISOString(),
    });

    // Test save/query against actual database (using temp table)
    await db.raw(`
      CREATE TEMPORARY TABLE test_dates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        test_datetime DATETIME,
        test_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert data
    await db.raw(
      'INSERT INTO test_dates (test_datetime, test_timestamp) VALUES (?, ?)',
      [mysqlFormat, mysqlFormat]
    );

    // Query data
    const [result] = await db.raw('SELECT * FROM test_dates LIMIT 1');

    logger.info('Database date test result:', {
      stored: result,
      datetime_reconstructed: new Date(
        result.test_datetime + 'Z'
      ).toISOString(),
      timestamp_reconstructed: new Date(result.test_timestamp).toISOString(),
    });

    // Drop temporary table
    await db.raw('DROP TEMPORARY TABLE test_dates');

    return result;
  } catch (error) {
    logger.error('Error testing date handling:', error);
    throw error;
  }
}
