import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Poll as PollIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import surveyService, { Survey } from '../../services/surveyService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import SurveyFormDialog from '../../components/game/SurveyFormDialog';
import SurveyConfigDialog from '../../components/game/SurveyConfigDialog';

const SurveysPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Load surveys
  const loadSurveys = async () => {
    try {
      setLoading(true);
      const result = await surveyService.getSurveys({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
      });

      if (result && result.surveys) {
        setSurveys(result.surveys);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid survey response:', result);
        setSurveys([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load surveys:', error);
      enqueueSnackbar(error.message || t('surveys.loadFailed'), { variant: 'error' });
      setSurveys([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, [page, rowsPerPage, debouncedSearchTerm]);

  // Handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, survey: Survey) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedSurvey(survey);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedSurvey(null);
  };

  const handleEdit = () => {
    if (selectedSurvey) {
      setDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!selectedSurvey) return;

    if (!window.confirm(t('surveys.confirmDelete'))) {
      handleMenuClose();
      return;
    }

    try {
      await surveyService.deleteSurvey(selectedSurvey.id);
      enqueueSnackbar(t('surveys.deleteSuccess'), { variant: 'success' });
      loadSurveys();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('surveys.deleteFailed'), { variant: 'error' });
    }
    handleMenuClose();
  };

  const handleToggleActive = async () => {
    if (!selectedSurvey) return;

    try {
      await surveyService.toggleActive(selectedSurvey.id);
      enqueueSnackbar(t('surveys.toggleSuccess'), { variant: 'success' });
      loadSurveys();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('surveys.toggleFailed'), { variant: 'error' });
    }
    handleMenuClose();
  };

  const handleCreate = () => {
    setSelectedSurvey(null);
    setDialogOpen(true);
  };

  const handleConfigOpen = () => {
    setConfigDialogOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PollIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('surveys.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('surveys.subtitle')}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={handleConfigOpen}
          >
            {t('surveys.config')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            {t('surveys.createSurvey')}
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder={t('surveys.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('surveys.platformSurveyId')}</TableCell>
                  <TableCell>{t('surveys.surveyTitle')}</TableCell>
                  <TableCell>{t('surveys.triggerConditions')}</TableCell>
                  <TableCell>{t('surveys.status')}</TableCell>
                  <TableCell>{t('surveys.createdAt')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <EmptyTableRow
                    colSpan={6}
                    loading={true}
                    message=""
                    loadingMessage={t('common.loadingData')}
                  />
                ) : surveys.length === 0 ? (
                  <EmptyTableRow
                    colSpan={6}
                    loading={false}
                    message={t('surveys.noSurveysFound')}
                    loadingMessage=""
                  />
                ) : (
                  surveys.map((survey) => (
                    <TableRow key={survey.id} hover>
                      <TableCell>{survey.platformSurveyId}</TableCell>
                      <TableCell>{survey.surveyTitle}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {survey.triggerConditions.map((condition, idx) => (
                            <Chip
                              key={idx}
                              label={`${t(`surveys.condition.${condition.type}`)}: ${condition.value}`}
                              size="small"
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={survey.isActive ? t('common.active') : t('common.inactive')}
                          color={survey.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDateTimeDetailed(survey.createdAt)}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, survey)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {total > 0 && (
            <SimplePagination
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleToggleActive}>
          <ListItemText>
            {selectedSurvey?.isActive ? t('surveys.deactivate') : t('surveys.activate')}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Survey Form Dialog */}
      <SurveyFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedSurvey(null);
        }}
        onSuccess={loadSurveys}
        survey={selectedSurvey}
      />

      {/* Config Dialog */}
      <SurveyConfigDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
      />
    </Box>
  );
};

export default SurveysPage;

