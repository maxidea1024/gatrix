import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  LinearProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  BarChart,
  People,
  Refresh,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import surveyTemplateService, {
  SurveyTemplate,
  Question,
} from '@/services/surveyTemplateService';

interface Props {
  template: SurveyTemplate;
}

interface QuestionStat {
  count: number;
  values: Record<string, number>;
}

const SurveyResponseAnalytics: React.FC<Props> = ({ template }) => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const locale = i18n.language || 'ko';

  const [loading, setLoading] = useState(true);
  const [totalResponses, setTotalResponses] = useState(0);
  const [questionStats, setQuestionStats] = useState<Record<string, QuestionStat>>({});
  const [responses, setResponses] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [responsesTotal, setResponsesTotal] = useState(0);

  const questions = (template.questions || []).filter(
    (q) => q.type !== 'welcome' && q.type !== 'ending'
  );

  const loadData = async () => {
    if (!projectApiPath) return;
    setLoading(true);
    try {
      const [statsResult, responsesResult] = await Promise.all([
        surveyTemplateService.getResponseStats(projectApiPath, template.id),
        surveyTemplateService.getResponses(projectApiPath, template.id, {
          page: page + 1,
          limit: rowsPerPage,
        }),
      ]);
      setTotalResponses(statsResult.totalResponses);
      setQuestionStats(statsResult.questionStats || {});
      setResponses(responsesResult.responses);
      setResponsesTotal(responsesResult.total);
    } catch {
      enqueueSnackbar(t('surveyTemplate.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectApiPath, template.id, page, rowsPerPage]);

  const getLocText = (obj?: Record<string, string>): string => {
    if (!obj) return '';
    return obj[locale] || obj.ko || obj.en || Object.values(obj)[0] || '';
  };

  const getOptionLabel = (question: Question, optionId: string): string => {
    const opt = question.options?.find((o) => o.id === optionId);
    return opt ? getLocText(opt.label) : optionId;
  };

  if (loading && totalResponses === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <BarChart color="primary" />
        <Typography variant="h6" fontWeight={600}>
          {t('surveyTemplate.responseAnalytics')}
        </Typography>
        <Chip
          icon={<People fontSize="small" />}
          label={`${totalResponses} ${t('surveyTemplate.totalResponses')}`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t('common.refresh') || 'Refresh'}>
          <IconButton size="small" onClick={loadData} disabled={loading}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {totalResponses === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {t('surveyTemplate.noResponses')}
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Per-question stats */}
          {questions.map((q, idx) => (
            <QuestionStatsCard
              key={q.id}
              question={q}
              index={idx}
              stats={questionStats[q.id]}
              totalResponses={totalResponses}
              locale={locale}
              getOptionLabel={(optId) => getOptionLabel(q, optId)}
              getLocText={getLocText}
              t={t}
            />
          ))}

          <Divider sx={{ my: 3 }} />

          {/* Individual responses table */}
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            {t('surveyTemplate.individualResponses')}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>
                    {t('surveyTemplate.respondent')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 100 }}>
                    {t('surveyTemplate.submittedAt')}
                  </TableCell>
                  {questions.slice(0, 5).map((q, i) => (
                    <TableCell key={q.id} sx={{ fontWeight: 600, minWidth: 140 }}>
                      Q{i + 1}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {responses.map((resp) => (
                  <TableRow key={resp.id} hover>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {resp.accountId || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {resp.completedAt
                          ? new Date(resp.completedAt).toLocaleString()
                          : '—'}
                      </Typography>
                    </TableCell>
                    {questions.slice(0, 5).map((q) => {
                      const answer = resp.answers?.[q.id];
                      return (
                        <TableCell key={q.id}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {formatAnswer(answer, q, (optId) => getOptionLabel(q, optId))}
                          </Typography>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={responsesTotal}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </>
      )}
    </Box>
  );
};

// ==================== Sub-components ====================

interface QuestionStatsCardProps {
  question: Question;
  index: number;
  stats?: QuestionStat;
  totalResponses: number;
  locale: string;
  getOptionLabel: (optId: string) => string;
  getLocText: (obj?: Record<string, string>) => string;
  t: (key: string) => string;
}

const QuestionStatsCard: React.FC<QuestionStatsCardProps> = ({
  question,
  index,
  stats,
  totalResponses,
  getOptionLabel,
  getLocText,
  t,
}) => {
  const isChoice = ['single_choice', 'multiple_choice', 'dropdown'].includes(question.type);
  const isScale = ['rating', 'linear_scale'].includes(question.type);
  const isText = ['short_text', 'long_text'].includes(question.type);
  const responseCount = stats?.count || 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Chip label={`Q${index + 1}`} size="small" color="primary" variant="outlined" />
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          {getLocText(question.title)}
        </Typography>
        <Chip
          label={`${responseCount}/${totalResponses}`}
          size="small"
          variant="outlined"
        />
      </Box>

      {isChoice && stats && (
        <ChoiceDistribution
          stats={stats}
          totalResponses={totalResponses}
          getOptionLabel={getOptionLabel}
        />
      )}

      {isScale && stats && (
        <ScaleDistribution
          stats={stats}
          question={question}
        />
      )}

      {isText && (
        <Typography variant="body2" color="text.secondary">
          {t('surveyTemplate.textResponseCount')}: {responseCount}
        </Typography>
      )}

      {!stats && (
        <Typography variant="body2" color="text.disabled">
          {t('surveyTemplate.noResponses')}
        </Typography>
      )}
    </Paper>
  );
};

// Choice question distribution bars
const ChoiceDistribution: React.FC<{
  stats: QuestionStat;
  totalResponses: number;
  getOptionLabel: (optId: string) => string;
}> = ({ stats, totalResponses, getOptionLabel }) => {
  const entries = Object.entries(stats.values).sort((a, b) => b[1] - a[1]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {entries.map(([value, count]) => {
        const pct = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
        return (
          <Box key={value}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
              <Typography variant="body2" noWrap sx={{ flex: 1, mr: 1 }}>
                {getOptionLabel(value)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {count} ({pct}%)
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': { borderRadius: 4 },
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
};

// Scale/Rating distribution
const ScaleDistribution: React.FC<{
  stats: QuestionStat;
  question: Question;
}> = ({ stats, question }) => {
  const min = question.settings?.min || 1;
  const max = question.settings?.max || 5;
  const entries = Object.entries(stats.values);
  const totalCount = entries.reduce((sum, [, count]) => sum + count, 0);

  // Calculate weighted average
  let weightedSum = 0;
  entries.forEach(([val, count]) => {
    weightedSum += parseFloat(val) * count;
  });
  const average = totalCount > 0 ? (weightedSum / totalCount).toFixed(1) : '—';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="h4" fontWeight={700} color="primary">
          {average}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          / {max}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {Array.from({ length: max - min + 1 }, (_, i) => {
          const val = String(min + i);
          const count = stats.values[val] || 0;
          const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
          return (
            <Box key={val} sx={{ flex: 1, textAlign: 'center' }}>
              <Box
                sx={{
                  height: 48,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
              >
                <Box
                  sx={{
                    width: '70%',
                    height: `${Math.max(pct, 4)}%`,
                    bgcolor: 'primary.main',
                    borderRadius: '4px 4px 0 0',
                    minHeight: 2,
                    transition: 'height 0.3s',
                  }}
                />
              </Box>
              <Typography variant="caption" fontWeight={500}>
                {val}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                {count}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// Format answer for table display
function formatAnswer(
  answer: any,
  question: Question,
  getOptionLabel: (optId: string) => string
): string {
  if (answer === undefined || answer === null) return '—';
  if (Array.isArray(answer)) {
    return answer.map(getOptionLabel).join(', ');
  }
  if (['single_choice', 'dropdown'].includes(question.type)) {
    return getOptionLabel(String(answer));
  }
  return String(answer);
}

export default SurveyResponseAnalytics;
