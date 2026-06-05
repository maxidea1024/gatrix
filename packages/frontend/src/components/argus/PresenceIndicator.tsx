import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Avatar, Tooltip, Badge, alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Viewer {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  lastSeen: number;
  cursor?: string; // e.g. "stacktrace", "breadcrumbs", "logs"
}

interface PresenceIndicatorProps {
  projectId: string;
  resourceId: string; // issueId or pageId
  resourceType: 'issue' | 'page';
  currentUser: { id: string; name: string; avatar?: string };
  isDark: boolean;
}

const COLORS = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800'];

function getColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Multiplayer Presence Indicator.
 * Shows who else is viewing the same resource.
 * 
 * In production, this would connect to a WebSocket/SSE endpoint.
 * Currently uses localStorage polling as a demonstration.
 */
const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  projectId, resourceId, resourceType, currentUser, isDark,
}) => {
  const { t } = useTranslation();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Register presence
  const registerPresence = useCallback(() => {
    const key = `argus_presence_${projectId}_${resourceType}_${resourceId}`;
    const now = Date.now();
    
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      // Add/update current user
      existing[currentUser.id] = {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        color: getColor(currentUser.id),
        lastSeen: now,
      };

      // Clean expired (>30 seconds)
      const cleaned: Record<string, Viewer> = {};
      for (const [id, viewer] of Object.entries(existing)) {
        if ((viewer as Viewer).lastSeen > now - 30000) {
          cleaned[id] = viewer as Viewer;
        }
      }

      localStorage.setItem(key, JSON.stringify(cleaned));

      // Set other viewers (exclude self)
      const others = Object.values(cleaned).filter(v => v.id !== currentUser.id);
      setViewers(others);
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [projectId, resourceId, resourceType, currentUser]);

  useEffect(() => {
    registerPresence();
    intervalRef.current = setInterval(registerPresence, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Clean up presence on unmount
      try {
        const key = `argus_presence_${projectId}_${resourceType}_${resourceId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        delete existing[currentUser.id];
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (e) {}
    };
  }, [registerPresence, projectId, resourceId, resourceType, currentUser.id]);

  const totalViewers = viewers.length + 1; // +1 for current user

  if (viewers.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{
          width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4caf50',
          boxShadow: '0 0 4px rgba(76,175,80,0.5)',
        }} />
        <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
          {t('argus.presence.onlyYou', 'Only you')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {/* Live dot */}
      <Box sx={{
        width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4caf50',
        boxShadow: '0 0 4px rgba(76,175,80,0.5)',
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
          '0%': { boxShadow: '0 0 4px rgba(76,175,80,0.5)' },
          '50%': { boxShadow: '0 0 8px rgba(76,175,80,0.8)' },
          '100%': { boxShadow: '0 0 4px rgba(76,175,80,0.5)' },
        },
      }} />

      {/* Viewer count */}
      <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', fontWeight: 600 }}>
        {totalViewers} {t('argus.presence.viewing', 'viewing')}
      </Typography>

      {/* Avatar stack */}
      <Box sx={{ display: 'flex', ml: 0.5 }}>
        {viewers.slice(0, 5).map((viewer, i) => (
          <Tooltip key={viewer.id} title={viewer.name}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <Box sx={{
                  width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4caf50',
                  border: `1.5px solid ${isDark ? '#1e1e1e' : '#fff'}`,
                }} />
              }
            >
              <Avatar sx={{
                width: 24, height: 24, fontSize: '0.6rem', fontWeight: 700,
                backgroundColor: viewer.color,
                border: `2px solid ${isDark ? '#1e1e1e' : '#fff'}`,
                marginLeft: i > 0 ? '-8px' : 0,
                zIndex: 5 - i,
              }}>
                {viewer.avatar ? <img src={viewer.avatar} alt="" style={{ width: '100%' }} /> : getInitials(viewer.name)}
              </Avatar>
            </Badge>
          </Tooltip>
        ))}
        {viewers.length > 5 && (
          <Avatar sx={{
            width: 24, height: 24, fontSize: '0.58rem', fontWeight: 700,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            color: 'text.secondary',
            marginLeft: '-8px', zIndex: 0,
            border: `2px solid ${isDark ? '#1e1e1e' : '#fff'}`,
          }}>
            +{viewers.length - 5}
          </Avatar>
        )}
      </Box>
    </Box>
  );
};

export default PresenceIndicator;
