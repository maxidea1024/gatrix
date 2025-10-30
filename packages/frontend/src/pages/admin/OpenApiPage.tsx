import React, { useState, useMemo } from 'react';
import { Box, Paper, Tabs, Tab, Typography, Card, CardContent, Chip, Stack, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`api-tabpanel-${index}`} aria-labelledby={`api-tab-${index}`} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const OpenApiPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => setTabValue(newValue);
  const specs = useMemo(() => ({ admin: createAdminApiSpec(), server: createServerSdkApiSpec(), client: createClientSdkApiSpec() }), []);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ mb: 0.5, fontWeight: 700 }}>{t('sidebar.openApi')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('openApi.description')}</Typography>
      </Box>
      <Paper sx={{ backgroundColor: 'background.paper', borderRadius: 1 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="API documentation tabs" sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', '& .MuiTab-root': { textTransform: 'none', fontSize: '0.95rem', fontWeight: 500, minHeight: 48 } }}>
          <Tab label="Admin API" id="api-tab-0" aria-controls="api-tabpanel-0" />
          <Tab label="Server SDK API" id="api-tab-1" aria-controls="api-tabpanel-1" />
          <Tab label="Client SDK API" id="api-tab-2" aria-controls="api-tabpanel-2" />
        </Tabs>
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 2 }}>
            <Card sx={{ mb: 2, backgroundColor: 'rgba(244, 67, 54, 0.05)', borderLeft: `4px solid ${theme.palette.error.main}` }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip label={t('openApi.adminOnly')} color="error" size="small" variant="outlined" />
                  <Chip label={t('openApi.authRequired')} color="warning" size="small" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary">{t('openApi.adminDescription')}</Typography>
              </CardContent>
            </Card>
            <SwaggerUIWrapper spec={specs.admin} />
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 2 }}>
            <Card sx={{ mb: 2, backgroundColor: 'rgba(33, 150, 243, 0.05)', borderLeft: `4px solid ${theme.palette.primary.main}` }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip label={t('openApi.serverSdk')} color="primary" size="small" variant="outlined" />
                  <Chip label={t('openApi.apiTokenRequired')} color="warning" size="small" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary">{t('openApi.serverSdkDescription')}</Typography>
              </CardContent>
            </Card>
            <SwaggerUIWrapper spec={specs.server} />
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 2 }}>
            <Card sx={{ mb: 2, backgroundColor: 'rgba(76, 175, 80, 0.05)', borderLeft: `4px solid ${theme.palette.success.main}` }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip label={t('openApi.clientSdk')} color="success" size="small" variant="outlined" />
                  <Chip label={t('openApi.apiTokenRequired')} color="warning" size="small" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary">{t('openApi.clientSdkDescription')}</Typography>
              </CardContent>
            </Card>
            <SwaggerUIWrapper spec={specs.client} />
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
};

const SwaggerUIWrapper: React.FC<{ spec: any }> = ({ spec }) => {
  // Get the API base URL from environment or use relative path
  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';

  // Update spec servers to use the correct API URL
  const updatedSpec = {
    ...spec,
    servers: [
      { url: apiBaseUrl, description: 'Current Environment' },
      ...(spec.servers?.slice(1) || [])
    ]
  };

  return (
  <Box
    sx={{
      backgroundColor: '#fff',
      borderRadius: 1,
      '& .swagger-ui': {
        padding: 0,
        backgroundColor: 'transparent',
        color: '#3b4151',
      },
      '& .swagger-ui .topbar': { display: 'none' },
      '& .swagger-ui .scheme-container': { backgroundColor: 'transparent', padding: '0 !important' },
      '& .swagger-ui .info': { color: '#3b4151' },
      '& .swagger-ui .info .title': { color: '#3b4151', fontWeight: 700 },
      '& .swagger-ui .info .description': { color: '#6b7280' },
      '& .swagger-ui .opblock': { borderColor: '#e5e7eb' },
      '& .swagger-ui .opblock-summary': {
        backgroundColor: '#f9fafb',
      },
      '& .swagger-ui .opblock-summary-description': { color: '#3b4151' },
      '& .swagger-ui .opblock-summary-path': { color: '#3b4151' },
      '& .swagger-ui .parameter__name': { color: '#3b4151', fontWeight: 600 },
      '& .swagger-ui .parameter__type': { color: '#6b7280' },
      '& .swagger-ui .response-col_description': { color: '#3b4151' },
      '& .swagger-ui table': { color: '#3b4151' },
      '& .swagger-ui table thead tr': {
        backgroundColor: '#f9fafb',
      },
      '& .swagger-ui table tbody tr': {
        backgroundColor: '#ffffff',
      },
      '& .swagger-ui .model': { color: '#3b4151' },
      '& .swagger-ui .model-title': { color: '#3b4151' },
      '& .swagger-ui .prop-type': { color: '#6b7280' },
      '& .swagger-ui .response-col': { color: '#3b4151' },
      '& .swagger-ui .response-col_status': { color: '#3b4151' },
      '& .swagger-ui .response-col_links': { color: '#3b4151' },
      '& .swagger-ui .tab': { color: '#3b4151' },
      '& .swagger-ui .tab.active': { color: '#2563eb', borderBottomColor: '#2563eb' },
      '& .swagger-ui .tab:hover': { color: '#3b4151' },
      '& .swagger-ui .btn': { color: '#3b4151' },
      '& .swagger-ui .btn:hover': { backgroundColor: '#f3f4f6' },
      '& .swagger-ui .model-box': { backgroundColor: '#f9fafb' },
      '& .swagger-ui .model-box-control': { color: '#3b4151' },
      '& .swagger-ui .model-hint': { color: '#6b7280' },
      '& .swagger-ui .model-toggle': { color: '#3b4151' },
      '& .swagger-ui .model-toggle:hover': { color: '#2563eb' },
      '& .swagger-ui .model-toggle::after': { color: '#3b4151' },
      '& .swagger-ui .model-toggle.collapsed::after': { color: '#3b4151' },
      '& .swagger-ui .response': { color: '#3b4151' },
      '& .swagger-ui .response-col_description__inner': { color: '#3b4151' },
      '& .swagger-ui .response-col_description__inner p': { color: '#3b4151' },
      '& .swagger-ui .response-col_description__inner a': { color: '#2563eb' },
      '& .swagger-ui .opblock-description-text': { color: '#6b7280' },
      '& .swagger-ui .opblock-external-docs-url': { color: '#2563eb' },
      '& .swagger-ui .opblock-tag': { color: '#3b4151' },
      '& .swagger-ui .opblock-tag-section': { color: '#3b4151' },
      '& .swagger-ui .opblock-tag-section .opblock-tag': { color: '#3b4151' },
      '& .swagger-ui .opblock-tag-section .opblock-tag:hover': { color: '#2563eb' },
    }}
  >
    <SwaggerUI
      spec={updatedSpec}
      url={apiBaseUrl}
      persistAuthorization={true}
      tryItOutEnabled={true}
      requestInterceptor={(request) => {
        // Add credentials to requests
        request.credentials = 'include';
        return request;
      }}
    />
  </Box>
  );
};

function createAdminApiSpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Admin API',
      version: '1.0.0',
      description: 'Admin panel API for managing game worlds, users, configurations, and system settings. All endpoints require JWT authentication and admin privileges.',
      contact: { name: 'API Support' },
    },
    servers: [{ url: 'http://localhost:5000/api/v1', description: 'Development' }],
    paths: {
      '/admin/dashboard': { get: { summary: 'Get admin dashboard data', description: 'Retrieve dashboard statistics and overview information', tags: ['Dashboard'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Dashboard data with statistics' }, '401': { description: 'Unauthorized' } } } },
      '/admin/stats': { get: { summary: 'Get system statistics', description: 'Retrieve overall system statistics', tags: ['Statistics'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'System statistics' } } } },
      '/admin/stats/users': { get: { summary: 'Get user statistics', description: 'Retrieve user-related statistics', tags: ['Statistics'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'User statistics' } } } },
      '/admin/health': { get: { summary: 'Health check', description: 'Check system health status', tags: ['System'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Health status' } } } },
      '/admin/game-worlds': { get: { summary: 'List all game worlds', description: 'Retrieve all game worlds with pagination support', tags: ['Game Worlds'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'List of game worlds' } } }, post: { summary: 'Create game world', description: 'Create a new game world', tags: ['Game Worlds'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Game world created' } } } },
      '/admin/game-worlds/{id}': { get: { summary: 'Get game world by ID', tags: ['Game Worlds'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Game world details' } } }, put: { summary: 'Update game world', tags: ['Game Worlds'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Game world updated' } } }, delete: { summary: 'Delete game world', tags: ['Game Worlds'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Game world deleted' } } } },
      '/admin/game-worlds/{id}/toggle-visibility': { patch: { summary: 'Toggle game world visibility', tags: ['Game Worlds'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Visibility toggled' } } } },
      '/admin/game-worlds/{id}/toggle-maintenance': { patch: { summary: 'Toggle maintenance mode', tags: ['Game Worlds'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Maintenance mode toggled' } } } },
      '/admin/users': { get: { summary: 'List all users', description: 'Retrieve all users with pagination and filtering', tags: ['Users'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'List of users' } } }, post: { summary: 'Create user', tags: ['Users'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'User created' } } } },
      '/admin/users/{id}': { get: { summary: 'Get user by ID', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User details' } } }, put: { summary: 'Update user', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User updated' } } }, delete: { summary: 'Delete user', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'User deleted' } } } },
      '/admin/users/{id}/activate': { post: { summary: 'Activate user', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User activated' } } } },
      '/admin/users/{id}/suspend': { post: { summary: 'Suspend user', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User suspended' } } } },
      '/admin/users/{id}/promote': { post: { summary: 'Promote user to admin', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User promoted' } } } },
      '/admin/users/{id}/demote': { post: { summary: 'Demote user from admin', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User demoted' } } } },
      '/admin/users/bulk/status': { post: { summary: 'Bulk update user status', tags: ['Users'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Users updated' } } } },
      '/admin/users/bulk/role': { post: { summary: 'Bulk update user roles', tags: ['Users'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'User roles updated' } } } },
      '/admin/pending-users': { get: { summary: 'Get pending user approvals', tags: ['Users'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Pending users' } } } },
      '/admin/users/{id}/approve': { post: { summary: 'Approve pending user', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User approved' } } } },
      '/admin/users/{id}/reject': { post: { summary: 'Reject pending user', tags: ['Users'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User rejected' } } } },
      '/admin/audit-logs': { get: { summary: 'Get audit logs', description: 'Retrieve audit logs with filtering and pagination', tags: ['Audit'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Audit logs' } } } },
      '/admin/audit-logs/stats': { get: { summary: 'Get audit statistics', tags: ['Audit'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Audit statistics' } } } },
      '/admin/audit-logs/cleanup': { post: { summary: 'Clean up old audit logs', tags: ['Audit'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Cleanup completed' } } } },
      '/admin/api-tokens': { get: { summary: 'List API tokens', tags: ['API Tokens'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'List of API tokens' } } }, post: { summary: 'Create API token', tags: ['API Tokens'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'API token created' } } } },
      '/admin/api-tokens/{id}': { put: { summary: 'Update API token', tags: ['API Tokens'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'API token updated' } } }, delete: { summary: 'Delete API token', tags: ['API Tokens'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'API token deleted' } } } },
      '/admin/api-tokens/{id}/regenerate': { post: { summary: 'Regenerate API token', tags: ['API Tokens'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'API token regenerated' } } } },
      '/admin/remote-config': { get: { summary: 'List remote configurations', tags: ['Configuration'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Remote configurations' } } }, post: { summary: 'Create remote configuration', tags: ['Configuration'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Configuration created' } } } },
      '/admin/remote-config/{id}': { get: { summary: 'Get configuration by ID', tags: ['Configuration'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Configuration details' } } }, put: { summary: 'Update configuration', tags: ['Configuration'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Configuration updated' } } }, delete: { summary: 'Delete configuration', tags: ['Configuration'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Configuration deleted' } } } },
      '/admin/maintenance': { get: { summary: 'Get maintenance status', tags: ['Maintenance'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Maintenance status' } } }, post: { summary: 'Set maintenance status', tags: ['Maintenance'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Maintenance status updated' } } } },
      '/admin/maintenance/templates': { get: { summary: 'Get maintenance templates', tags: ['Maintenance'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Maintenance templates' } } }, post: { summary: 'Save maintenance templates', tags: ['Maintenance'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Templates saved' } } } },
      '/admin/campaigns': { get: { summary: 'List campaigns', tags: ['Campaigns'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'List of campaigns' } } }, post: { summary: 'Create campaign', tags: ['Campaigns'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Campaign created' } } } },
      '/admin/cache/clear': { post: { summary: 'Clear system cache', tags: ['System'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Cache cleared' } } } },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT token from admin login' },
      },
    },
  };
}

function createServerSdkApiSpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Server SDK API',
      version: '1.0.0',
      description: 'Server-side SDK API for game servers. All endpoints require X-API-Token header authentication. Used by game servers to interact with the platform.',
      contact: { name: 'API Support' },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Development' },
      { url: 'https://api.example.com/api/v1', description: 'Production' },
    ],
    paths: {
      '/server/test': { get: { summary: 'Test server SDK authentication', description: 'Verify that the API token is valid and working', tags: ['Authentication'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Authentication successful with token details' } } } },
      '/server/game-worlds': { get: { summary: 'Get active game worlds', description: 'Retrieve list of active game worlds available for the server', tags: ['Game Worlds'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'List of active game worlds' } } } },
      '/server/game-worlds/{id}': { get: { summary: 'Get game world by ID', tags: ['Game Worlds'], security: [{ apiKeyHeader: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Game world details' } } } },
      '/server/game-worlds/world/{worldId}': { get: { summary: 'Get game world by world ID', tags: ['Game Worlds'], security: [{ apiKeyHeader: [] }], parameters: [{ name: 'worldId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Game world details' } } } },
      '/server/auth/verify-token': { post: { summary: 'Verify JWT token', description: 'Verify a JWT token without requiring API token authentication', tags: ['Authentication'], responses: { '200': { description: 'Token verification result' } } } },
      '/server/auth/user/{id}': { get: { summary: 'Get user by ID', tags: ['Users'], security: [{ apiKeyHeader: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User details' } } } },
      '/server/users/sync': { get: { summary: 'Sync users', description: 'Synchronize user data with the server', tags: ['Users'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'User sync result' } } } },
      '/server/users/{id}': { get: { summary: 'Get user by ID', tags: ['Users'], security: [{ apiKeyHeader: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'User details' } } } },
      '/server/users/batch': { post: { summary: 'Get multiple users by IDs', description: 'Retrieve multiple users in a single request', tags: ['Users'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'List of users' } } } },
      '/server/notifications': { post: { summary: 'Send notification', description: 'Send a notification to users', tags: ['Notifications'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Notification sent' } } } },
      '/server/notifications/bulk': { post: { summary: 'Send bulk notifications', description: 'Send notifications to multiple users', tags: ['Notifications'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Bulk notifications sent' } } } },
      '/server/files/upload-url': { post: { summary: 'Get file upload URL', description: 'Get a pre-signed URL for file upload', tags: ['Files'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Upload URL' } } } },
      '/server/files/{fileId}': { get: { summary: 'Get file info', tags: ['Files'], security: [{ apiKeyHeader: [] }], parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'File information' } } } },
      '/server/chat/register': { post: { summary: 'Register chat server', description: 'Register a game server for chat functionality', tags: ['Chat'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Server registered' } } } },
      '/server/chat/unregister': { post: { summary: 'Unregister chat server', tags: ['Chat'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Server unregistered' } } } },
      '/server/chat/stats': { post: { summary: 'Report chat statistics', tags: ['Chat'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Stats reported' } } } },
      '/server/chat/activity': { post: { summary: 'Report chat activity', tags: ['Chat'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Activity reported' } } } },
      '/server/chat/servers': { get: { summary: 'Get registered chat servers', tags: ['Chat'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'List of registered servers' } } } },
      '/server/coupons/{code}/redeem': { post: { summary: 'Redeem coupon', description: 'Redeem a coupon code for a user', tags: ['Coupons'], security: [{ apiKeyHeader: [] }], parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Coupon redeemed' } } } },
      '/server/templates': { get: { summary: 'Get remote config templates', tags: ['Configuration'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Templates list' } } } },
      '/server/metrics': { post: { summary: 'Submit metrics', description: 'Submit performance and usage metrics', tags: ['Metrics'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Metrics received' } } } },
      '/server/services': { get: { summary: 'Service discovery', description: 'Discover available services', tags: ['Services'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Available services' } } } },
    },
    components: {
      securitySchemes: {
        apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Token', description: 'API token for server authentication' },
      },
    },
  };
}

function createClientSdkApiSpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Client SDK API',
      version: '1.0.0',
      description: 'Client-side SDK API for game client applications. Some endpoints are public, others require X-API-Token header authentication. Used by game clients to fetch configuration and game data.',
      contact: { name: 'API Support' },
    },
    servers: [{ url: 'http://localhost:5000/api/v1', description: 'Development' }],
    paths: {
      '/client/test': { get: { summary: 'Test client SDK authentication', description: 'Verify that the API token is valid and working', tags: ['Authentication'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Authentication successful with token details' } } } },
      '/client/client-version': { get: { summary: 'Get client version info', description: 'Retrieve current client version information (public endpoint)', tags: ['Version'], responses: { '200': { description: 'Client version information' } } } },
      '/client/game-worlds': { get: { summary: 'Get game worlds', description: 'Retrieve list of available game worlds (public endpoint)', tags: ['Game Worlds'], responses: { '200': { description: 'List of game worlds' } } } },
      '/client/cache-stats': { get: { summary: 'Get cache statistics', description: 'Retrieve cache statistics (public endpoint)', tags: ['Cache'], responses: { '200': { description: 'Cache stats' } } } },
      '/client/invalidate-cache': { post: { summary: 'Invalidate cache', description: 'Invalidate client-side cache (public endpoint)', tags: ['Cache'], responses: { '200': { description: 'Cache invalidated' } } } },
      '/client/remote-config/evaluate': { post: { summary: 'Evaluate remote configuration', description: 'Evaluate remote configuration with context (supports both public and authenticated requests)', tags: ['Configuration'], responses: { '200': { description: 'Evaluated configuration' } } } },
      '/client/remote-config/{key}': { post: { summary: 'Get configuration by key', description: 'Get specific configuration value by key (public endpoint)', tags: ['Configuration'], parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Configuration value' } } } },
      '/client/remote-config/templates': { get: { summary: 'Get config templates', description: 'Get remote configuration templates (requires authentication)', tags: ['Configuration'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Templates list' } } } },
      '/client/remote-config/metrics': { post: { summary: 'Submit metrics', description: 'Submit client-side metrics and analytics', tags: ['Metrics'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Metrics received' } } } },
      '/client/crashes/upload': { post: { summary: 'Upload crash report', description: 'Upload crash report with stack trace and context information', tags: ['Crash Reports'], security: [{ apiKeyHeader: [] }], responses: { '200': { description: 'Crash report received' } } } },
    },
    components: {
      securitySchemes: {
        apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Token', description: 'API token for client authentication (optional for some endpoints)' },
      },
    },
  };
}

export default OpenApiPage;

