
import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Stack,
    Chip,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    CircularProgress,
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
} from '@mui/material';
import {
    PlayArrow as StartIcon,
    ArrowForward as AdvanceIcon,
    LibraryAdd as TemplateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
    useReleaseFlowTemplates,
    useReleaseFlowPlan,
} from '../../hooks/useReleaseFlows';
import {
    applyTemplate,
    startMilestone,
} from '../../services/releaseFlowService';
import { formatRelativeTime } from '../../utils/dateFormat';
import SafeguardPanel from './SafeguardPanel';

interface ReleaseFlowTabProps {
    flagId: string;
    flagName: string;
    environments: Array<{ environment: string; displayName: string }>;
    canManage: boolean;
}

const ReleaseFlowTab: React.FC<ReleaseFlowTabProps> = ({
    flagId,
    flagName,
    environments,
    canManage,
}) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const [selectedEnv, setSelectedEnv] = useState<string>(
        environments.length > 0 ? environments[0].environment : ''
    );

    const { data: templates, isLoading: loadingTemplates } = useReleaseFlowTemplates();
    const {
        data: plan,
        isLoading: loadingPlan,
        mutate: mutatePlan
    } = useReleaseFlowPlan(flagId, selectedEnv);

    const [applying, setApplying] = useState(false);
    const [startingMilestone, setStartingMilestone] = useState(false);
    const [showApplyDialog, setShowApplyDialog] = useState(false);

    // Handle template application
    const handleApplyTemplate = async (templateId: string) => {
        try {
            setApplying(true);
            await applyTemplate({
                flagId,
                environment: selectedEnv,
                templateId,
            });
            enqueueSnackbar(t('releaseFlow.applySuccess'), { variant: 'success' });
            mutatePlan();
            setShowApplyDialog(false);
        } catch (error: any) {
            enqueueSnackbar(error.message || t('releaseFlow.applyFailed'), { variant: 'error' });
        } finally {
            setApplying(false);
        }
    };

    // Handle starting a milestone
    const handleStartMilestone = async (milestoneId: string) => {
        if (!plan) return;
        try {
            setStartingMilestone(true);
            await startMilestone(plan.id, milestoneId);
            enqueueSnackbar(t('releaseFlow.milestoneStartSuccess'), { variant: 'success' });
            mutatePlan();
        } catch (error: any) {
            enqueueSnackbar(error.message || t('releaseFlow.milestoneStartFailed'), { variant: 'error' });
        } finally {
            setStartingMilestone(false);
        }
    };

    const milestones = plan?.milestones || [];
    const currentMilestoneIndex = plan
        ? milestones.findIndex((m) => m.id === plan.activeMilestoneId)
        : -1;

    if (loadingPlan && !plan) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            {/* Environment Selector */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2">{t('featureFlags.environment')}:</Typography>
                <Stack direction="row" spacing={1}>
                    {environments.map((env) => (
                        <Chip
                            key={env.environment}
                            label={env.displayName}
                            onClick={() => setSelectedEnv(env.environment)}
                            color={selectedEnv === env.environment ? 'primary' : 'default'}
                            variant={selectedEnv === env.environment ? 'filled' : 'outlined'}
                        />
                    ))}
                </Stack>
            </Box>

            {!plan ? (
                /* Empty State - Selection from Templates */
                <Box>
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 4,
                            textAlign: 'center',
                            borderRadius: 2,
                            bgcolor: 'background.neutral',
                        }}
                    >
                        <TemplateIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                            {t('releaseFlow.noActivePlan')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            {t('releaseFlow.noActivePlanDesc')}
                        </Typography>
                        {canManage && (
                            <Button
                                variant="contained"
                                startIcon={<StartIcon />}
                                onClick={() => setShowApplyDialog(true)}
                            >
                                {t('releaseFlow.startReleaseFlow')}
                            </Button>
                        )}
                    </Paper>
                </Box>
            ) : (
                /* Active Plan View */
                <Box sx={{ display: 'flex', gap: 3 }}>
                    <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                        <Card variant="outlined">
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                                    <Box>
                                        <Typography variant="h6">{plan.displayName || plan.flowName}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('releaseFlow.planStarted')}: {formatRelativeTime(plan.createdAt)}
                                        </Typography>
                                    </Box>
                                    {plan.activeMilestoneId === 'completed' && (
                                        <Chip
                                            label={t('common.completed').toUpperCase()}
                                            color="success"
                                            size="small"
                                        />
                                    )}
                                </Box>

                                <Stepper
                                    activeStep={currentMilestoneIndex === -1 && plan.activeMilestoneId === 'completed' ? milestones.length : currentMilestoneIndex}
                                    orientation="vertical"
                                >
                                    {milestones.map((milestone, index) => (
                                        <Step key={milestone.id}>
                                            <StepLabel
                                                optional={
                                                    milestone.startedAt && (
                                                        <Typography variant="caption">
                                                            {t('common.started')}: {formatRelativeTime(milestone.startedAt)}
                                                        </Typography>
                                                    )
                                                }
                                            >
                                                <Typography variant="subtitle1" fontWeight={index === currentMilestoneIndex ? 700 : 400}>
                                                    {milestone.name}
                                                </Typography>
                                            </StepLabel>
                                            <StepContent>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                    {milestone.description}
                                                </Typography>

                                                {/* Strategy Details in Milestone */}
                                                <Box sx={{ mb: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                                                    <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                                                        {t('releaseFlow.appliedStrategies')}
                                                    </Typography>
                                                    {milestone.strategies?.map((strategy, sIdx) => (
                                                        <Box key={sIdx} sx={{ mb: 1 }}>
                                                            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <AdvanceIcon sx={{ fontSize: 14 }} />
                                                                {strategy.strategyName}
                                                                {strategy.parameters?.rollout !== undefined && (
                                                                    <Chip label={`${strategy.parameters.rollout}%`} size="small" sx={{ height: 18 }} />
                                                                )}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>

                                                {/* Safeguards for this milestone */}
                                                {plan && index === currentMilestoneIndex && (
                                                    <Box sx={{ mb: 2 }}>
                                                        <SafeguardPanel
                                                            flowId={plan.id}
                                                            milestoneId={milestone.id}
                                                            canManage={canManage}
                                                        />
                                                    </Box>
                                                )}

                                                {canManage && plan.activeMilestoneId !== 'completed' && (index === currentMilestoneIndex || (currentMilestoneIndex === -1 && index === 0)) && (
                                                    <Button
                                                        variant="contained"
                                                        onClick={() => handleStartMilestone(milestone.id)}
                                                        disabled={startingMilestone}
                                                        startIcon={startingMilestone ? <CircularProgress size={16} /> : <StartIcon />}
                                                    >
                                                        {index === milestones.length - 1
                                                            ? t('releaseFlow.completeRelease')
                                                            : t('releaseFlow.startNextMilestone')}
                                                    </Button>
                                                )}
                                            </StepContent>
                                        </Step>
                                    ))}
                                </Stepper>
                            </CardContent>
                        </Card>
                    </Box>

                    <Box sx={{ width: 300, flexShrink: 0 }}>
                        {/* Sidebar info */}
                        <Stack spacing={2}>
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {t('releaseFlow.about')}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('releaseFlow.aboutDescription')}
                                    </Typography>
                                </CardContent>
                            </Card>

                            {canManage && plan.activeMilestoneId !== 'completed' && (
                                <Button
                                    color="inherit"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => setShowApplyDialog(true)}
                                    startIcon={<AdvanceIcon />}
                                >
                                    {t('releaseFlow.switchTemplate')}
                                </Button>
                            )}
                        </Stack>
                    </Box>
                </Box>
            )}

            {/* Apply Template Dialog */}
            <Dialog
                open={showApplyDialog}
                onClose={() => !applying && setShowApplyDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>{t('releaseFlow.selectTemplate')}</DialogTitle>
                <DialogContent dividers>
                    {loadingTemplates ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <List>
                            {templates?.map((template) => (
                                <ListItemButton
                                    key={template.id}
                                    onClick={() => handleApplyTemplate(template.id)}
                                    disabled={applying}
                                >
                                    <ListItemIcon>
                                        <TemplateIcon color="primary" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={template.displayName || template.flowName}
                                        secondary={template.description}
                                    />
                                </ListItemButton>
                            ))}
                            {templates?.length === 0 && (
                                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                                    {t('releaseFlow.noTemplatesFound')}
                                </Typography>
                            )}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowApplyDialog(false)} disabled={applying}>
                        {t('common.cancel')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ReleaseFlowTab;
