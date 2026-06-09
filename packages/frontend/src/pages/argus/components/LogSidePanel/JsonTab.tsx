import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { CopyButton } from '@/components/common/CopyButton';
import { ArgusLogEntry } from '@/services/argusService';

export const JsonTab: React.FC<{ log: ArgusLogEntry; isDark: boolean }> = ({
  log,
  isDark,
}) => {
  const jsonStr = useMemo(() => JSON.stringify(log, null, 2), [log]);

  return (
    <Box sx={{ p: 2, overflow: 'auto' }}>
      <Box sx={{ position: 'relative' }}>
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            display: 'flex',
            justifyContent: 'flex-end',
            pt: 1,
            pr: 1,
            zIndex: 1,
          }}
        >
          <CopyButton text={jsonStr} size={14} />
        </Box>
        <Box
          component="pre"
          sx={{
            fontSize: '0.7rem',
            lineHeight: 1.6,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: '8px',
            p: 2,
            pt: 0,
            m: 0,
            mt: -3,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {jsonStr}
        </Box>
      </Box>
    </Box>
  );
};
