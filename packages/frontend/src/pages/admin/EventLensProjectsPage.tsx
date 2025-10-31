import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  keyframes,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Construction as ConstructionIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// Animation keyframes
const iconBounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
`;

const dotBounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
`;

const EventLensProjectsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FolderIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('eventLens.projects.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('eventLens.projects.subtitle')}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Coming Soon Card */}
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          {/* Animated Construction Icon */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
            <ConstructionIcon
              sx={{
                fontSize: 64,
                color: 'primary.main',
                animation: `${iconBounce} 2s ease-in-out infinite`,
              }}
            />
          </Box>

          {/* Coming Soon Text with Bouncing Dots */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
              {t('common.comingSoon')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {[0, 1, 2].map((index) => (
                <Box
                  key={index}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'text.secondary',
                    animation: `${dotBounce} 2s infinite`,
                    animationDelay: `${index * 0.25}s`,
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Subtitle */}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {t('eventLens.projects.comingSoonSubtitle')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EventLensProjectsPage;

