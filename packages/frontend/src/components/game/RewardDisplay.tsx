import React, { useEffect, useState } from 'react';
import { Box, Chip, Typography, Skeleton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ParticipationReward } from '../../services/surveyService';
import planningDataService, { RewardTypeInfo, RewardItem } from '../../services/planningDataService';
import rewardTemplateService from '../../services/rewardTemplateService';

interface RewardDisplayProps {
  rewards?: ParticipationReward[];
  rewardTemplateId?: string | null;
  maxDisplay?: number;
}

/**
 * Display component for participation rewards
 * Shows reward type and item name with quantity
 * Can display either direct rewards or rewards from a template
 */
const RewardDisplay: React.FC<RewardDisplayProps> = ({ rewards, rewardTemplateId, maxDisplay = 3 }) => {
  const { t } = useTranslation();
  const [rewardTypeMap, setRewardTypeMap] = useState<Map<number, RewardTypeInfo>>(new Map());
  const [rewardItemsMap, setRewardItemsMap] = useState<Map<string, RewardItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [displayRewards, setDisplayRewards] = useState<ParticipationReward[]>([]);

  // Load template rewards if rewardTemplateId is provided
  useEffect(() => {
    const loadTemplateRewards = async () => {
      if (rewardTemplateId) {
        try {
          const template = await rewardTemplateService.getRewardTemplateById(rewardTemplateId);
          setDisplayRewards(template.rewardItems || []);
        } catch (error) {
          console.error('Failed to load reward template:', error);
          setDisplayRewards([]);
        }
      } else {
        setDisplayRewards(rewards || []);
      }
    };

    loadTemplateRewards();
  }, [rewardTemplateId, rewards]);

  // Load reward types and items
  useEffect(() => {
    const loadRewardData = async () => {
      try {
        setLoading(true);

        // Load reward types (using getRewardTypeList function)
        const types = await planningDataService.getRewardTypeList();
        const typeMap = new Map<number, RewardTypeInfo>();
        types.forEach(type => {
          typeMap.set(type.value, type);
        });
        setRewardTypeMap(typeMap);

        // Load all reward items for the types used in rewards
        if (displayRewards && displayRewards.length > 0) {
          const itemsMap = new Map<string, RewardItem>();

          // Get unique reward types
          const uniqueTypes = [...new Set(displayRewards.map(r => parseInt(r.rewardType)))];

          // Load items for each type that has a table
          await Promise.all(
            uniqueTypes.map(async (rewardType) => {
              const typeInfo = typeMap.get(rewardType);
              if (typeInfo?.hasTable) {
                try {
                  const items = await planningDataService.getRewardTypeItems(rewardType);
                  items.forEach(item => {
                    itemsMap.set(`${rewardType}_${item.id}`, item);
                  });
                } catch (error) {
                  console.error(`Failed to load items for reward type ${rewardType}:`, error);
                }
              }
            })
          );

          setRewardItemsMap(itemsMap);
        }
      } catch (error) {
        console.error('Failed to load reward data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRewardData();
  }, [displayRewards]);

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
  const getRewardLabel = (reward: ParticipationReward): string => {
    const rewardType = parseInt(reward.rewardType);
    const typeInfo = rewardTypeMap.get(rewardType);

    if (!typeInfo) {
      return `${t('surveys.unknownReward')} (${reward.rewardType})`;
    }

    // Get localized type name
    const typeName = t(typeInfo.nameKey);

    // If has table, get item name
    if (typeInfo.hasTable) {
      const item = rewardItemsMap.get(`${rewardType}_${reward.itemId}`);
      if (item) {
        // Use + prefix for all rewards (unified format)
        return `${item.name} +${reward.quantity}`;
      } else {
        return `${typeName} #${reward.itemId} +${reward.quantity}`;
      }
    } else {
      // Value-based reward (no item table) - use + prefix for experience, fame, etc.
      return `${typeName} +${reward.quantity}`;
    }
  };

  // Get reward tooltip
  const getRewardTooltip = (reward: ParticipationReward): string => {
    const rewardType = parseInt(reward.rewardType);
    const typeInfo = rewardTypeMap.get(rewardType);

    if (!typeInfo) {
      return `${t('surveys.unknownReward')} (${reward.rewardType})`;
    }

    // Get localized type name
    const typeName = t(typeInfo.nameKey);

    // If has table, get item name
    if (typeInfo.hasTable) {
      const item = rewardItemsMap.get(`${rewardType}_${reward.itemId}`);
      if (item) {
        return `[${typeName}] ${reward.itemId}:${item.name} +${reward.quantity}`;
      } else {
        return `[${typeName}] ${reward.itemId}:Unknown +${reward.quantity}`;
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

