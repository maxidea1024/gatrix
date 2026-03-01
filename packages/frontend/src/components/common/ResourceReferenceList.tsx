/**
 * ResourceReferenceList Component
 *
 * Reusable table component to display resource references (flags, segments, templates).
 * Used in reference check dialogs, edit forms, and anywhere references need to be shown.
 */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Flag as FlagIcon,
  People as SegmentIcon,
  AccountTree as TemplateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface ResourceReference {
  flags: { flagName: string; environmentId: string; strategyName?: string }[];
  segments?: { segmentName: string; id: string }[];
  templates?: { flowName: string; id: string; milestoneName?: string }[];
}

interface ResourceReferenceListProps {
  references: ResourceReference;
  /** Callback when a reference item is clicked (e.g. to close a dialog before navigating) */
  onNavigate?: () => void;
  /** Whether to show section headers */
  showHeaders?: boolean;
}

/**
 * Reusable component for displaying resource references in a clean table format.
 * Supports flags (with strategy detail), segments, and release templates.
 */
const ResourceReferenceList: React.FC<ResourceReferenceListProps> = ({
  references,
  onNavigate,
  showHeaders = true,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const hasFlags = references.flags.length > 0;
  const hasSegments = (references.segments?.length ?? 0) > 0;
  const hasTemplates = (references.templates?.length ?? 0) > 0;
  const hasAny = hasFlags || hasSegments || hasTemplates;

  const handleFlagClick = (flagName: string, environmentId?: string) => {
    onNavigate?.();
    const envParam = environmentId ? `?env=${encodeURIComponent(environmentId)}` : '';
    navigate(`/feature-flags/${encodeURIComponent(flagName)}${envParam}`);
  };

  const handleSegmentClick = () => {
    onNavigate?.();
    navigate('/feature-flags/segments');
  };

  const handleTemplateClick = () => {
    onNavigate?.();
    navigate('/feature-flags/templates');
  };

  if (!hasAny) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
        {t('common.noReferences')}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Referencing Feature Flags */}
      {hasFlags && (
        <Box>
          {showHeaders && (
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <FlagIcon fontSize="small" color="primary" />
              {t('common.referencingFlags')}
            </Typography>
          )}
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>
                    {t('featureFlags.flagName')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>
                    {t('featureFlags.environmentId')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>
                    {t('featureFlags.strategy')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {references.flags.map((flag, index) => (
                  <TableRow
                    key={`flag-${index}`}
                    hover
                    onClick={() => handleFlagClick(flag.flagName, flag.environmentId)}
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell sx={{ py: 0.75 }}>
                      <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                        {flag.flagName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Chip
                        label={flag.environmentId}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontSize: '0.8rem' }}
                      >
                        {flag.strategyName || '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Referencing Segments */}
      {hasSegments && (
        <Box>
          {showHeaders && (
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <SegmentIcon fontSize="small" color="primary" />
              {t('common.referencingSegments')}
            </Typography>
          )}
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>
                    {t('featureFlags.segmentName')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {references.segments!.map((segment, index) => (
                  <TableRow
                    key={`segment-${index}`}
                    hover
                    onClick={handleSegmentClick}
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell sx={{ py: 0.75 }}>
                      <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                        {segment.segmentName}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Referencing Release Templates */}
      {hasTemplates && (
        <Box>
          {showHeaders && (
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <TemplateIcon fontSize="small" color="primary" />
              {t('common.referencingTemplates')}
            </Typography>
          )}
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>
                    {t('releaseFlow.flowName')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 0.75 }}>
                    {t('releaseFlow.milestoneName')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {references.templates!.map((template, index) => (
                  <TableRow
                    key={`template-${index}`}
                    hover
                    onClick={handleTemplateClick}
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell sx={{ py: 0.75 }}>
                      <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                        {template.flowName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontSize: '0.8rem' }}
                      >
                        {template.milestoneName || '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
};

export default ResourceReferenceList;
