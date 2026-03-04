import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  useTheme,
} from '@mui/material';
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
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const OpenApiPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => setTabValue(newValue);
  const specs = useMemo(
    () => ({
      admin: createAdminApiSpec(),
      server: createServerSdkApiSpec(),
      client: createClientSdkApiSpec(),
    }),
    []
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ mb: 0.5, fontWeight: 700 }}>
          {t('sidebar.openApi')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('openApi.description')}
        </Typography>
      </Box>
      <Paper sx={{ backgroundColor: 'background.paper', borderRadius: 1 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="API documentation tabs"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              minHeight: 48,
            },
          }}
        >
          <Tab label="Admin API" id="api-tab-0" aria-controls="api-tabpanel-0" />
          <Tab label="Server SDK API" id="api-tab-1" aria-controls="api-tabpanel-1" />
          <Tab label="Client SDK API" id="api-tab-2" aria-controls="api-tabpanel-2" />
        </Tabs>
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 2 }}>
            <Card
              sx={{
                mb: 2,
                backgroundColor: 'rgba(244, 67, 54, 0.05)',
                borderLeft: `4px solid ${theme.palette.error.main}`,
              }}
            >
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip
                    label={t('openApi.adminOnly')}
                    color="error"
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={t('openApi.authRequired')}
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {t('openApi.adminDescription')}
                </Typography>
              </CardContent>
            </Card>
            <SwaggerUIWrapper spec={specs.admin} />
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 2 }}>
            <Card
              sx={{
                mb: 2,
                backgroundColor: 'rgba(33, 150, 243, 0.05)',
                borderLeft: `4px solid ${theme.palette.primary.main}`,
              }}
            >
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip
                    label={t('openApi.serverSdk')}
                    color="primary"
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={t('openApi.apiTokenRequired')}
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {t('openApi.serverSdkDescription')}
                </Typography>
              </CardContent>
            </Card>
            <SwaggerUIWrapper spec={specs.server} />
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 2 }}>
            <Card
              sx={{
                mb: 2,
                backgroundColor: 'rgba(76, 175, 80, 0.05)',
                borderLeft: `4px solid ${theme.palette.success.main}`,
              }}
            >
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip
                    label={t('openApi.clientSdk')}
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={t('openApi.apiTokenRequired')}
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {t('openApi.clientSdkDescription')}
                </Typography>
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Get the API base URL from environment or use relative path
  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';

  // Update spec servers to use the correct API URL
  const updatedSpec = {
    ...spec,
    servers: [
      { url: apiBaseUrl, description: 'Current Environment' },
      ...(spec.servers?.slice(1) || []),
    ],
  };

  // Theme-aware color tokens
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const bgPaper = theme.palette.background.paper;
  const bgSubtle = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb';
  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb';
  const accentColor = theme.palette.primary.main;
  const btnHoverBg = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6';

  return (
    <Box
      sx={{
        backgroundColor: bgPaper,
        borderRadius: 1,
        '& .swagger-ui': {
          padding: 0,
          backgroundColor: 'transparent',
          color: textPrimary,
        },
        '& .swagger-ui .topbar': { display: 'none' },
        '& .swagger-ui .scheme-container': {
          backgroundColor: 'transparent',
          padding: '0 !important',
        },
        '& .swagger-ui .info': { color: textPrimary },
        '& .swagger-ui .info .title': { color: textPrimary, fontWeight: 700 },
        '& .swagger-ui .info .description': { color: textSecondary },
        '& .swagger-ui .opblock': { borderColor },
        '& .swagger-ui .opblock-summary': { backgroundColor: bgSubtle },
        '& .swagger-ui .opblock-summary-description': { color: textPrimary },
        '& .swagger-ui .opblock-summary-path': { color: textPrimary },
        '& .swagger-ui .parameter__name': { color: textPrimary, fontWeight: 600 },
        '& .swagger-ui .parameter__type': { color: textSecondary },
        '& .swagger-ui .response-col_description': { color: textPrimary },
        '& .swagger-ui table': { color: textPrimary },
        '& .swagger-ui table thead tr': { backgroundColor: bgSubtle },
        '& .swagger-ui table tbody tr': { backgroundColor: bgPaper },
        '& .swagger-ui .model': { color: textPrimary },
        '& .swagger-ui .model-title': { color: textPrimary },
        '& .swagger-ui .prop-type': { color: textSecondary },
        '& .swagger-ui .response-col': { color: textPrimary },
        '& .swagger-ui .response-col_status': { color: textPrimary },
        '& .swagger-ui .response-col_links': { color: textPrimary },
        '& .swagger-ui .tab': { color: textPrimary },
        '& .swagger-ui .tab.active': { color: accentColor, borderBottomColor: accentColor },
        '& .swagger-ui .tab:hover': { color: textPrimary },
        '& .swagger-ui .btn': { color: textPrimary },
        '& .swagger-ui .btn:hover': { backgroundColor: btnHoverBg },
        '& .swagger-ui .model-box': { backgroundColor: bgSubtle },
        '& .swagger-ui .model-box-control': { color: textPrimary },
        '& .swagger-ui .model-hint': { color: textSecondary },
        '& .swagger-ui .model-toggle': { color: textPrimary },
        '& .swagger-ui .model-toggle:hover': { color: accentColor },
        '& .swagger-ui .model-toggle::after': { color: textPrimary },
        '& .swagger-ui .model-toggle.collapsed::after': { color: textPrimary },
        '& .swagger-ui .response': { color: textPrimary },
        '& .swagger-ui .response-col_description__inner': { color: textPrimary },
        '& .swagger-ui .response-col_description__inner p': { color: textPrimary },
        '& .swagger-ui .response-col_description__inner a': { color: accentColor },
        '& .swagger-ui .opblock-description-text': { color: textSecondary },
        '& .swagger-ui .opblock-external-docs-url': { color: accentColor },
        '& .swagger-ui .opblock-tag': { color: textPrimary },
        '& .swagger-ui .opblock-tag-section': { color: textPrimary },
        '& .swagger-ui .opblock-tag-section .opblock-tag': { color: textPrimary },
        '& .swagger-ui .opblock-tag-section .opblock-tag:hover': { color: accentColor },
        // Additional dark-mode overrides for Swagger UI internals
        '& .swagger-ui .opblock .opblock-section-header': {
          backgroundColor: bgSubtle,
          borderBottomColor: borderColor,
        },
        '& .swagger-ui .opblock .opblock-section-header h4': { color: textPrimary },
        '& .swagger-ui .opblock-body pre': {
          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f8f8f8',
          color: textPrimary,
        },
        '& .swagger-ui .highlight-code': {
          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f8f8f8',
        },
        '& .swagger-ui select': {
          backgroundColor: bgPaper,
          color: textPrimary,
          borderColor,
        },
        '& .swagger-ui input[type=text]': {
          backgroundColor: bgPaper,
          color: textPrimary,
          borderColor,
        },
        '& .swagger-ui textarea': {
          backgroundColor: bgPaper,
          color: textPrimary,
          borderColor,
        },
        '& .swagger-ui .btn.authorize': {
          color: accentColor,
          borderColor: accentColor,
        },
        '& .swagger-ui .btn.execute': {
          backgroundColor: accentColor,
        },
        '& .swagger-ui .loading-container .loading::after': {
          color: textSecondary,
        },
        '& .swagger-ui .opblock-tag small': { color: textSecondary },
        '& .swagger-ui .opblock .opblock-summary-method': { fontWeight: 700 },
        '& .swagger-ui section.models': {
          borderColor,
        },
        '& .swagger-ui section.models h4': { color: textPrimary },
        '& .swagger-ui .servers > label': { color: textPrimary },
        '& .swagger-ui .servers > label select': {
          backgroundColor: bgPaper,
          color: textPrimary,
          borderColor,
        },
        '& .swagger-ui .scheme-container .schemes > label': { color: textPrimary },
        '& .swagger-ui .arrow': { fill: textPrimary },
        '& .swagger-ui svg:not(:root)': { fill: isDark ? '#e0e0e0' : undefined },
      }}
    >
      <SwaggerUI
        spec={updatedSpec}
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
      description:
        'Admin panel API for managing the Gatrix platform. All endpoints require JWT authentication. Project-scoped endpoints use /admin/orgs/{orgId}/projects/{projectId}/... path structure.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development',
      },
    ],
    paths: {
      '/admin/dashboard': {
        get: {
          summary: 'Get admin dashboard data',
          tags: ['Dashboard'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/stats': {
        get: {
          summary: 'Get system statistics',
          tags: ['Statistics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/stats/users': {
        get: {
          summary: 'Get user statistics',
          tags: ['Statistics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/health': {
        get: {
          summary: 'Health check',
          tags: ['System'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/cache/clear': {
        post: {
          summary: 'Clear system cache',
          tags: ['System'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users': {
        get: {
          summary: 'List all users',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create user',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'User created',
            },
          },
        },
      },
      '/admin/users/{id}': {
        get: {
          summary: 'Get user by ID',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update user',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete user',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/users/{id}/activate': {
        post: {
          summary: 'Activate user',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/{id}/suspend': {
        post: {
          summary: 'Suspend user',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/{id}/promote': {
        post: {
          summary: 'Promote user to admin',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/{id}/demote': {
        post: {
          summary: 'Demote user from admin',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/{id}/verify-email': {
        post: {
          summary: 'Verify user email',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/{id}/environments': {
        get: {
          summary: 'Get user environment access',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update user environment access',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/permissions': {
        get: {
          summary: 'Get available permissions',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/{id}/permissions': {
        get: {
          summary: 'Get user permissions',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update user permissions',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/bulk/status': {
        post: {
          summary: 'Bulk update user status',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/bulk/role': {
        post: {
          summary: 'Bulk update user roles',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/bulk/email-verified': {
        post: {
          summary: 'Bulk verify user emails',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/bulk/tags': {
        post: {
          summary: 'Bulk update user tags',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/bulk/delete': {
        post: {
          summary: 'Bulk delete users',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/pending-users': {
        get: {
          summary: 'Get pending user approvals',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/{id}/approve': {
        post: {
          summary: 'Approve pending user',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/{id}/reject': {
        post: {
          summary: 'Reject pending user',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/me/environments': {
        get: {
          summary: 'Get my environment access',
          tags: ['Users'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/organisations': {
        get: {
          summary: 'List organisations',
          tags: ['RBAC - Organisations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create organisation',
          tags: ['RBAC - Organisations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/rbac/organisations/{id}': {
        get: {
          summary: 'Get organisation by ID',
          tags: ['RBAC - Organisations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update organisation',
          tags: ['RBAC - Organisations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/organisations/{id}/members': {
        get: {
          summary: 'Get organisation members',
          tags: ['RBAC - Organisations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Add organisation member',
          tags: ['RBAC - Organisations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/organisations/{id}/members/{userId}': {
        put: {
          summary: 'Update member role',
          tags: ['RBAC - Organisations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Remove organisation member',
          tags: ['RBAC - Organisations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/projects': {
        get: {
          summary: 'List projects',
          tags: ['RBAC - Projects'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create project',
          tags: ['RBAC - Projects'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/rbac/projects/{id}': {
        put: {
          summary: 'Update project',
          tags: ['RBAC - Projects'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete project',
          tags: ['RBAC - Projects'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/roles': {
        get: {
          summary: 'List roles',
          tags: ['RBAC - Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create role',
          tags: ['RBAC - Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/rbac/roles/{id}': {
        get: {
          summary: 'Get role by ID',
          tags: ['RBAC - Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update role',
          tags: ['RBAC - Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete role',
          tags: ['RBAC - Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/groups': {
        get: {
          summary: 'List groups',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create group',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/rbac/groups/{id}': {
        get: {
          summary: 'Get group by ID',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update group',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete group',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/groups/{id}/members': {
        post: {
          summary: 'Add group member',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/groups/{id}/members/{userId}': {
        delete: {
          summary: 'Remove group member',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/groups/{id}/roles': {
        post: {
          summary: 'Assign role to group',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/groups/{id}/roles/{roleId}': {
        delete: {
          summary: 'Remove role from group',
          tags: ['RBAC - Groups'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'roleId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/users/{id}/roles': {
        get: {
          summary: 'Get user roles',
          tags: ['RBAC - User Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Assign role to user',
          tags: ['RBAC - User Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/users/{id}/roles/{roleId}': {
        delete: {
          summary: 'Remove role from user',
          tags: ['RBAC - User Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'roleId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/users/{id}/permissions': {
        get: {
          summary: 'Get user effective permissions',
          tags: ['RBAC - User Roles'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/admin-tokens': {
        get: {
          summary: 'List admin tokens',
          tags: ['RBAC - Admin Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create admin token',
          tags: ['RBAC - Admin Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/rbac/admin-tokens/{id}': {
        delete: {
          summary: 'Delete admin token',
          tags: ['RBAC - Admin Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/environment-keys/{environmentId}': {
        get: {
          summary: 'Get environment keys',
          tags: ['RBAC - Environment Keys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'environmentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/environment-keys': {
        post: {
          summary: 'Create environment key',
          tags: ['RBAC - Environment Keys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/rbac/environment-keys/{id}/deactivate': {
        patch: {
          summary: 'Deactivate environment key',
          tags: ['RBAC - Environment Keys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/environment-keys/{id}/activate': {
        patch: {
          summary: 'Activate environment key',
          tags: ['RBAC - Environment Keys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/rbac/environment-keys/{id}': {
        delete: {
          summary: 'Delete environment key',
          tags: ['RBAC - Environment Keys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/rbac/permissions': {
        get: {
          summary: 'Get all permissions',
          tags: ['RBAC - Permissions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/audit-logs': {
        get: {
          summary: 'Get audit logs',
          tags: ['Audit Logs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/audit-logs/stats': {
        get: {
          summary: 'Get audit statistics',
          tags: ['Audit Logs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/audit-logs/cleanup': {
        post: {
          summary: 'Clean up old audit logs',
          tags: ['Audit Logs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/invitations': {
        get: {
          summary: 'List invitations',
          tags: ['Invitations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create invitation',
          tags: ['Invitations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/invitations/current': {
        get: {
          summary: 'Get current invitation',
          tags: ['Invitations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/invitations/{id}': {
        delete: {
          summary: 'Delete invitation',
          tags: ['Invitations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/crash-events': {
        get: {
          summary: 'List crash events',
          tags: ['Crash Events'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/crash-events/filter-options': {
        get: {
          summary: 'Get crash event filter options',
          tags: ['Crash Events'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/crash-events/{id}': {
        get: {
          summary: 'Get crash event by ID',
          tags: ['Crash Events'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/crash-events/{id}/log': {
        get: {
          summary: 'Get crash event log',
          tags: ['Crash Events'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/crash-events/{id}/stack-trace': {
        get: {
          summary: 'Get crash event stack trace',
          tags: ['Crash Events'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/jobs': {
        get: {
          summary: 'List scheduled jobs',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create job',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/jobs/job-types': {
        get: {
          summary: 'Get job types',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/jobs/job-types/{id}': {
        get: {
          summary: 'Get job type by ID',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/jobs/{id}': {
        get: {
          summary: 'Get job by ID',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update job',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete job',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/jobs/{id}/execute': {
        post: {
          summary: 'Execute job',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/jobs/{id}/executions': {
        get: {
          summary: 'Get job executions',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/jobs/{id}/tags': {
        get: {
          summary: 'Get job tags',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update job tags',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/jobs/job-executions/statistics': {
        get: {
          summary: 'Get execution statistics',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/jobs/job-executions': {
        get: {
          summary: 'List job executions',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/jobs/job-executions/{id}': {
        get: {
          summary: 'Get job execution by ID',
          tags: ['Jobs'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/queue-monitor/stats': {
        get: {
          summary: 'Get queue stats',
          tags: ['Queue Monitor'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/queue-monitor/{queueName}/repeatable': {
        get: {
          summary: 'Get repeatable jobs',
          tags: ['Queue Monitor'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'queueName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/queue-monitor/{queueName}/jobs': {
        get: {
          summary: 'Get queue jobs',
          tags: ['Queue Monitor'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'queueName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/queue-monitor/{queueName}/jobs/{jobId}/retry': {
        post: {
          summary: 'Retry job',
          tags: ['Queue Monitor'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'queueName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'jobId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/queue-monitor/{queueName}/jobs/{jobId}': {
        delete: {
          summary: 'Delete job',
          tags: ['Queue Monitor'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'queueName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'jobId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/queue-monitor/{queueName}/repeatable/{key}': {
        delete: {
          summary: 'Delete repeatable job',
          tags: ['Queue Monitor'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'queueName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'key',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/queue-monitor/{queueName}/clean': {
        post: {
          summary: 'Clean queue',
          tags: ['Queue Monitor'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'queueName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/console/commands': {
        get: {
          summary: 'Get available commands',
          tags: ['Console'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/console/execute': {
        post: {
          summary: 'Execute command',
          tags: ['Console'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/monitoring/alerts': {
        get: {
          summary: 'List monitoring alerts',
          tags: ['Monitoring'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/monitoring/alerts/{id}': {
        get: {
          summary: 'Get alert by ID',
          tags: ['Monitoring'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        patch: {
          summary: 'Update alert',
          tags: ['Monitoring'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/integrations/providers': {
        get: {
          summary: 'Get integration providers',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/integrations': {
        get: {
          summary: 'List integrations',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create integration',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/integrations/{id}': {
        get: {
          summary: 'Get integration by ID',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update integration',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete integration',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/integrations/{id}/toggle': {
        post: {
          summary: 'Toggle integration',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/integrations/{id}/events': {
        get: {
          summary: 'Get integration events',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/integrations/{id}/test': {
        post: {
          summary: 'Test integration',
          tags: ['Integrations'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/translation/translate': {
        post: {
          summary: 'Translate text',
          tags: ['Translation'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/translation/translate/multiple': {
        post: {
          summary: 'Translate multiple texts',
          tags: ['Translation'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/translation/detect-language': {
        post: {
          summary: 'Detect language',
          tags: ['Translation'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/notifications/sse': {
        get: {
          summary: 'SSE notification stream',
          tags: ['Notifications'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/notifications/sse/subscribe': {
        post: {
          summary: 'Subscribe to SSE',
          tags: ['Notifications'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/notifications/sse/unsubscribe': {
        post: {
          summary: 'Unsubscribe from SSE',
          tags: ['Notifications'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/notifications/test': {
        post: {
          summary: 'Send test notification',
          tags: ['Notifications'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/notifications/stats': {
        get: {
          summary: 'Get notification stats',
          tags: ['Notifications'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/whitelist': {
        get: {
          summary: 'List whitelist entries',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create whitelist entry',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/whitelist/{id}': {
        get: {
          summary: 'Get whitelist entry',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update whitelist entry',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete whitelist entry',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/whitelist/{id}/toggle': {
        patch: {
          summary: 'Toggle whitelist entry',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/whitelist/bulk': {
        post: {
          summary: 'Bulk create whitelist entries',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/whitelist/test': {
        post: {
          summary: 'Test whitelist',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/whitelist/{id}/tags': {
        get: {
          summary: 'Get whitelist entry tags',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update whitelist entry tags',
          tags: ['Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/ip-whitelist': {
        get: {
          summary: 'List IP whitelist entries',
          tags: ['IP Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create IP whitelist entry',
          tags: ['IP Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/ip-whitelist/check': {
        get: {
          summary: 'Check IP against whitelist',
          tags: ['IP Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/ip-whitelist/{id}': {
        get: {
          summary: 'Get IP whitelist entry',
          tags: ['IP Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update IP whitelist entry',
          tags: ['IP Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete IP whitelist entry',
          tags: ['IP Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/ip-whitelist/bulk': {
        post: {
          summary: 'Bulk create IP whitelist entries',
          tags: ['IP Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/ip-whitelist/{id}/toggle': {
        patch: {
          summary: 'Toggle IP whitelist entry',
          tags: ['IP Whitelist'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/sse': {
        get: {
          summary: 'SSE service discovery stream',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/cleanup': {
        post: {
          summary: 'Cleanup stale services',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/stats': {
        get: {
          summary: 'Get service stats',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/types': {
        get: {
          summary: 'Get service types',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/config': {
        get: {
          summary: 'Get service discovery config',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update service discovery config',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/{type}/{instanceId}/health': {
        post: {
          summary: 'Check service health',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'instanceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/{type}/{instanceId}/cache/summary': {
        get: {
          summary: 'Get service cache summary',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'instanceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/{type}/{instanceId}/cache': {
        get: {
          summary: 'Get service cache',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'instanceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/{type}/{instanceId}/stats/requests': {
        get: {
          summary: 'Get service request stats',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'instanceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/{type}/{instanceId}/stats/requests/reset': {
        post: {
          summary: 'Reset service request stats',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'instanceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/{type}/{instanceId}/stats/rate-limit': {
        post: {
          summary: 'Set service rate limit',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'instanceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/services/{type}/{instanceId}': {
        delete: {
          summary: 'Remove service instance',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'instanceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/services': {
        get: {
          summary: 'List all services',
          tags: ['Service Discovery'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/environments': {
        get: {
          summary: 'List environments',
          tags: ['Environments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create environment',
          tags: ['Environments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/environments/{environmentId}': {
        get: {
          summary: 'Get environment',
          tags: ['Environments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'environmentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update environment',
          tags: ['Environments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'environmentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete environment',
          tags: ['Environments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'environmentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/environments/{environmentId}/stats': {
        get: {
          summary: 'Get environment stats',
          tags: ['Environments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'environmentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/environments/{environmentId}/related-data': {
        get: {
          summary: 'Get environment related data',
          tags: ['Environments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'environmentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/environments/validate-name': {
        post: {
          summary: 'Validate environment name',
          tags: ['Environments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/environments/{sourceEnvironmentId}/copy/{targetEnvironmentId}/preview':
        {
          get: {
            summary: 'Preview environment copy',
            tags: ['Environments'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'sourceEnvironmentId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'targetEnvironmentId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      '/admin/orgs/{orgId}/projects/{projectId}/environments/{sourceEnvironmentId}/copy/{targetEnvironmentId}':
        {
          post: {
            summary: 'Copy environment',
            tags: ['Environments'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'sourceEnvironmentId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'targetEnvironmentId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags': {
        get: {
          summary: 'List feature flags',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create feature flag',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}': {
        get: {
          summary: 'Get feature flag',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update feature flag',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete feature flag',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/toggle': {
        post: {
          summary: 'Toggle feature flag',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/archive': {
        post: {
          summary: 'Archive feature flag',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/revive': {
        post: {
          summary: 'Revive archived flag',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/favorite': {
        post: {
          summary: 'Toggle flag favorite',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/mark-stale': {
        post: {
          summary: 'Mark flag as stale',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/unmark-stale': {
        post: {
          summary: 'Unmark flag as stale',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/strategies': {
        post: {
          summary: 'Add strategy to flag',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update strategies order',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/strategies/{strategyId}':
        {
          put: {
            summary: 'Update strategy',
            tags: ['Feature Flags'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'flagName',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'strategyId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
          delete: {
            summary: 'Delete strategy',
            tags: ['Feature Flags'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'flagName',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'strategyId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '204': {
                description: 'Deleted',
              },
            },
          },
        },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/variants': {
        put: {
          summary: 'Update flag variants',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/metrics': {
        get: {
          summary: 'Get flag metrics',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Submit flag metrics',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flags/{flagName}/metrics/apps': {
        get: {
          summary: 'Get flag metrics by app',
          tags: ['Feature Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flag-types': {
        get: {
          summary: 'List flag types',
          tags: ['Feature Flag Types'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/flag-types/{flagType}': {
        put: {
          summary: 'Update flag type',
          tags: ['Feature Flag Types'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagType',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/segments': {
        get: {
          summary: 'List segments',
          tags: ['Segments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create segment',
          tags: ['Segments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/segments/{id}': {
        get: {
          summary: 'Get segment',
          tags: ['Segments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update segment',
          tags: ['Segments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete segment',
          tags: ['Segments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/segments/{id}/references': {
        get: {
          summary: 'Get segment references',
          tags: ['Segments'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/context-fields': {
        get: {
          summary: 'List context fields',
          tags: ['Context Fields'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create context field',
          tags: ['Context Fields'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/context-fields/{fieldName}': {
        put: {
          summary: 'Update context field',
          tags: ['Context Fields'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'fieldName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete context field',
          tags: ['Context Fields'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'fieldName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/context-fields/{fieldName}/references': {
        get: {
          summary: 'Get context field references',
          tags: ['Context Fields'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'fieldName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/traffic': {
        get: {
          summary: 'Get feature traffic',
          tags: ['Feature Traffic'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/traffic/aggregated': {
        get: {
          summary: 'Get aggregated traffic',
          tags: ['Feature Traffic'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/traffic/aggregated/by-app': {
        get: {
          summary: 'Get traffic aggregated by app',
          tags: ['Feature Traffic'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/summary': {
        get: {
          summary: 'Get feature summary',
          tags: ['Feature Traffic'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/applications': {
        get: {
          summary: 'Get feature applications',
          tags: ['Feature Traffic'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/evaluations': {
        get: {
          summary: 'Get feature evaluations',
          tags: ['Feature Traffic'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/evaluations/timeseries': {
        get: {
          summary: 'Get evaluation timeseries',
          tags: ['Feature Traffic'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/evaluations/timeseries/by-app': {
        get: {
          summary: 'Get evaluation timeseries by app',
          tags: ['Feature Traffic'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/playground': {
        post: {
          summary: 'Evaluate feature flag playground',
          tags: ['Feature Playground'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/clone': {
        post: {
          summary: 'Clone feature flags',
          tags: ['Feature Import/Export'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/import': {
        post: {
          summary: 'Import feature flags',
          tags: ['Feature Import/Export'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/features/code-references/summary': {
        get: {
          summary: 'Get code references summary',
          tags: ['Code References'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/tags': {
        get: {
          summary: 'List tags',
          tags: ['Tags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create tag',
          tags: ['Tags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/tags/{id}': {
        put: {
          summary: 'Update tag',
          tags: ['Tags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete tag',
          tags: ['Tags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/tags/assignments': {
        get: {
          summary: 'Get tag assignments',
          tags: ['Tags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update tag assignments',
          tags: ['Tags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds': {
        get: {
          summary: 'List game worlds',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create game world',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/id/{id}': {
        get: {
          summary: 'Get game world by ID',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/world/{worldId}': {
        get: {
          summary: 'Get game world by world ID',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'worldId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/{id}': {
        put: {
          summary: 'Update game world',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete game world',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/{id}/toggle-visibility': {
        patch: {
          summary: 'Toggle game world visibility',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/{id}/toggle-maintenance': {
        patch: {
          summary: 'Toggle maintenance mode',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/{id}/maintenance': {
        patch: {
          summary: 'Update maintenance settings',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/update-orders': {
        patch: {
          summary: 'Update display orders',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/{id}/move-up': {
        patch: {
          summary: 'Move game world up',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/{id}/move-down': {
        patch: {
          summary: 'Move game world down',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/game-worlds/invalidate-cache': {
        post: {
          summary: 'Invalidate game worlds cache',
          tags: ['Game Worlds'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/maintenance': {
        post: {
          summary: 'Set maintenance status',
          tags: ['Maintenance'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/maintenance/isUnderMaintenance': {
        get: {
          summary: 'Get maintenance status',
          tags: ['Maintenance'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/maintenance/templates': {
        get: {
          summary: 'Get maintenance templates',
          tags: ['Maintenance'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Save maintenance templates',
          tags: ['Maintenance'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/message-templates': {
        get: {
          summary: 'List message templates',
          tags: ['Message Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create message template',
          tags: ['Message Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/message-templates/{id}': {
        get: {
          summary: 'Get message template',
          tags: ['Message Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update message template',
          tags: ['Message Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete message template',
          tags: ['Message Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/message-templates/bulk-delete': {
        post: {
          summary: 'Bulk delete message templates',
          tags: ['Message Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/message-templates/{id}/tags': {
        get: {
          summary: 'Get message template tags',
          tags: ['Message Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update message template tags',
          tags: ['Message Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions': {
        get: {
          summary: 'List client versions',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create client version',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions/meta/platforms': {
        get: {
          summary: 'Get available platforms',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions/meta/versions': {
        get: {
          summary: 'Get version metadata',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions/export': {
        get: {
          summary: 'Export client versions',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions/bulk-status': {
        patch: {
          summary: 'Bulk update status',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions/bulk': {
        post: {
          summary: 'Bulk create client versions',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions/{id}': {
        get: {
          summary: 'Get client version',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update client version',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete client version',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions/{id}/tags': {
        get: {
          summary: 'Get client version tags',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update client version tags',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/client-versions/reset/all': {
        delete: {
          summary: 'Reset all client versions',
          tags: ['Client Versions'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/service-notices': {
        get: {
          summary: 'List service notices',
          tags: ['Service Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create service notice',
          tags: ['Service Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/service-notices/{id}': {
        get: {
          summary: 'Get service notice',
          tags: ['Service Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update service notice',
          tags: ['Service Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete service notice',
          tags: ['Service Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/service-notices/bulk-delete': {
        post: {
          summary: 'Bulk delete service notices',
          tags: ['Service Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/service-notices/{id}/toggle-active': {
        patch: {
          summary: 'Toggle service notice active',
          tags: ['Service Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/ingame-popup-notices': {
        get: {
          summary: 'List ingame popup notices',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create ingame popup notice',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/ingame-popup-notices/{id}': {
        get: {
          summary: 'Get popup notice',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update popup notice',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete popup notice',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/ingame-popup-notices/bulk-delete': {
        post: {
          summary: 'Bulk delete popup notices',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/ingame-popup-notices/{id}/toggle-active': {
        patch: {
          summary: 'Toggle popup notice active',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/surveys': {
        get: {
          summary: 'List surveys',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create survey',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/surveys/config': {
        get: {
          summary: 'Get survey config',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update survey config',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/surveys/platform/{platformSurveyId}': {
        get: {
          summary: 'Get survey by platform ID',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'platformSurveyId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/surveys/{id}': {
        get: {
          summary: 'Get survey',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update survey',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete survey',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/surveys/{id}/toggle-active': {
        patch: {
          summary: 'Toggle survey active',
          tags: ['Surveys'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/banners': {
        get: {
          summary: 'List banners',
          tags: ['Banners'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create banner',
          tags: ['Banners'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/banners/{bannerId}': {
        get: {
          summary: 'Get banner',
          tags: ['Banners'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'bannerId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update banner',
          tags: ['Banners'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'bannerId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete banner',
          tags: ['Banners'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'bannerId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/banners/{bannerId}/publish': {
        post: {
          summary: 'Publish banner',
          tags: ['Banners'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'bannerId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/banners/{bannerId}/archive': {
        post: {
          summary: 'Archive banner',
          tags: ['Banners'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'bannerId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/banners/{bannerId}/duplicate': {
        post: {
          summary: 'Duplicate banner',
          tags: ['Banners'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'bannerId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products': {
        get: {
          summary: 'List store products',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create store product',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
        delete: {
          summary: 'Bulk delete store products',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products/sync/preview': {
        get: {
          summary: 'Preview store sync',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products/sync/apply': {
        post: {
          summary: 'Apply store sync',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products/stats': {
        get: {
          summary: 'Get store product stats',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products/count-by-filter': {
        get: {
          summary: 'Count products by filter',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products/bulk-active-by-filter': {
        patch: {
          summary: 'Bulk toggle active by filter',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products/bulk-active': {
        patch: {
          summary: 'Bulk toggle active',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products/{id}': {
        get: {
          summary: 'Get store product',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update store product',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete store product',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/store-products/{id}/toggle-active': {
        patch: {
          summary: 'Toggle store product active',
          tags: ['Store Products'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/reward-templates': {
        get: {
          summary: 'List reward templates',
          tags: ['Reward Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create reward template',
          tags: ['Reward Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/reward-templates/{id}': {
        get: {
          summary: 'Get reward template',
          tags: ['Reward Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update reward template',
          tags: ['Reward Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete reward template',
          tags: ['Reward Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/reward-templates/{id}/references': {
        get: {
          summary: 'Get reward template references',
          tags: ['Reward Templates'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings': {
        get: {
          summary: 'List coupon settings',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create coupon setting',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/usage': {
        get: {
          summary: 'Get coupon usage',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/usage/export': {
        get: {
          summary: 'Export coupon usage',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/usage/export-chunked': {
        get: {
          summary: 'Export coupon usage chunked',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/{id}': {
        get: {
          summary: 'Get coupon setting',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        patch: {
          summary: 'Update coupon setting',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete coupon setting',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/{id}/usage': {
        get: {
          summary: 'Get coupon setting usage',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/{id}/issued-codes-stats': {
        get: {
          summary: 'Get issued codes stats',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/{id}/issued-codes-export': {
        get: {
          summary: 'Export issued codes',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/{id}/issued-codes': {
        get: {
          summary: 'Get issued codes',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/{id}/generation-status': {
        get: {
          summary: 'Get generation status',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/{id}/recalculate-cache': {
        post: {
          summary: 'Recalculate coupon cache',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/coupon-settings/admin/recalculate-cache-all': {
        post: {
          summary: 'Recalculate all coupon cache',
          tags: ['Coupon Settings'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/reward-lookup': {
        get: {
          summary: 'Reward lookup',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/reward-types': {
        get: {
          summary: 'Get reward types',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/reward-types/{rewardType}/items': {
        get: {
          summary: 'Get reward type items',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'rewardType',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/ui-list': {
        get: {
          summary: 'Get UI list',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/ui-list/{category}/items': {
        get: {
          summary: 'Get UI list items',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'category',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/stats': {
        get: {
          summary: 'Get planning data stats',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/upload': {
        post: {
          summary: 'Upload planning data',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/preview-diff': {
        post: {
          summary: 'Preview planning data diff',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/history': {
        get: {
          summary: 'Get planning data history',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete planning data history',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/latest': {
        get: {
          summary: 'Get latest planning data',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/hottimebuff': {
        get: {
          summary: 'Get hot time buff data',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/eventpage': {
        get: {
          summary: 'Get event page data',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/liveevent': {
        get: {
          summary: 'Get live event data',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/materecruiting': {
        get: {
          summary: 'Get mate recruiting data',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/planning-data/oceannpcarea': {
        get: {
          summary: 'Get ocean NPC area data',
          tags: ['Planning Data'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/data-management/export': {
        get: {
          summary: 'Export data',
          tags: ['Data Management'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/data-management/import': {
        post: {
          summary: 'Import data',
          tags: ['Data Management'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/templates': {
        get: {
          summary: 'List release flow templates',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create template',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/templates/{id}': {
        get: {
          summary: 'Get template',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update template',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete template',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/apply': {
        post: {
          summary: 'Apply release flow',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/plans/flag/{flagId}': {
        get: {
          summary: 'Get plans by flag',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/plans/{flagId}/{environmentId}': {
        get: {
          summary: 'Get plan for flag+env',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'environmentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/plans/{planId}/milestones/{milestoneId}/start':
        {
          post: {
            summary: 'Start milestone',
            tags: ['Release Flows'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'planId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'milestoneId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/plans/{id}': {
        delete: {
          summary: 'Delete plan',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/plans/{id}/start': {
        post: {
          summary: 'Start plan',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/plans/{id}/pause': {
        post: {
          summary: 'Pause plan',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/plans/{id}/resume': {
        post: {
          summary: 'Resume plan',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/plans/{id}/progress': {
        post: {
          summary: 'Progress plan',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/milestones/{milestoneId}/transition':
        {
          put: {
            summary: 'Set milestone transition',
            tags: ['Release Flows'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'milestoneId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
          delete: {
            summary: 'Remove milestone transition',
            tags: ['Release Flows'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'milestoneId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '204': {
                description: 'Deleted',
              },
            },
          },
        },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/milestones/{milestoneId}/safeguards':
        {
          get: {
            summary: 'Get milestone safeguards',
            tags: ['Release Flows'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'milestoneId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/milestones/{milestoneId}/safeguards/evaluate':
        {
          post: {
            summary: 'Evaluate milestone safeguards',
            tags: ['Release Flows'],
            security: [
              {
                bearerAuth: [],
              },
            ],
            parameters: [
              {
                name: 'orgId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'projectId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'milestoneId',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/safeguards': {
        post: {
          summary: 'Create safeguard',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/safeguards/{safeguardId}': {
        put: {
          summary: 'Update safeguard',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'safeguardId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete safeguard',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'safeguardId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/release-flows/safeguards/{safeguardId}/reset': {
        post: {
          summary: 'Reset safeguard',
          tags: ['Release Flows'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'safeguardId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests': {
        get: {
          summary: 'List change requests',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/my': {
        get: {
          summary: 'List my change requests',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/stats': {
        get: {
          summary: 'Get change request stats',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}': {
        get: {
          summary: 'Get change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        patch: {
          summary: 'Update change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}/items/{itemId}': {
        delete: {
          summary: 'Remove change request item',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'itemId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}/submit': {
        post: {
          summary: 'Submit change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}/approve': {
        post: {
          summary: 'Approve change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}/reject': {
        post: {
          summary: 'Reject change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}/reopen': {
        post: {
          summary: 'Reopen change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}/execute': {
        post: {
          summary: 'Execute change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}/revert-preview': {
        get: {
          summary: 'Preview change request revert',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/change-requests/{id}/revert': {
        post: {
          summary: 'Revert change request',
          tags: ['Change Requests'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/signal-endpoints': {
        get: {
          summary: 'List signal endpoints',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create signal endpoint',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/signal-endpoints/{id}': {
        get: {
          summary: 'Get signal endpoint',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update signal endpoint',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete signal endpoint',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/signal-endpoints/{id}/toggle': {
        post: {
          summary: 'Toggle signal endpoint',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/signal-endpoints/{id}/tokens': {
        post: {
          summary: 'Create endpoint token',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/signal-endpoints/{id}/tokens/{tokenId}': {
        delete: {
          summary: 'Delete endpoint token',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'tokenId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/signal-endpoints/{id}/signals': {
        get: {
          summary: 'Get endpoint signals',
          tags: ['Signal Endpoints'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/actions': {
        get: {
          summary: 'List action sets',
          tags: ['Action Sets'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create action set',
          tags: ['Action Sets'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/actions/{id}': {
        get: {
          summary: 'Get action set',
          tags: ['Action Sets'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update action set',
          tags: ['Action Sets'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete action set',
          tags: ['Action Sets'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/actions/{id}/toggle': {
        post: {
          summary: 'Toggle action set',
          tags: ['Action Sets'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/actions/{id}/events': {
        get: {
          summary: 'Get action set events',
          tags: ['Action Sets'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/service-accounts': {
        get: {
          summary: 'List service accounts',
          tags: ['Service Accounts'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create service account',
          tags: ['Service Accounts'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/service-accounts/{id}': {
        get: {
          summary: 'Get service account',
          tags: ['Service Accounts'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update service account',
          tags: ['Service Accounts'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete service account',
          tags: ['Service Accounts'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/service-accounts/{id}/tokens': {
        post: {
          summary: 'Create service account token',
          tags: ['Service Accounts'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/service-accounts/{id}/tokens/{tokenId}': {
        delete: {
          summary: 'Delete service account token',
          tags: ['Service Accounts'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'tokenId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/api-tokens': {
        get: {
          summary: 'List API tokens',
          tags: ['API Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create API token',
          tags: ['API Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/api-tokens/stats': {
        get: {
          summary: 'Get API token stats',
          tags: ['API Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/api-tokens/{id}': {
        put: {
          summary: 'Update API token',
          tags: ['API Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete API token',
          tags: ['API Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/api-tokens/{id}/regenerate': {
        post: {
          summary: 'Regenerate API token',
          tags: ['API Tokens'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/platform-defaults': {
        get: {
          summary: 'List platform defaults',
          tags: ['Platform Defaults'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update all platform defaults',
          tags: ['Platform Defaults'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/platform-defaults/{platform}': {
        get: {
          summary: 'Get platform default',
          tags: ['Platform Defaults'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'platform',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update platform default',
          tags: ['Platform Defaults'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'platform',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete platform default',
          tags: ['Platform Defaults'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'platform',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/unknown-flags': {
        get: {
          summary: 'List unknown flags',
          tags: ['Unknown Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/unknown-flags/count': {
        get: {
          summary: 'Get unknown flags count',
          tags: ['Unknown Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/unknown-flags/{id}/resolve': {
        post: {
          summary: 'Resolve unknown flag',
          tags: ['Unknown Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/unknown-flags/{id}/unresolve': {
        post: {
          summary: 'Unresolve unknown flag',
          tags: ['Unknown Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/unknown-flags/{id}': {
        delete: {
          summary: 'Delete unknown flag',
          tags: ['Unknown Flags'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/vars/kv': {
        get: {
          summary: 'List KV vars',
          tags: ['Vars'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        post: {
          summary: 'Create KV var',
          tags: ['Vars'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/vars/kv/{key}': {
        get: {
          summary: 'Get KV var',
          tags: ['Vars'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'key',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update KV var',
          tags: ['Vars'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'key',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete KV var',
          tags: ['Vars'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'key',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/vars/{key}': {
        get: {
          summary: 'Get var',
          tags: ['Vars'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'key',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update var',
          tags: ['Vars'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'key',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/cms/cash-shop': {
        get: {
          summary: 'Get CMS cash shop data',
          tags: ['CMS Cash Shop'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/server-lifecycle/events': {
        get: {
          summary: 'Get server lifecycle events',
          tags: ['Server Lifecycle'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/server-lifecycle/summary': {
        get: {
          summary: 'Get server lifecycle summary',
          tags: ['Server Lifecycle'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/impact-metrics/available': {
        get: {
          summary: 'Get available metrics',
          tags: ['Impact Metrics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/impact-metrics/labels': {
        get: {
          summary: 'Get metric labels',
          tags: ['Impact Metrics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/impact-metrics': {
        get: {
          summary: 'Query time series',
          tags: ['Impact Metrics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/impact-metrics/configs/{flagId}': {
        get: {
          summary: 'Get metric configs for flag',
          tags: ['Impact Metrics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'flagId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/impact-metrics/configs': {
        post: {
          summary: 'Create metric config',
          tags: ['Impact Metrics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '201': {
              description: 'Created',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/impact-metrics/configs/layouts': {
        put: {
          summary: 'Update metric layouts',
          tags: ['Impact Metrics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/orgs/{orgId}/projects/{projectId}/impact-metrics/configs/{id}': {
        put: {
          summary: 'Update metric config',
          tags: ['Impact Metrics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        delete: {
          summary: 'Delete metric config',
          tags: ['Impact Metrics'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'orgId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'projectId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Deleted',
            },
          },
        },
      },
      '/admin/users/me': {
        get: {
          summary: 'Get current user profile',
          tags: ['User Profile'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
        put: {
          summary: 'Update current user profile',
          tags: ['User Profile'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/admin/users/me/language': {
        put: {
          summary: 'Update preferred language',
          tags: ['User Profile'],
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from admin login',
        },
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
      description:
        'Server-side SDK API for game servers and tools. All endpoints require X-API-Token header authentication unless noted otherwise. Environment-specific endpoints resolve the environment from the API token.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development',
      },
      {
        url: 'https://api.example.com/api/v1',
        description: 'Production',
      },
    ],
    paths: {
      '/server/test': {
        get: {
          summary: 'Test server SDK authentication',
          tags: ['Authentication'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/auth/verify-token': {
        post: {
          summary: 'Verify JWT token',
          description: 'Verify a JWT token (no API token required)',
          tags: ['Authentication'],
          responses: {
            '200': {
              description: 'Token verification result',
            },
          },
        },
      },
      '/server/auth/user/{id}': {
        get: {
          summary: 'Get user by ID',
          tags: ['Authentication'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/environments': {
        get: {
          summary: 'Get all environments',
          tags: ['Environments'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/users/sync': {
        get: {
          summary: 'Sync users',
          tags: ['Users'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/users/{id}': {
        get: {
          summary: 'Get user by ID',
          tags: ['Users'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/users/batch': {
        post: {
          summary: 'Get multiple users by IDs',
          tags: ['Users'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/notifications': {
        post: {
          summary: 'Send notification',
          tags: ['Notifications'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/notifications/bulk': {
        post: {
          summary: 'Send bulk notifications',
          tags: ['Notifications'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/files/upload-url': {
        post: {
          summary: 'Get file upload URL',
          tags: ['Files'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/files/{fileId}': {
        get: {
          summary: 'Get file info',
          tags: ['Files'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'fileId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/chat/register': {
        post: {
          summary: 'Register chat server',
          tags: ['Chat'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/chat/unregister': {
        post: {
          summary: 'Unregister chat server',
          tags: ['Chat'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/chat/stats': {
        post: {
          summary: 'Report chat statistics',
          tags: ['Chat'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/chat/activity': {
        post: {
          summary: 'Report chat activity',
          tags: ['Chat'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/chat/servers': {
        get: {
          summary: 'Get registered chat servers',
          tags: ['Chat'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/features': {
        get: {
          summary: 'Get all feature flags',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/features/{flagName}': {
        get: {
          summary: 'Get feature flag by name',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'flagName',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/features/definitions': {
        get: {
          summary: 'Get flag definitions (for code scanner)',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/features/metrics': {
        post: {
          summary: 'Submit feature flag metrics',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/features/unknown': {
        post: {
          summary: 'Report unknown flag',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/features/code-references/report': {
        post: {
          summary: 'Submit code references report',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/segments': {
        get: {
          summary: 'Get all segments',
          tags: ['Segments'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/game-worlds': {
        get: {
          summary: 'Get active game worlds',
          tags: ['Game Worlds'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/game-worlds/{id}': {
        get: {
          summary: 'Get game world by ID',
          tags: ['Game Worlds'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/game-worlds/world/{worldId}': {
        get: {
          summary: 'Get game world by world ID',
          tags: ['Game Worlds'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'worldId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/ingame-popup-notices': {
        get: {
          summary: 'Get ingame popup notices',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/ingame-popup-notices/{id}': {
        get: {
          summary: 'Get popup notice by ID',
          tags: ['Ingame Popup Notices'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/surveys/settings': {
        get: {
          summary: 'Get survey settings',
          tags: ['Surveys'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/surveys': {
        get: {
          summary: 'Get surveys',
          tags: ['Surveys'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/surveys/{id}': {
        get: {
          summary: 'Get survey by ID',
          tags: ['Surveys'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/whitelists': {
        get: {
          summary: 'Get whitelists',
          tags: ['Whitelists'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/vars': {
        get: {
          summary: 'Get vars (KV)',
          tags: ['Vars'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/maintenance': {
        get: {
          summary: 'Get maintenance status',
          tags: ['Maintenance'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/client-versions': {
        get: {
          summary: 'Get client versions',
          tags: ['Client Versions'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/client-versions/{id}': {
        get: {
          summary: 'Get client version by ID',
          tags: ['Client Versions'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/service-notices': {
        get: {
          summary: 'Get service notices',
          tags: ['Service Notices'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/service-notices/{id}': {
        get: {
          summary: 'Get service notice by ID',
          tags: ['Service Notices'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/banners': {
        get: {
          summary: 'Get banners',
          tags: ['Banners'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/banners/{bannerId}': {
        get: {
          summary: 'Get banner by ID',
          tags: ['Banners'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'bannerId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/store-products': {
        get: {
          summary: 'Get store products',
          tags: ['Store Products'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/store-products/{id}': {
        get: {
          summary: 'Get store product by ID',
          tags: ['Store Products'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/planning-data/upload': {
        post: {
          summary: 'Upload planning data',
          tags: ['Planning Data'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/coupons/{code}/redeem': {
        post: {
          summary: 'Redeem coupon',
          tags: ['Coupons'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'code',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/services': {
        get: {
          summary: 'List services',
          tags: ['Service Discovery'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/services/register': {
        post: {
          summary: 'Register service',
          tags: ['Service Discovery'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/services/unregister': {
        post: {
          summary: 'Unregister service',
          tags: ['Service Discovery'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/services/status': {
        post: {
          summary: 'Report service status',
          tags: ['Service Discovery'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/services/whitelists': {
        get: {
          summary: 'Get service whitelists',
          tags: ['Service Discovery'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/services/{serviceType}/{instanceId}': {
        get: {
          summary: 'Get service instance',
          tags: ['Service Discovery'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'serviceType',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'instanceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/impact-metrics': {
        post: {
          summary: 'Submit impact metrics',
          tags: ['Impact Metrics'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/internal/tokens': {
        get: {
          summary: 'Get all valid API tokens (Edge)',
          tags: ['Internal'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/server/internal/token-usage-report': {
        post: {
          summary: 'Receive token usage report (Edge)',
          tags: ['Internal'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKeyHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Token',
          description: 'API token for server authentication',
        },
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
      description:
        'Client-side SDK API for game client applications. All endpoints require X-API-Token header authentication. The API token determines the environment for feature flag evaluation.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development',
      },
    ],
    paths: {
      '/client/test': {
        get: {
          summary: 'Test client SDK authentication',
          tags: ['Authentication'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/client/client-version': {
        get: {
          summary: 'Get client version info',
          tags: ['Version'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/client/game-worlds': {
        get: {
          summary: 'Get game worlds',
          tags: ['Game Worlds'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/client/cache-stats': {
        get: {
          summary: 'Get cache statistics',
          tags: ['Cache'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/client/invalidate-cache': {
        post: {
          summary: 'Invalidate cache',
          tags: ['Cache'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/client/features/eval': {
        post: {
          summary: 'Evaluate feature flags',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Feature flag evaluation results',
            },
          },
        },
        get: {
          summary: 'Evaluate feature flags (GET)',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Feature flag evaluation results',
            },
          },
        },
      },
      '/client/features/stream/sse': {
        get: {
          summary: 'Stream feature flag updates (SSE)',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Server-Sent Events stream for real-time flag invalidation',
            },
          },
        },
      },
      '/client/features/metrics': {
        post: {
          summary: 'Submit feature flag metrics',
          tags: ['Feature Flags'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/client/crashes/upload': {
        post: {
          summary: 'Upload crash report',
          tags: ['Crash Reports'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/client/banners': {
        get: {
          summary: 'Get banners',
          tags: ['Banners'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/client/banners/{bannerId}': {
        get: {
          summary: 'Get banner by ID',
          tags: ['Banners'],
          security: [
            {
              apiKeyHeader: [],
            },
          ],
          parameters: [
            {
              name: 'bannerId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKeyHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Token',
          description: 'API token for client authentication',
        },
      },
    },
  };
}

export default OpenApiPage;
