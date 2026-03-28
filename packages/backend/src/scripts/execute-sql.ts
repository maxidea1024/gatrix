#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config';
import logger from '../config/logger';

interface SqlExecutionOptions {
  file?: string;
  query?: string;
  database?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

class SqlExecutor {
  private connection: mysql.Connection | null = null;

  async connect(database?: string): Promise<void> {
    try {
      this.connection = await mysql.createConnection({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: database || config.database.name,
        multipleStatements: true, // Allow multiple statements in SQL file
      });

      logger.info(
        `Connected to MySQL database: ${database || config.database.name}`
      );
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      logger.info('Disconnected from database');
    }
  }

  async executeSqlFile(
    filePath: string,
    options: SqlExecutionOptions = {}
  ): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`SQL file not found: ${filePath}`);
    }

    const sqlContent = fs.readFileSync(filePath, 'utf8');

    if (options.verbose) {
      logger.info(`Reading SQL file: ${filePath}`);
      logger.info(`File size: ${sqlContent.length} characters`);
    }

    await this.executeSqlContent(sqlContent, options);
  }

  async executeSqlContent(
    sqlContent: string,
    options: SqlExecutionOptions = {}
  ): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    // Split SQL content by semicolons and execute as individual statements
    const statements = this.splitSqlStatements(sqlContent);

    if (options.verbose) {
      logger.info(`Found ${statements.length} SQL statements to execute`);
    }

    if (options.dryRun) {
      logger.info('DRY RUN MODE - SQL statements that would be executed:');
      statements.forEach((statement, index) => {
        logger.info(`Statement ${index + 1}:`);
        logger.info(statement.trim());
        logger.info('---');
      });
      return;
    }

    let executedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();

      if (!statement) {
        continue; // Skip empty statements
      }

      try {
        if (options.verbose) {
          logger.info(`Executing statement ${i + 1}/${statements.length}:`);
          logger.info(
            statement.substring(0, 100) + (statement.length > 100 ? '...' : '')
          );
        }

        const [results] = await this.connection.execute(statement);
        executedCount++;

        if (results) {
          if (Array.isArray(results) && results.length > 0) {
            if (options.verbose) {
              logger.info(
                `✅ Executed successfully. Rows returned: ${results.length}`
              );
              // Print SELECT query results
              if (statement.trim().toUpperCase().startsWith('SELECT')) {
                console.table(results);
              }
            } else {
              logger.info(
                `✅ Executed successfully. Rows returned: ${results.length}`
              );
            }
          } else if ('affectedRows' in results) {
            logger.info(
              `✅ Executed successfully. Affected rows: ${results.affectedRows}`
            );
          } else {
            logger.info('✅ Executed successfully');
          }
        }
      } catch (error) {
        errorCount++;
        logger.error(`❌ Error executing statement ${i + 1}:`, error);
        logger.error(`Statement: ${statement}`);

        // Continue even if an error occurs (can be stopped with --stop-on-error)
        if (process.argv.includes('--stop-on-error')) {
          throw error;
        }
      }
    }

    logger.info(`\n📊 Execution Summary:`);
    logger.info(`Total statements: ${statements.length}`);
    logger.info(`Successfully executed: ${executedCount}`);
    logger.info(`Errors: ${errorCount}`);
  }

  private splitSqlStatements(sqlContent: string): string[] {
    // Split SQL statements by semicolons, removing comments and empty lines
    const statements: string[] = [];
    const lines = sqlContent.split('\n');
    let currentStatement = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comment lines
      if (
        !trimmedLine ||
        trimmedLine.startsWith('--') ||
        trimmedLine.startsWith('/*')
      ) {
        continue;
      }

      // Remove end-of-line comments
      const lineWithoutComment = trimmedLine.split('--')[0].trim();
      if (!lineWithoutComment) continue;

      currentStatement += lineWithoutComment + ' ';

      // Statement is complete if it ends with semicolon
      if (lineWithoutComment.endsWith(';')) {
        const statement = currentStatement.trim();
        if (statement && statement !== ';') {
          statements.push(statement);
        }
        currentStatement = '';
      }
    }

    // Handle last statement without trailing semicolon
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    return statements;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options: SqlExecutionOptions = {};

  // Parse command-line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--file':
      case '-f':
        options.file = args[++i];
        break;
      case '--query':
      case '-q':
        options.query = args[++i];
        break;
      case '--database':
      case '-d':
        options.database = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  if (!options.file && !options.query) {
    logger.error('Error: Either --file or --query must be specified');
    printHelp();
    process.exit(1);
  }

  const executor = new SqlExecutor();

  try {
    await executor.connect(options.database);

    if (options.file) {
      const filePath = path.resolve(options.file);
      await executor.executeSqlFile(filePath, options);
    } else if (options.query) {
      await executor.executeSqlContent(options.query, options);
    }

    logger.info('✅ SQL execution completed successfully');
  } catch (error) {
    logger.error('❌ SQL execution failed:', error);
    process.exit(1);
  } finally {
    await executor.disconnect();
  }
}

function printHelp() {
  console.log(`
SQL Executor - Execute SQL files or queries against MySQL database

Usage:
  npm run sql -- [options]

Options:
  -f, --file <path>        Path to SQL file to execute
  -q, --query <sql>        SQL query to execute directly
  -d, --database <name>    Database name (default: from config)
  -v, --verbose            Verbose output
  --dry-run                Show what would be executed without running
  --stop-on-error          Stop execution on first error
  -h, --help               Show this help message

Examples:
  # Execute SQL file
  npm run sql -- --file ./data/sample.sql

  # Execute SQL file with verbose output
  npm run sql -- --file ./data/sample.sql --verbose

  # Execute direct query
  npm run sql -- --query "SELECT * FROM users LIMIT 5"

  # Execute against specific database
  npm run sql -- --file ./data/sample.sql --database test_db

  # Dry run to see what would be executed
  npm run sql -- --file ./data/sample.sql --dry-run
`);
}

// Call main function only when script is directly executed
if (require.main === module) {
  main().catch(console.error);
}

export { SqlExecutor };
