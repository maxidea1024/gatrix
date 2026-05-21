import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Close,
  ContentCopy,
  Publish,
  Unpublished,
  Quiz,
  Assessment,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import surveyTemplateService, {
  SurveyTemplate,
} from '@/services/surveyTemplateService';
import SurveyBuilderDialog from '@/components/game/survey-templates/SurveyBuilderDialog';
import SurveyResponseAnalytics from '@/components/game/survey-templates/SurveyResponseAnalytics';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import SearchTextField from '@/components/common/SearchTextField';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const SurveyTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission([P.SURVEYS_UPDATE]);
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const isInitialLoad = useRef(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(
    null
  );

  // Context menu
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTemplate, setMenuTemplate] = useState<SurveyTemplate | null>(null);

  // Analytics dialog
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTemplate, setAnalyticsTemplate] =
    useState<SurveyTemplate | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SurveyTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!projectApiPath) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await surveyTemplateService.getTemplates(projectApiPath, {
        search: search || undefined,
        limit: 50,
      });
      setTemplates(result.templates);
      setTotal(result.total);
    } catch {
      enqueueSnackbar(t('surveyTemplate.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [projectApiPath, search, t, enqueueSnackbar]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (tpl: SurveyTemplate) => {
    setEditingTemplate(tpl);
    setDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleSave = async (data: any) => {
    if (!projectApiPath) return;
    try {
      if (editingTemplate) {
        await surveyTemplateService.updateTemplate(
          projectApiPath,
          editingTemplate.id,
          data
        );
        enqueueSnackbar(t('surveyTemplate.updateSuccess'), {
          variant: 'success',
        });
      } else {
        await surveyTemplateService.createTemplate(projectApiPath, data);
        enqueueSnackbar(t('surveyTemplate.createSuccess'), {
          variant: 'success',
        });
      }
      setDialogOpen(false);
      loadTemplates();
    } catch {
      enqueueSnackbar(t('surveyTemplate.saveFailed'), { variant: 'error' });
    }
  };

  const handleDuplicate = async (tpl: SurveyTemplate) => {
    if (!projectApiPath) return;
    try {
      await surveyTemplateService.duplicateTemplate(projectApiPath, tpl.id);
      enqueueSnackbar(t('surveyTemplate.duplicateSuccess'), {
        variant: 'success',
      });
      loadTemplates();
    } catch {
      enqueueSnackbar(t('surveyTemplate.saveFailed'), { variant: 'error' });
    }
    setMenuAnchor(null);
  };

  const handleDelete = async (tpl: SurveyTemplate) => {
    if (!projectApiPath) return;
    try {
      await surveyTemplateService.deleteTemplate(projectApiPath, tpl.id);
      enqueueSnackbar(t('surveyTemplate.deleteSuccess'), {
        variant: 'success',
      });
      loadTemplates();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message || t('surveyTemplate.saveFailed'),
        {
          variant: 'error',
        }
      );
    }
    setDeleteTarget(null);
    setMenuAnchor(null);
  };

  const handleTogglePublish = async (tpl: SurveyTemplate) => {
    if (!projectApiPath) return;
    try {
      await surveyTemplateService.togglePublish(projectApiPath, tpl.id);
      enqueueSnackbar(
        t(
          tpl.isPublished
            ? 'surveyTemplate.unpublishSuccess'
            : 'surveyTemplate.publishSuccess'
        ),
        { variant: 'success' }
      );
      loadTemplates();
    } catch {
      enqueueSnackbar(t('surveyTemplate.saveFailed'), { variant: 'error' });
    }
    setMenuAnchor(null);
  };

  return (
    <>
      {/* Search + Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <SearchTextField
            value={search}
            onChange={setSearch}
            placeholder={t('surveyTemplate.searchPlaceholder')}
          />
        </Box>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreate}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('surveyTemplate.createTemplate')}
          </Button>
        )}
      </Box>

      {/* Content */}
      <PageContentLoader loading={loading && isInitialLoad.current}>
        {templates.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('surveyTemplate.noTemplates')}
            subtitle={t('surveyTemplate.noTemplatesDesc')}
            icon={<Quiz sx={{ fontSize: 48 }} />}
            onAddClick={canEdit ? handleCreate : undefined}
            addButtonLabel={t('surveyTemplate.createTemplate')}
          />
        ) : (
          <Grid container spacing={2}>
            {templates.map((tpl) => (
              <Grid key={tpl.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 2,
                      transform: 'translateY(-2px)',
                    },
                  }}
                  onClick={() => canEdit && handleEdit(tpl)}
                >
                  <CardContent>
                    <Box
                      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={600} noWrap>
                          {tpl.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            mb: 1.5,
                            minHeight: 40,
                          }}
                        >
                          {tpl.description || '—'}
                        </Typography>
                      </Box>
                      {canEdit && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuAnchor(e.currentTarget);
                            setMenuTemplate(tpl);
                          }}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={
                          tpl.isPublished
                            ? t('surveyTemplate.published')
                            : t('surveyTemplate.draft')
                        }
                        size="small"
                        color={tpl.isPublished ? 'success' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        label={`${tpl.questions.length} ${t('surveyTemplate.questions')}`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`v${tpl.version}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </PageContentLoader>
      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => menuTemplate && handleEdit(menuTemplate)}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('surveyTemplate.editTemplate')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuTemplate && handleDuplicate(menuTemplate)}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('surveyTemplate.duplicateTemplate')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => menuTemplate && handleTogglePublish(menuTemplate)}
        >
          <ListItemIcon>
            {menuTemplate?.isPublished ? (
              <Unpublished fontSize="small" />
            ) : (
              <Publish fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {menuTemplate?.isPublished
              ? t('surveyTemplate.draft')
              : t('surveyTemplate.published')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuTemplate) setDeleteTarget(menuTemplate);
            setMenuAnchor(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('surveyTemplate.deleteTemplate')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (menuTemplate) {
              setAnalyticsTemplate(menuTemplate);
              setAnalyticsOpen(true);
            }
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Assessment fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('surveyTemplate.viewResponses')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Builder Dialog */}
      <SurveyBuilderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        template={editingTemplate}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={t('surveyTemplate.deleteTemplate')}
        message={t('surveyTemplate.deleteConfirmMessage', {
          name: deleteTarget?.title || '',
        })}
        confirmText={t('common.delete')}
        confirmColor="error"
      />

      {/* Analytics Dialog */}
      <Dialog
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { minHeight: '60vh', maxHeight: '90vh' } }}
      >
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}
        >
          {analyticsTemplate?.title} — {t('surveyTemplate.responseAnalytics')}
          <IconButton
            onClick={() => setAnalyticsOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {analyticsTemplate && (
            <SurveyResponseAnalytics template={analyticsTemplate} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SurveyTemplatesPage;
