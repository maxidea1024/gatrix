import React from 'react';

export interface WizardFieldDef {
  key: string;
  labelKey: string;
  labelFallback: string;
  placeholder: string;
  type?: string; // 'text' | 'password' | 'select'
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

export interface WizardStep {
  titleKey: string;
  subtitleKey: string;
}

export interface ProviderWizardModalProps {
  open: boolean;
  onClose: () => void;
  provider: WizardProviderConfig | null;
  fields: WizardFieldDef[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  wizardTitleKey?: string;
  initialData?: Record<string, string>;
  onTestConnection?: (
    data: Record<string, string>
  ) => Promise<{ ok: boolean; message: string }>;
}
