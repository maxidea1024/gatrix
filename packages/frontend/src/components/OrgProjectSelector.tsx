import React from 'react';
import {
  Select,
  MenuItem,
  Box,
  Typography,
  SelectChangeEvent,
  Divider,
  alpha,
} from '@mui/material';
import {
  Business as OrgIcon,
  Folder as ProjectIcon,
} from '@mui/icons-material';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useTranslation } from 'react-i18next';

interface OrgProjectSelectorProps {
  size?: 'small' | 'medium';
}

export const OrgProjectSelector: React.FC<OrgProjectSelectorProps> = ({
  size = 'small',
}) => {
  const { t } = useTranslation();
  const {
    organisations,
    currentOrg,
    currentOrgId,
    projects,
    currentProject,
    currentProjectId,
    isLoading,
    switchOrg,
    switchProject,
  } = useOrgProject();

  const handleOrgChange = (event: SelectChangeEvent<string>) => {
    switchOrg(event.target.value);
  };

  const handleProjectChange = (event: SelectChangeEvent<string>) => {
    switchProject(event.target.value);
  };

  // Don't render if not loaded or no orgs
  if (!isLoading && organisations.length === 0) {
    return null;
  }

  // Single org — only show project selector
  const showOrgSelector = organisations.length > 1;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {/* Organisation selector */}
      {showOrgSelector && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: 1,
            backgroundColor: (theme) =>
              alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
            border: (theme) =>
              `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          }}
        >
          <OrgIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />
          <Select
            value={currentOrgId || ''}
            onChange={handleOrgChange}
            size={size}
            variant="standard"
            displayEmpty
            sx={{
              minWidth: 80,
              color: 'inherit',
              fontWeight: 500,
              fontSize: '0.8rem',
              '.MuiSelect-select': {
                py: 0.25,
                pr: '20px !important',
              },
              '&:before, &:after': { display: 'none' },
              '.MuiSvgIcon-root': { color: 'inherit', right: 0 },
              '.MuiInput-input:focus': { backgroundColor: 'transparent' },
            }}
            renderValue={() => (
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, fontSize: '0.8rem' }}
                noWrap
              >
                {currentOrg?.displayName || currentOrg?.orgName || t('common.loading')}
              </Typography>
            )}
          >
            {organisations.map((org) => (
              <MenuItem key={org.id} value={org.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <OrgIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                  <Typography variant="body2">
                    {org.displayName || org.orgName}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}

      {/* Separator */}
      {showOrgSelector && (
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25, opacity: 0.3 }} />
      )}

      {/* Project selector */}
      {projects.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: 1,
            backgroundColor: (theme) =>
              alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.15 : 0.08),
            border: (theme) =>
              `1px solid ${alpha(theme.palette.info.main, 0.25)}`,
          }}
        >
          <ProjectIcon sx={{ fontSize: 16, color: 'inherit', opacity: 0.7 }} />
          <Select
            value={currentProjectId || ''}
            onChange={handleProjectChange}
            size={size}
            variant="standard"
            displayEmpty
            sx={{
              minWidth: 80,
              color: 'inherit',
              fontWeight: 500,
              fontSize: '0.8rem',
              '.MuiSelect-select': {
                py: 0.25,
                pr: '20px !important',
              },
              '&:before, &:after': { display: 'none' },
              '.MuiSvgIcon-root': { color: 'inherit', right: 0 },
              '.MuiInput-input:focus': { backgroundColor: 'transparent' },
            }}
            renderValue={() => (
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, fontSize: '0.8rem' }}
                noWrap
              >
                {currentProject?.displayName || currentProject?.projectName || t('common.loading')}
              </Typography>
            )}
          >
            {projects.map((proj) => (
              <MenuItem key={proj.id} value={proj.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ProjectIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                  <Box>
                    <Typography variant="body2">
                      {proj.displayName || proj.projectName}
                    </Typography>
                    {proj.isDefault && (
                      <Typography variant="caption" sx={{ opacity: 0.6 }}>
                        {t('common.default')}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}
    </Box>
  );
};

export default OrgProjectSelector;
