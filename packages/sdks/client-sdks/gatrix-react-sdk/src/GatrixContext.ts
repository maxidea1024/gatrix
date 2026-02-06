/**
 * GatrixContext - React Context for Gatrix SDK
 */
import React from 'react';
import type { GatrixClient, FeaturesClient } from '@gatrix/js-client-sdk';

export interface GatrixContextValue {
    /** GatrixClient instance */
    client: GatrixClient;
    /** FeaturesClient instance (shortcut for client.features) */
    features: FeaturesClient;
    /** Whether flags are ready */
    flagsReady: boolean;
    /** Last error that occurred */
    flagsError: any;
    /** Set flagsReady state */
    setFlagsReady: React.Dispatch<React.SetStateAction<boolean>>;
    /** Set flagsError state */
    setFlagsError: React.Dispatch<React.SetStateAction<any>>;
    /** Subscribe to events */
    on: GatrixClient['on'];
    /** Unsubscribe from events */
    off: GatrixClient['off'];
    /** Check if flag is enabled */
    isEnabled: FeaturesClient['isEnabled'];
    /** Get flag variant */
    getVariant: FeaturesClient['getVariant'];
    /** Update context */
    updateContext: FeaturesClient['updateContext'];
}

const GatrixFlagContext = React.createContext<GatrixContextValue | null>(null);

export default GatrixFlagContext;
