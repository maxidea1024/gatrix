import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog, Button, Typography, Box, TextField, IconButton,
  Alert, CircularProgress, useTheme, alpha, Tooltip, Fade,
  InputAdornment, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Check as CheckIcon, Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon, Save as SaveIcon,
  OpenInNew as OpenInNewIcon,
  Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────────────────

export interface WizardFieldDef {
  key: string;
  labelKey: string;
  labelFallback: string;
  placeholder: string;
  type?: string;            // 'text' | 'password' | 'select'
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
}

export interface WizardProviderConfig {
  id: string;
  name: string;
  color: string;
  accentColor: string;
  gradient: string;
  icon: React.ReactNode;
  descKey: string;
  guideUrl?: string;
  guideButtonKey?: string;
  guideDescKey?: string;
}

interface WizardStep {
  titleKey: string;
  subtitleKey: string;
}

interface ProviderWizardModalProps {
  open: boolean;
  onClose: () => void;
  provider: WizardProviderConfig | null;
  fields: WizardFieldDef[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  /** Title override for the wizard (e.g., "알림 채널 추가") */
  wizardTitleKey?: string;
}

// ─── Styled Input ───────────────────────────────────────────────────

const WizardInput: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  isDark: boolean; type?: string; hint?: string;
  required?: boolean; placeholder?: string;
}> = ({ label, value, onChange, isDark, type = 'text', hint, required, placeholder }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
        {label} {required && <Box component="span" sx={{ color: '#ef4444' }}>*</Box>}
      </Typography>
      <TextField
        fullWidth size="small" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        type={isPassword && !showPassword ? 'password' : 'text'}
        InputProps={{
          ...(isPassword ? {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ opacity: 0.5 }}>
                  {showPassword ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </InputAdornment>
            ),
          } : {}),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px', fontSize: '0.85rem',
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          },
        }}
      />
      {hint && <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.4, fontStyle: 'italic' }}>{hint}</Typography>}
    </Box>
  );
};

// ─── Main Component ─────────────────────────────────────────────────

export const ProviderWizardModal: React.FC<ProviderWizardModalProps> = ({
  open, onClose, provider, fields, onSubmit, wizardTitleKey,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Determine step count based on fields & guide
  // Step 0: Introduction (provider info + guide)
  // Step 1: Configuration (fields)
  // For providers with many fields (>4), split into 2 config steps
  const hasGuide = !!provider?.guideUrl;
  const splitThreshold = 4;
  const needsSplit = fields.length > splitThreshold;

  const buildSteps = useCallback((): WizardStep[] => {
    const steps: WizardStep[] = [
      {
        titleKey: 'argus.settings.providerWizard.introTitle',
        subtitleKey: 'argus.settings.providerWizard.introSubtitle',
      },
    ];
    if (needsSplit) {
      steps.push({
        titleKey: 'argus.settings.providerWizard.basicTitle',
        subtitleKey: 'argus.settings.providerWizard.basicSubtitle',
      });
      steps.push({
        titleKey: 'argus.settings.providerWizard.detailTitle',
        subtitleKey: 'argus.settings.providerWizard.detailSubtitle',
      });
    } else {
      steps.push({
        titleKey: 'argus.settings.providerWizard.configTitle',
        subtitleKey: 'argus.settings.providerWizard.configSubtitle',
      });
    }
    return steps;
  }, [needsSplit]);

  const steps = buildSteps();
  const totalSteps = steps.length;

  // Split fields for multi-step
  const firstFields = needsSplit ? fields.slice(0, splitThreshold) : fields;
  const secondFields = needsSplit ? fields.slice(splitThreshold) : [];

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setError('');
      setLoading(false);
      setFormData({});
    }
  }, [open]);

  if (!provider) return null;

  const cfg = provider;

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || t('argus.settings.providerWizard.saveFailed', 'Failed to save'));
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (activeStep === 0) return true; // Intro step always ok
    // Check required fields for current step
    const currentFields = activeStep === 1 ? firstFields : secondFields;
    return currentFields
      .filter(f => f.required !== false)
      .filter(f => f.key === 'name' || f.type === 'password' || f.required)
      .every(f => !!formData[f.key]?.trim());
  };

  const isLastStep = activeStep === totalSteps - 1;

  // ─── Render Intro Step ────────────────────────────────────────────
  const renderIntroStep = () => (
    <Box>
      <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
        {t(cfg.descKey)}
      </Typography>

      {hasGuide && (
        <Box sx={{
          p: 3, borderRadius: '12px', textAlign: 'center',
          border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '14px', mx: 'auto', mb: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: alpha(cfg.color, 0.1),
            '& .MuiSvgIcon-root': { fontSize: 30, color: cfg.color },
          }}>
            {cfg.icon}
          </Box>
          {cfg.guideDescKey && (
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2.5 }}>
              {t(cfg.guideDescKey)}
            </Typography>
          )}
          <Button
            variant="contained" size="large" endIcon={<OpenInNewIcon />}
            href={cfg.guideUrl} target="_blank" rel="noopener noreferrer"
            sx={{
              borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 4, py: 1.2,
              backgroundColor: cfg.accentColor, color: '#fff',
              '&:hover': { backgroundColor: alpha(cfg.accentColor, 0.85) },
            }}
          >
            {t(cfg.guideButtonKey || 'argus.settings.providerWizard.openGuide', '가이드 열기')}
          </Button>
        </Box>
      )}

      {!hasGuide && (
        <Box sx={{
          p: 3, borderRadius: '12px', textAlign: 'center',
          border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '14px', mx: 'auto', mb: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: alpha(cfg.color, 0.1),
            '& .MuiSvgIcon-root': { fontSize: 30, color: cfg.color },
          }}>
            {cfg.icon}
          </Box>
          <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, mb: 1 }}>
            {cfg.name}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.6 }}>
            {t('argus.settings.providerWizard.readyToSetup', '다음 단계에서 연결 정보를 입력합니다.')}
          </Typography>
        </Box>
      )}
    </Box>
  );

  // ─── Render Config Fields ─────────────────────────────────────────
  const renderFieldsStep = (fieldsToRender: WizardFieldDef[]) => (
    <Box>
      <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'text.secondary', mb: 3 }}>
        {t('argus.settings.providerWizard.fillFields', '아래 항목을 입력하여 연동을 완료하세요.')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {fieldsToRender.map(f => {
          if (f.type === 'select' && f.options) {
            return (
              <Box key={f.key} sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
                  {t(f.labelKey, f.labelFallback)}
                  {f.required && <Box component="span" sx={{ color: '#ef4444' }}> *</Box>}
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={formData[f.key] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                    displayEmpty
                    sx={{
                      borderRadius: '8px', fontSize: '0.85rem',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <MenuItem value="" disabled>
                      <Typography sx={{ color: 'text.disabled', fontSize: '0.85rem' }}>{f.placeholder}</Typography>
                    </MenuItem>
                    {f.options.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {f.hint && <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.4, fontStyle: 'italic' }}>{f.hint}</Typography>}
              </Box>
            );
          }
          return (
            <WizardInput
              key={f.key}
              label={t(f.labelKey, f.labelFallback)}
              value={formData[f.key] || ''}
              onChange={v => setFormData(prev => ({ ...prev, [f.key]: v }))}
              isDark={isDark}
              type={f.type}
              placeholder={f.placeholder}
              hint={f.hint}
              required={f.required !== false && (f.key === 'name' || !!f.required)}
            />
          );
        })}
      </Box>
    </Box>
  );

  // ─── Render Step Content ──────────────────────────────────────────
  const renderStepContent = () => {
    if (activeStep === 0) return renderIntroStep();
    if (activeStep === 1) return renderFieldsStep(firstFields);
    if (activeStep === 2) return renderFieldsStep(secondFields);
    return null;
  };

  return (
    <Dialog
      open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px', overflow: 'hidden',
          minHeight: 440, maxHeight: '85vh',
          display: 'flex', flexDirection: 'row',
        },
      }}
    >
      {/* ═══ LEFT SIDEBAR — Always Dark ═══ */}
      <Box sx={{
        width: 260, minWidth: 260, flexShrink: 0,
        background: cfg.gradient,
        color: '#fff',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <Box sx={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(cfg.accentColor, 0.12)} 0%, transparent 70%)` }} />
        <Box sx={{ position: 'absolute', bottom: -70, left: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(cfg.accentColor, 0.08)} 0%, transparent 70%)` }} />

        {/* Provider Header */}
        <Box sx={{ p: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)',
              '& .MuiSvgIcon-root': { fontSize: 22, color: '#fff' },
            }}>
              {cfg.icon}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>
                {wizardTitleKey ? t(wizardTitleKey) : cfg.name}
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.72rem', opacity: 0.55, lineHeight: 1.5, mt: 1 }}>
            {t(cfg.descKey)}
          </Typography>
        </Box>

        {/* Vertical Steps */}
        <Box sx={{ flex: 1, px: 3, py: 1 }}>
          {steps.map((step, idx) => {
            const isActive = idx === activeStep;
            const isCompleted = idx < activeStep;
            return (
              <Box key={idx} sx={{ display: 'flex', gap: 1.5, position: 'relative' }}>
                {/* Vertical connector line */}
                {idx < totalSteps - 1 && (
                  <Box sx={{
                    position: 'absolute', left: 15, top: 32, width: 2, height: 'calc(100% - 16px)',
                    zIndex: 0,
                    backgroundColor: isCompleted ? alpha(cfg.accentColor, 0.5) : 'rgba(255,255,255,0.08)',
                    transition: 'background-color 0.3s',
                  }} />
                )}
                {/* Step circle */}
                <Box sx={{
                  width: 32, height: 32, minWidth: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, zIndex: 1,
                  transition: 'all 0.3s ease',
                  ...(isCompleted ? {
                    backgroundColor: cfg.accentColor, color: '#fff',
                  } : isActive ? {
                    backgroundColor: '#1e3a5f',
                    border: `2px solid ${cfg.accentColor}`,
                    color: '#fff',
                    boxShadow: `0 0 0 4px ${alpha(cfg.accentColor, 0.15)}`,
                  } : {
                    backgroundColor: '#1a2030',
                    border: '2px solid #2a3444',
                    color: 'rgba(255,255,255,0.3)',
                  }),
                }}>
                  {isCompleted ? <CheckIcon sx={{ fontSize: 16 }} /> : idx + 1}
                </Box>
                {/* Step text */}
                <Box sx={{ py: 0.5, pb: 3 }}>
                  <Typography sx={{
                    fontSize: '0.78rem', fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.3s', lineHeight: 1.3,
                  }}>
                    {t(step.titleKey)}
                  </Typography>
                  <Typography sx={{
                    fontSize: '0.65rem', mt: 0.3,
                    color: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.3s',
                  }}>
                    {t(step.subtitleKey)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Bottom progress */}
        <Box sx={{ px: 3, pb: 3 }}>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
            {steps.map((_, idx) => (
              <Box key={idx} sx={{
                flex: 1, height: 3, borderRadius: 2,
                backgroundColor: idx <= activeStep ? cfg.accentColor : 'rgba(255,255,255,0.08)',
                transition: 'background-color 0.3s',
              }} />
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.65rem', opacity: 0.4, textAlign: 'center' }}>
            {activeStep + 1} / {totalSteps}
          </Typography>
        </Box>
      </Box>

      {/* ═══ RIGHT CONTENT ═══ */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Close button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5, pb: 0 }}>
          <IconButton size="small" onClick={onClose} sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Step Content */}
        <Box sx={{ flex: 1, px: 4, pb: 2, overflow: 'auto' }}>
          <Fade in key={activeStep} timeout={300}>
            <Box>
              {/* Step Header */}
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {t(steps[activeStep].titleKey)}
                </Typography>
              </Box>

              {/* Step Body */}
              {renderStepContent()}
              {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '10px' }}>{error}</Alert>}
            </Box>
          </Fade>
        </Box>

        {/* Footer Actions */}
        <Box sx={{
          px: 4, py: 2.5,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5,
        }}>
          {activeStep > 0 && (
            <Button
              onClick={() => setActiveStep(s => s - 1)}
              disabled={loading}
              startIcon={<ArrowBackIcon />}
              sx={{
                textTransform: 'none', fontWeight: 600, color: 'text.secondary',
                borderRadius: '10px', px: 2.5, py: 0.8,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
              }}
            >
              {t('common.back', '이전')}
            </Button>
          )}
          {isLastStep ? (
            <Button
              onClick={handleSave} variant="contained"
              disabled={loading || !canProceed()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SaveIcon sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 4, py: 1,
                backgroundColor: cfg.accentColor,
                '&:hover': { backgroundColor: alpha(cfg.accentColor, 0.85) },
                '&.Mui-disabled': { backgroundColor: alpha(cfg.accentColor, 0.3) },
              }}
            >
              {t('argus.settings.providerWizard.save', '연동 완료')}
            </Button>
          ) : (
            <Button
              onClick={() => setActiveStep(s => s + 1)} variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 4, py: 1,
                backgroundColor: cfg.accentColor,
                '&:hover': { backgroundColor: alpha(cfg.accentColor, 0.85) },
              }}
            >
              {t('common.next', '다음')}
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};
