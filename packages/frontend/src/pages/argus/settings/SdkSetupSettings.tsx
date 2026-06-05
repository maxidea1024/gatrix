import React from 'react';
import { Box } from '@mui/material';
import { SettingsCard, CodeBlock } from './components/SettingsShared';
import { ArgusProject } from '@/services/argusService';

interface SdkSetupSettingsProps {
  project: ArgusProject | null;
  projectId: string;
  name: string;
  txnRate: number;
  sessionRate: number;
  isDark: boolean;
  t: any;
}

export const SdkSetupSettings: React.FC<SdkSetupSettingsProps> = ({
  project, projectId, name, txnRate, sessionRate, isDark, t
}) => {
  const activeKey = project?.dsn_keys?.find(k => k.is_active);
  const dsnExample = activeKey?.dsn || 'https://<key>@<host>/argus/<project-id>';

  return (
    <SettingsCard title={t('argus.settings.sdkGuide')} desc={t('argus.settings.sdkGuideDesc')} isDark={isDark}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <CodeBlock title={t('argus.settings.jsTitle')} language="javascript" isDark={isDark}
          code={`import * as Argus from '@argus/browser';\n\nArgus.init({\n  dsn: '${dsnExample}',\n  environment: 'production',\n  release: '${name}@1.0.0',\n  tracesSampleRate: ${txnRate},\n  sessionSampleRate: ${sessionRate},\n});`} />
        <CodeBlock title={t('argus.settings.nodeTitle')} language="javascript" isDark={isDark}
          code={`const Argus = require('@argus/node');\n\nArgus.init({\n  dsn: '${dsnExample}',\n  environment: process.env.NODE_ENV,\n  release: '${name}@1.0.0',\n  tracesSampleRate: ${txnRate},\n});`} />
        <CodeBlock title={t('argus.settings.curlTitle')} language="bash" isDark={isDark}
          code={`curl -X POST '${window.location.origin}/argus/api/${projectId}/ingest/batch' \\\n  -H 'Authorization: Bearer ${activeKey?.public_key || '<your-key>'}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"events": [{"type": "error", ...}]}'`} />
      </Box>
    </SettingsCard>
  );
};

export default SdkSetupSettings;
