import React from 'react';
import {
    RocketLaunch as ReleaseIcon,
    Science as ExperimentIcon,
    Build as OperationalIcon,
    PowerOff as KillSwitchIcon,
    Security as PermissionIcon,
    Tune as RemoteConfigIcon,
    Flag as FlagIcon,
} from '@mui/icons-material';

/**
 * Returns the MUI icon component for a given flag type.
 * Centralizes icon mapping so all pages display consistent icons.
 */
export const getFlagTypeIcon = (
    flagType: string,
    size: number = 16
): React.ReactElement => {
    const iconProps = { sx: { fontSize: size } };
    switch (flagType) {
        case 'release':
            return <ReleaseIcon {...iconProps} color="primary" />;
        case 'experiment':
            return <ExperimentIcon {...iconProps} color="secondary" />;
        case 'operational':
            return <OperationalIcon {...iconProps} color="warning" />;
        case 'killSwitch':
            return <KillSwitchIcon {...iconProps} color="error" />;
        case 'permission':
            return <PermissionIcon {...iconProps} color="action" />;
        case 'remoteConfig':
            return <RemoteConfigIcon {...iconProps} color="info" />;
        default:
            return <FlagIcon {...iconProps} />;
    }
};

/**
 * Returns the MUI icon component based on iconName (stored in DB).
 * Used by FeatureFlagTypesPage where icon names come from the server.
 */
export const getFlagTypeIconByName = (
    iconName: string | null,
    size: number = 24
): React.ReactElement => {
    const iconProps = { sx: { fontSize: size } };
    switch (iconName) {
        case 'RocketLaunch':
            return <ReleaseIcon {...iconProps} sx={{ ...iconProps.sx, color: 'primary.main' }} />;
        case 'Science':
            return <ExperimentIcon {...iconProps} sx={{ ...iconProps.sx, color: 'secondary.main' }} />;
        case 'Build':
            return <OperationalIcon {...iconProps} sx={{ ...iconProps.sx, color: 'warning.main' }} />;
        case 'PowerSettingsNew':
            return <KillSwitchIcon {...iconProps} sx={{ ...iconProps.sx, color: 'error.main' }} />;
        case 'VpnKey':
            return <PermissionIcon {...iconProps} sx={{ ...iconProps.sx, color: 'info.main' }} />;
        case 'Tune':
        case 'Settings':
            return <RemoteConfigIcon {...iconProps} sx={{ ...iconProps.sx, color: 'info.main' }} />;
        default:
            return <FlagIcon {...iconProps} />;
    }
};
