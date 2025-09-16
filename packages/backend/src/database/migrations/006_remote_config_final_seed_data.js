const mysql = require('mysql2/promise');

exports.up = async function() {
  console.log('Starting Remote Config Final System seed data...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Inserting seed data...');

  // 1. Insert default environments
  await connection.execute(`
    INSERT IGNORE INTO g_remote_config_environments 
    (environmentName, displayName, description, isDefault, requiresApproval, requiredApprovers, createdBy) 
    VALUES 
    ('development', 'Development', 'Development environment for testing', TRUE, FALSE, 1, 1),
    ('staging', 'Staging', 'Staging environment for pre-production testing', FALSE, TRUE, 1, 1),
    ('production', 'Production', 'Production environment for live users', FALSE, TRUE, 2, 1)
  `);

  // 2. Insert predefined segments
  await connection.execute(`
    INSERT IGNORE INTO g_remote_config_segments 
    (environmentId, segmentName, displayName, description, conditions, createdBy) 
    VALUES 
    (1, 'beta_users', 'Beta Users', 'Users participating in beta testing', 
     JSON_OBJECT('conditions', JSON_ARRAY(
       JSON_OBJECT('field', 'userType', 'operator', 'equals', 'value', 'beta')
     )), 1),
    (1, 'premium_users', 'Premium Users', 'Users with premium subscription', 
     JSON_OBJECT('conditions', JSON_ARRAY(
       JSON_OBJECT('field', 'subscriptionType', 'operator', 'equals', 'value', 'premium')
     )), 1),
    (1, 'mobile_users', 'Mobile Users', 'Users accessing via mobile app', 
     JSON_OBJECT('conditions', JSON_ARRAY(
       JSON_OBJECT('field', 'platform', 'operator', 'equals', 'value', 'mobile')
     )), 1)
  `);

  // 3. Insert sample templates
  await connection.execute(`
    INSERT IGNORE INTO g_remote_config_templates 
    (environmentId, templateName, displayName, description, templateType, status, templateData, etag, createdBy) 
    VALUES 
    (1, 'mobile_app_config', 'Mobile App Configuration', 'Configuration for mobile application features', 'client', 'published', 
     JSON_OBJECT(
       'configs', JSON_OBJECT(
         'enable_new_ui', JSON_OBJECT(
           'type', 'boolean',
           'value', true,
           'description', 'Enable new user interface'
         ),
         'api_timeout', JSON_OBJECT(
           'type', 'number', 
           'value', 5000,
           'description', 'API request timeout in milliseconds'
         ),
         'welcome_message', JSON_OBJECT(
           'type', 'string',
           'value', 'Welcome to our app!',
           'description', 'Welcome message for new users'
         )
       ),
       'segments', JSON_OBJECT(),
       'metadata', JSON_OBJECT('version', '1.0.0', 'author', 'system')
     ), 
     MD5(CONCAT('mobile_app_config', NOW())), 1),
    (1, 'api_feature_flags', 'API Feature Flags', 'Server-side feature flags for API', 'server', 'draft', 
     JSON_OBJECT(
       'configs', JSON_OBJECT(
         'enable_rate_limiting', JSON_OBJECT(
           'type', 'boolean',
           'value', false,
           'description', 'Enable API rate limiting'
         ),
         'max_requests_per_minute', JSON_OBJECT(
           'type', 'number',
           'value', 100,
           'description', 'Maximum requests per minute per user'
         ),
         'maintenance_mode', JSON_OBJECT(
           'type', 'boolean',
           'value', false,
           'description', 'Enable maintenance mode'
         )
       ),
       'segments', JSON_OBJECT(),
       'metadata', JSON_OBJECT('version', '1.0.0', 'author', 'system')
     ), 
     MD5(CONCAT('api_feature_flags', NOW())), 1)
  `);

  // 4. Insert template versions
  await connection.execute(`
    INSERT IGNORE INTO g_remote_config_template_versions 
    (templateId, version, templateData, changeDescription, etag, createdBy) 
    SELECT 
      t.id,
      1,
      t.templateData,
      'Initial version',
      t.etag,
      t.createdBy
    FROM g_remote_config_templates t
    WHERE t.templateName IN ('mobile_app_config', 'api_feature_flags')
  `);

  // API tokens are managed by the existing g_api_access_tokens table

  await connection.end();
  console.log('Remote Config Final System seed data completed successfully!');
};

exports.down = async function() {
  console.log('Rolling back Remote Config Final System seed data...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  // Delete in reverse order due to foreign key constraints
  await connection.execute(`DELETE FROM g_remote_config_template_versions WHERE templateId IN (SELECT id FROM g_remote_config_templates WHERE templateName IN ('mobile_app_config', 'api_feature_flags'))`);
  await connection.execute(`DELETE FROM g_remote_config_templates WHERE templateName IN ('mobile_app_config', 'api_feature_flags')`);
  await connection.execute(`DELETE FROM g_remote_config_segments WHERE segmentName IN ('beta_users', 'premium_users', 'mobile_users')`);
  await connection.execute(`DELETE FROM g_remote_config_environments WHERE environmentName IN ('development', 'staging', 'production')`);

  await connection.end();
  console.log('Remote Config Final System seed data rollback completed!');
};
