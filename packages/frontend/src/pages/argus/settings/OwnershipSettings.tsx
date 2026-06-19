import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Divider,
  TextField,
  Button,
  Chip,
  Avatar,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  Add as AddIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { SettingsCard } from './components/SettingsShared';
import ChipSelect from '@/components/common/ChipSelect';
import argusService, { ArgusOwnershipRule } from '@/services/argusService';
import PageContentLoader from '@/components/common/PageContentLoader';

interface OwnershipSettingsProps {
  projectId: string;
  isDark: boolean;
  t: any;
}

export const OwnershipSettings: React.FC<OwnershipSettingsProps> = ({
  projectId,
  isDark,
  t,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [rules, setRules] = useState<ArgusOwnershipRule[]>([]);
  const [ruleLoaded, setRuleLoaded] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    type: 'path',
    pattern: '',
    owners: '',
  });
  const [guideCollapsed, setGuideCollapsed] = useState(() => {
    try {
      return localStorage.getItem('argus_ownership_guide_collapsed') === '1';
    } catch {
      return false;
    }
  });

  const loadRules = async () => {
    try {
      const list = await argusService.listOwnershipRules(projectId);
      setRules(list);
      setRuleLoaded(true);
    } catch {
      setRuleLoaded(true);
    }
  };

  useEffect(() => {
    loadRules();
  }, [projectId]);

  const toggleGuide = useCallback(() => {
    setGuideCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          'argus_ownership_guide_collapsed',
          next ? '1' : '0'
        );
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const bdrSubtle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const inpSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: '0.875rem',
    },
  };

  return (
    <PageContentLoader loading={!ruleLoaded}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: '12px',
            overflow: 'hidden',
            border: `1px solid ${bdr}`,
            background: isDark
              ? 'linear-gradient(135deg, rgba(124,77,255,0.06) 0%, rgba(66,165,245,0.04) 100%)'
              : 'linear-gradient(135deg, rgba(124,77,255,0.04) 0%, rgba(66,165,245,0.02) 100%)',
          }}
        >
          <Box
            onClick={toggleGuide}
            sx={{
              px: 3,
              py: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
              '&:hover': {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.01)',
              },
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {t('argus.settings.ownershipGuideTitle')}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.78rem', mt: 0.3 }}
              >
                {t('argus.settings.ownershipGuideDesc')}
              </Typography>
            </Box>
            <IconButton
              size="small"
              sx={{
                transition: 'transform 0.2s',
                transform: guideCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Box>

          <Collapse in={!guideCollapsed} timeout={200}>
            <Divider sx={{ borderColor: bdr }} />

            {/* Syntax Reference */}
            <Box sx={{ px: 3, py: 2 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                  letterSpacing: '0.08em',
                  mb: 1.5,
                }}
              >
                {t('argus.settings.ownershipSyntaxTitle')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 1.5,
                }}
              >
                {(
                  [
                    {
                      type: 'path',
                      example: 'src/components/**',
                      desc: t('argus.settings.ownershipSyntaxPath'),
                      color: '#7c4dff',
                    },
                    {
                      type: 'module',
                      example: 'com.app.auth',
                      desc: t('argus.settings.ownershipSyntaxModule'),
                      color: '#42a5f5',
                    },
                    {
                      type: 'url',
                      example: '/api/v1/checkout*',
                      desc: t('argus.settings.ownershipSyntaxUrl'),
                      color: '#66bb6a',
                    },
                    {
                      type: 'tag',
                      example: 'browser:Chrome*',
                      desc: t('argus.settings.ownershipSyntaxTag'),
                      color: '#ffa726',
                    },
                  ] as const
                ).map((s) => (
                  <Box
                    key={s.type}
                    sx={{
                      p: 1.5,
                      borderRadius: '8px',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.8,
                        mb: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: s.color,
                          flexShrink: 0,
                        }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {s.type}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ fontSize: '0.72rem', color: s.color, mb: 0.3 }}
                    >
                      {s.example}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.68rem', lineHeight: 1.4 }}
                    >
                      {s.desc}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Examples */}
            <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${bdrSubtle}` }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                  letterSpacing: '0.08em',
                  mb: 1,
                }}
              >
                {t('argus.settings.ownershipExampleTitle')}
              </Typography>
              <Box
                sx={{
                  fontSize: '0.73rem',
                  lineHeight: 2,
                  color: isDark ? '#bbb' : '#555',
                  p: 1.5,
                  borderRadius: '6px',
                  backgroundColor: isDark
                    ? 'rgba(0,0,0,0.2)'
                    : 'rgba(0,0,0,0.03)',
                }}
              >
                <Box component="span" sx={{ color: '#7c4dff' }}>
                  path:
                </Box>
                src/frontend/**{' '}
                <Box component="span" sx={{ color: '#66bb6a' }}>
                  alice@team.com
                </Box>{' '}
                <Box component="span" sx={{ color: '#42a5f5' }}>
                  #frontend
                </Box>
                <br />
                <Box component="span" sx={{ color: '#ffa726' }}>
                  tag:
                </Box>
                level:fatal{' '}
                <Box component="span" sx={{ color: '#66bb6a' }}>
                  #oncall-team
                </Box>
                <br />
                <Box component="span" sx={{ color: '#42a5f5' }}>
                  url:
                </Box>
                /api/payments/**{' '}
                <Box component="span" sx={{ color: '#66bb6a' }}>
                  bob@team.com
                </Box>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mt: 1,
                  fontSize: '0.68rem',
                  fontStyle: 'italic',
                }}
              >
                {t('argus.settings.ownershipEvalDesc')}
              </Typography>
            </Box>
          </Collapse>
        </Paper>

        {/* Rules Card */}
        <SettingsCard
          title={t('argus.settings.ownership')}
          desc={
            ruleLoaded
              ? t('argus.settings.rulesCount', { count: rules.length })
              : t('argus.settings.ownershipDesc')
          }
          isDark={isDark}
        >
          {/* Add Rule Form */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 2,
              borderRadius: '10px',
              border: `1px solid ${bdr}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SecurityIcon sx={{ fontSize: 18, color: '#7c4dff' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                {t('argus.settings.addRule')}
              </Typography>
            </Box>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}
            >
              <Box sx={{ flex: 1 }}>
                <TextField
                  size="small"
                  placeholder={t('argus.settings.ruleName')}
                  value={newRule.name}
                  onChange={(e) =>
                    setNewRule({ ...newRule, name: e.target.value })
                  }
                  fullWidth
                  sx={inpSx}
                />
              </Box>
              <ChipSelect
                label={t('argus.settings.matchType')}
                value={newRule.type}
                onChange={(v) => setNewRule({ ...newRule, type: v })}
                options={[
                  {
                    value: 'path',
                    label: 'Path',
                    color: '#7c4dff',
                    desc: t('argus.settings.ownershipSyntaxPath'),
                  },
                  {
                    value: 'module',
                    label: 'Module',
                    color: '#42a5f5',
                    desc: t('argus.settings.ownershipSyntaxModule'),
                  },
                  {
                    value: 'url',
                    label: 'URL',
                    color: '#66bb6a',
                    desc: t('argus.settings.ownershipSyntaxUrl'),
                  },
                  {
                    value: 'tag',
                    label: 'Tag',
                    color: '#ffa726',
                    desc: t('argus.settings.ownershipSyntaxTag'),
                  },
                ]}
              />
            </Box>
            <Box sx={{ mb: 1.5 }}>
              <TextField
                size="small"
                placeholder={t('argus.settings.pattern')}
                value={newRule.pattern}
                onChange={(e) =>
                  setNewRule({ ...newRule, pattern: e.target.value })
                }
                fullWidth
                sx={inpSx}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: 'block', fontSize: '0.68rem' }}
              >
                {t('argus.settings.globHint')}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <TextField
                size="small"
                placeholder={t('argus.settings.owners')}
                value={newRule.owners}
                onChange={(e) =>
                  setNewRule({ ...newRule, owners: e.target.value })
                }
                fullWidth
                sx={inpSx}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: 'block', fontSize: '0.68rem' }}
              >
                {t('argus.settings.ownerHint')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                disabled={
                  !newRule.name.trim() ||
                  !newRule.pattern.trim() ||
                  !newRule.owners.trim()
                }
                onClick={async () => {
                  try {
                    await argusService.createOwnershipRule(projectId, {
                      name: newRule.name.trim(),
                      match_type: newRule.type,
                      match_pattern: newRule.pattern.trim(),
                      owners: newRule.owners
                        .split(',')
                        .map((o) => o.trim())
                        .filter(Boolean),
                    });
                    await loadRules();
                    setNewRule({
                      name: '',
                      type: 'path',
                      pattern: '',
                      owners: '',
                    });
                    enqueueSnackbar(t('argus.settings.ruleAdded'), {
                      variant: 'success',
                    });
                  } catch {
                    enqueueSnackbar(t('argus.settings.ruleFailed'), {
                      variant: 'error',
                    });
                  }
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: '8px',
                  px: 3,
                }}
              >
                {t('common.add')}
              </Button>
            </Box>
          </Paper>

          {/* Rules List */}
          {rules.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  mx: 'auto',
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(124,77,255,0.12), rgba(66,165,245,0.08))'
                    : 'linear-gradient(135deg, rgba(124,77,255,0.08), rgba(66,165,245,0.04))',
                }}
              >
                <SecurityIcon sx={{ fontSize: 28, color: '#7c4dff' }} />
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
                {t('argus.settings.noRules')}
              </Typography>
              <Typography
                color="text.secondary"
                sx={{
                  fontSize: '0.78rem',
                  mb: 2,
                  maxWidth: 360,
                  mx: 'auto',
                  lineHeight: 1.5,
                }}
              >
                {t('argus.settings.noRulesHint')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {rules.map((rule) => {
                const owners =
                  typeof rule.owners === 'string'
                    ? JSON.parse(rule.owners)
                    : rule.owners;
                const typeColor =
                  {
                    path: '#7c4dff',
                    module: '#42a5f5',
                    url: '#66bb6a',
                    tag: '#ffa726',
                  }[rule.match_type] || '#888';
                return (
                  <Paper
                    key={rule.id}
                    elevation={0}
                    sx={{
                      p: 0,
                      overflow: 'hidden',
                      border: `1px solid ${rule.enabled === false ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : bdr}`,
                      borderRadius: '10px',
                      opacity: rule.enabled === false ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      '&:hover': { borderColor: alpha(typeColor, 0.4) },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                      {/* Color accent bar */}
                      <Box
                        sx={{
                          width: 4,
                          flexShrink: 0,
                          backgroundColor: typeColor,
                          borderRadius: '10px 0 0 10px',
                        }}
                      />

                      {/* Content */}
                      <Box sx={{ flex: 1, p: 2, minWidth: 0 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 0.8,
                          }}
                        >
                          <Typography
                            sx={{ fontWeight: 700, fontSize: '0.85rem' }}
                          >
                            {rule.name}
                          </Typography>
                          <Chip
                            label={rule.match_type}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              backgroundColor: alpha(
                                typeColor,
                                isDark ? 0.15 : 0.1
                              ),
                              color: typeColor,
                              border: 'none',
                            }}
                          />
                          {rule.auto_assign && (
                            <Chip
                              label="auto-assign"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                backgroundColor: alpha('#7c4dff', 0.1),
                                color: '#7c4dff',
                                border: 'none',
                              }}
                            />
                          )}
                          {rule.enabled === false && (
                            <Chip
                              label={t('argus.settings.ruleDisabled')}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                backgroundColor: alpha(
                                  '#ff5252',
                                  isDark ? 0.15 : 0.1
                                ),
                                color: '#ff5252',
                                border: 'none',
                              }}
                            />
                          )}
                        </Box>

                        {/* Pattern line */}
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.8,
                            px: 1,
                            py: 0.3,
                            borderRadius: '4px',
                            mb: 1,
                            backgroundColor: isDark
                              ? 'rgba(0,0,0,0.2)'
                              : 'rgba(0,0,0,0.03)',
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              color: typeColor,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                            }}
                          >
                            {rule.match_type}:
                          </Box>
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              color: isDark ? '#ccc' : '#444',
                            }}
                          >
                            {rule.match_pattern}
                          </Typography>
                        </Box>

                        {/* Owners */}
                        <Box
                          sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
                        >
                          {(owners as string[]).map((o: string, i: number) => (
                            <Chip
                              key={i}
                              label={o}
                              size="small"
                              avatar={
                                <Avatar
                                  sx={{
                                    width: 18,
                                    height: 18,
                                    fontSize: '0.6rem',
                                    backgroundColor: alpha(typeColor, 0.2),
                                    color: typeColor,
                                  }}
                                >
                                  {o[0]?.toUpperCase()}
                                </Avatar>
                              }
                              sx={{
                                height: 22,
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                borderRadius: '6px',
                              }}
                            />
                          ))}
                        </Box>
                      </Box>

                      {/* Actions */}
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: 0.5,
                          px: 1,
                          borderLeft: `1px solid ${bdrSubtle}`,
                        }}
                      >
                        <Tooltip
                          title={
                            rule.enabled === false
                              ? t('argus.alerts.enable')
                              : t('argus.alerts.disable')
                          }
                        >
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                await argusService.updateOwnershipRule(
                                  projectId,
                                  rule.id,
                                  {
                                    enabled:
                                      rule.enabled === false ? true : false,
                                  }
                                );
                                await loadRules();
                              } catch {
                                enqueueSnackbar(
                                  t('argus.settings.ruleUpdateFailed'),
                                  { variant: 'error' }
                                );
                              }
                            }}
                            sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                          >
                            {rule.enabled === false ? (
                              <CancelIcon fontSize="small" />
                            ) : (
                              <CheckIcon
                                fontSize="small"
                                sx={{ color: '#66bb6a' }}
                              />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('argus.settings.deleteRule')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={async () => {
                              try {
                                await argusService.deleteOwnershipRule(
                                  projectId,
                                  rule.id
                                );
                                setRules((p) =>
                                  p.filter((r) => r.id !== rule.id)
                                );
                                enqueueSnackbar(
                                  t('argus.settings.ruleDeleted'),
                                  {
                                    variant: 'success',
                                  }
                                );
                              } catch {
                                enqueueSnackbar(
                                  t('argus.settings.ruleFailed'),
                                  {
                                    variant: 'error',
                                  }
                                );
                              }
                            }}
                            sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </SettingsCard>
      </Box>
    </PageContentLoader>
  );
};

export default OwnershipSettings;
