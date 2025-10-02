/**
 * Remote Config V2 System Seed Data
 * Inserts default environments and segments
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Inserting Remote Config V2 seed data...');

  // Insert default environments
  await connection.execute(`
    INSERT IGNORE INTO g_remote_config_v2_environments 
    (environmentName, displayName, description, isDefault, requiresApproval, requiredApprovers, createdBy) 
    VALUES 
    ('development', 'Development', 'Development environment for testing', TRUE, FALSE, 1, 1),
    ('staging', 'Staging', 'Staging environment for pre-production testing', FALSE, TRUE, 1, 1),
    ('production', 'Production', 'Production environment for live users', FALSE, TRUE, 2, 1)
  `);

  // Get environment IDs for segments
  const [environments] = await connection.execute('SELECT id, environmentName FROM g_remote_config_v2_environments');
  
  // Insert default segments for each environment
  for (const env of environments) {
    await connection.execute(`
      INSERT IGNORE INTO g_remote_config_v2_segments 
      (environmentId, segmentName, displayName, description, segmentConditions, isActive, createdBy) 
      VALUES 
      (?, 'beta_users', 'Beta Users', 'Users enrolled in beta testing program', 
       JSON_OBJECT('conditions', JSON_ARRAY(JSON_OBJECT('field', 'user_type', 'operator', 'equals', 'value', 'beta'))), 
       TRUE, 1),
      (?, 'premium_users', 'Premium Users', 'Users with premium subscription', 
       JSON_OBJECT('conditions', JSON_ARRAY(JSON_OBJECT('field', 'subscription_type', 'operator', 'in', 'value', JSON_ARRAY('premium', 'enterprise')))), 
       TRUE, 1),
      (?, 'mobile_users', 'Mobile Users', 'Users on mobile platforms', 
       JSON_OBJECT('conditions', JSON_ARRAY(JSON_OBJECT('field', 'platform', 'operator', 'in', 'value', JSON_ARRAY('ios', 'android')))), 
       TRUE, 1),
      (?, 'new_users', 'New Users', 'Users registered within last 30 days', 
       JSON_OBJECT('conditions', JSON_ARRAY(JSON_OBJECT('field', 'registration_date', 'operator', 'greater_than', 'value', '30_days_ago'))), 
       TRUE, 1)
    `, [env.id, env.id, env.id, env.id]);
  }

  // Insert sample templates for development environment
  const devEnv = environments.find(e => e.environmentName === 'development');
  if (devEnv) {
    const clientTemplateData = JSON.stringify({
      configs: {
        show_new_ui: {
          type: 'boolean',
          defaultValue: false,
          description: 'Show new UI design',
          campaigns: []
        },
        max_file_size: {
          type: 'number',
          defaultValue: 10485760,
          description: 'Maximum file upload size in bytes',
          campaigns: []
        },
        welcome_message: {
          type: 'string',
          defaultValue: 'Welcome to our app!',
          description: 'Welcome message for new users',
          campaigns: []
        }
      }
    });
    
    const serverTemplateData = JSON.stringify({
      configs: {
        rate_limit_requests: {
          type: 'number',
          defaultValue: 1000,
          description: 'Rate limit requests per minute',
          campaigns: []
        },
        enable_logging: {
          type: 'boolean',
          defaultValue: true,
          description: 'Enable detailed logging',
          campaigns: []
        },
        database_config: {
          type: 'json',
          defaultValue: {
            maxConnections: 10,
            timeout: 30000
          },
          description: 'Database connection configuration',
          campaigns: []
        }
      }
    });
    
    const clientMetadata = JSON.stringify({
      configCount: 3,
      lastModified: new Date().toISOString(),
      tags: ['client', 'features']
    });
    
    const serverMetadata = JSON.stringify({
      configCount: 3,
      lastModified: new Date().toISOString(),
      tags: ['server', 'config']
    });
    
    await connection.execute(`
      INSERT IGNORE INTO g_remote_config_v2_templates 
      (environmentId, templateName, displayName, description, templateType, status, version, templateData, metadata, createdBy, publishedAt) 
      VALUES 
      (?, 'client_features', 'Client Features', 'Feature flags for client applications', 'client', 'published', 1, ?, ?, 1, NOW()),
      (?, 'server_config', 'Server Configuration', 'Server-side configuration settings', 'server', 'published', 1, ?, ?, 1, NOW())
    `, [devEnv.id, clientTemplateData, clientMetadata, devEnv.id, serverTemplateData, serverMetadata]);
  }

  await connection.end();
  console.log('Remote Config V2 seed data inserted successfully');
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Removing Remote Config V2 seed data...');

  await connection.execute('DELETE FROM g_remote_config_v2_templates');
  await connection.execute('DELETE FROM g_remote_config_v2_segments');
  await connection.execute('DELETE FROM g_remote_config_v2_environments');

  await connection.end();
  console.log('Remote Config V2 seed data removed successfully');
};
