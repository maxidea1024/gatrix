import React, { useEffect, useState } from 'react';
import { Box, Chip, Typography, Skeleton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Reward } from '../../services/surveyService';
import { RewardTypeInfo, RewardItem } from '../../services/planningDataService';
import rewardTemplateService from '../../services/rewardTemplateService';
import { usePlanningData } from '../../contexts/PlanningDataContext';

interface RewardDisplayProps {
  rewards?: any[];
  rewardTemplateId?: string | null;
  maxDisplay?: number;
}

/**
 * Display component for participation rewards
 * Shows reward type and item name with quantity
 */
const RewardDisplay: React.FC<RewardDisplayProps> = ({ rewards, rewardTemplateId, maxDisplay = 3 }) => {
  const { t } = useTranslation();
  const { rewardTypes, rewardLookup, isLoading: contextLoading } = usePlanningData();
  const [rewardTypeMap, setRewardTypeMap] = useState<Map<number, RewardTypeInfo>>(new Map());
  const [rewardItemsMap, setRewardItemsMap] = useState<Map<string, RewardItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [displayRewards, setDisplayRewards] = useState<Reward[]>([]);

  // Set display rewards from props or load from template
  useEffect(() => {
    const loadRewards = async () => {
      try {
        // If rewards are provided, use them
        if (rewards && rewards.length > 0) {
          // Convert from backend format (rewardType, itemId) to frontend format (type, id)
          const convertedRewards = rewards.map((reward: any) => ({
            type: reward.type !== undefined ? reward.type : reward.rewardType,
            id: reward.id !== undefined ? reward.id : (reward.itemId ? parseInt(reward.itemId.split('_')[1] || reward.itemId) : 0),
            quantity: reward.quantity,
          }));
          setDisplayRewards(convertedRewards);
          return;
        }

        // If no rewards but rewardTemplateId is provided, load from template
        if (rewardTemplateId) {
          const template = await rewardTemplateService.getRewardTemplateById(rewardTemplateId);
          if (template && template.rewardItems && Array.isArray(template.rewardItems)) {
            const convertedRewards = template.rewardItems.map((item: any) => ({
              type: item.rewardType || item.type || 0,
              id: item.itemId || item.id || 0,
              quantity: item.quantity || 0,
            }));
            setDisplayRewards(convertedRewards);
          } else {
            setDisplayRewards([]);
          }
        } else {
          setDisplayRewards([]);
        }
      } catch (error) {
        console.error('Failed to load rewards:', error);
        setDisplayRewards([]);
      }
    };

    loadRewards();
  }, [rewards, rewardTemplateId]);

  // Build reward type map from context
  useEffect(() => {
    if (rewardTypes && rewardTypes.length > 0) {
      const typeMap = new Map<number, RewardTypeInfo>();
      rewardTypes.forEach(type => {
        typeMap.set(type.value, type);
      });
      setRewardTypeMap(typeMap);
    }
  }, [rewardTypes]);

  // Build reward items map from context lookup data
  useEffect(() => {
    if (displayRewards && displayRewards.length > 0) {
      const itemsMap = new Map<string, RewardItem>();

      // Get unique reward types
      const uniqueTypes = [...new Set(displayRewards.map(r => parseInt(r.type)))];

      // Extract items from reward lookup data if available
      if (rewardLookup) {
        uniqueTypes.forEach(rewardType => {
          const rewardTypeData = rewardLookup[rewardType];
          if (rewardTypeData?.items && Array.isArray(rewardTypeData.items)) {
            rewardTypeData.items.forEach(item => {
              itemsMap.set(`${rewardType}_${item.id}`, item);
            });
          }
        });
      }

      setRewardItemsMap(itemsMap);
      setLoading(false);
    } else if (!contextLoading && displayRewards && displayRewards.length === 0) {
      setLoading(false);
    }
  }, [rewardLookup, displayRewards, contextLoading]);

  // No rewards
  if (!displayRewards || displayRewards.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('surveys.noRewards')}
      </Typography>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {[...Array(Math.min(displayRewards.length, maxDisplay))].map((_, idx) => (
          <Skeleton key={idx} variant="rectangular" width={120} height={24} sx={{ borderRadius: 1 }} />
        ))}
      </Box>
    );
  }

  // Get reward label
  const getRewardLabel = (reward: Reward): string => {
    const rewardType = parseInt(reward.type);
    const typeInfo = rewardTypeMap.get(rewardType);

    if (!typeInfo) {
      return `${t('surveys.unknownReward')} (${reward.type})`;
    }

    // Get localized type name
    const typeName = t(typeInfo.nameKey);

    // If has table, get item name
    if (typeInfo.hasTable) {
      const item = rewardItemsMap.get(`${rewardType}_${reward.id}`);
      if (item) {
        // Use + prefix for all rewards (unified format)
        return `${item.name} +${reward.quantity}`;
      } else {
        return `${typeName} #${reward.id} +${reward.quantity}`;
      }
    } else {
      // Value-based reward (no item table) - use + prefix for experience, fame, etc.
      return `${typeName} +${reward.quantity}`;
    }
  };

  // Get reward tooltip
  const getRewardTooltip = (reward: Reward): string => {
    const rewardType = parseInt(reward.type);
    const typeInfo = rewardTypeMap.get(rewardType);

    if (!typeInfo) {
      return `${t('surveys.unknownReward')} (${reward.type})`;
    }

    // Get localized type name
    const typeName = t(typeInfo.nameKey);

    // If has table, get item name
    if (typeInfo.hasTable) {
      const item = rewardItemsMap.get(`${rewardType}_${reward.id}`);
      if (item) {
        return `[${typeName}] ${reward.id}:${item.name} +${reward.quantity}`;
      } else {
        return `[${typeName}] ${reward.id}:Unknown +${reward.quantity}`;
      }
    } else {
      // Value-based reward (no item table)
      return `[${typeName}] +${reward.quantity}`;
    }
  };

  // Display rewards
  const rewardsToDisplay = showAll ? displayRewards : displayRewards.slice(0, maxDisplay);
  const hasMore = displayRewards.length > maxDisplay;

  // Darker orange color (15% darker than #ff9800)
  const orangeColor = '#d98200';

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
      {rewardsToDisplay.map((reward, idx) => (
        <Tooltip key={idx} title={getRewardTooltip(reward)} arrow>
          <Chip
            label={getRewardLabel(reward)}
            size="small"
            variant="outlined"
            sx={{
              borderColor: orangeColor,
              color: orangeColor,
              '&:hover': {
                backgroundColor: `${orangeColor}14`,
              }
            }}
          />
        </Tooltip>
      ))}
      {hasMore && !showAll && (
        <Typography
          variant="caption"
          color="primary"
          sx={{
            cursor: 'pointer',
            textDecoration: 'underline',
            '&:hover': {
              color: 'primary.dark',
            }
          }}
          onClick={() => setShowAll(true)}
        >
          +{displayRewards.length - maxDisplay} {t('surveys.moreRewards')}
        </Typography>
      )}
      {showAll && hasMore && (
        <Typography
          variant="caption"
          color="primary"
          sx={{
            cursor: 'pointer',
            textDecoration: 'underline',
            '&:hover': {
              color: 'primary.dark',
            }
          }}
          onClick={() => setShowAll(false)}
        >
          {t('surveys.showLess')}
        </Typography>
      )}
    </Box>
  );
};

export default RewardDisplay;

