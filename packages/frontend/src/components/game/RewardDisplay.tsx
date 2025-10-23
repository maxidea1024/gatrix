import React, { useEffect, useState } from 'react';
import { Box, Chip, Typography, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ParticipationReward } from '../../services/surveyService';
import planningDataService, { RewardTypeInfo, RewardItem } from '../../services/planningDataService';

interface RewardDisplayProps {
  rewards?: ParticipationReward[];
  maxDisplay?: number;
}

/**
 * Display component for participation rewards
 * Shows reward type and item name with quantity
 */
const RewardDisplay: React.FC<RewardDisplayProps> = ({ rewards, maxDisplay = 3 }) => {
  const { t } = useTranslation();
  const [rewardTypeMap, setRewardTypeMap] = useState<Map<number, RewardTypeInfo>>(new Map());
  const [rewardItemsMap, setRewardItemsMap] = useState<Map<string, RewardItem>>(new Map());
  const [loading, setLoading] = useState(true);

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
        if (rewards && rewards.length > 0) {
          const itemsMap = new Map<string, RewardItem>();
          
          // Get unique reward types
          const uniqueTypes = [...new Set(rewards.map(r => parseInt(r.rewardType)))];
          
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
  }, [rewards]);

  // No rewards
  if (!rewards || rewards.length === 0) {
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
        {[...Array(Math.min(rewards.length, maxDisplay))].map((_, idx) => (
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

  // Display rewards
  const displayRewards = rewards.slice(0, maxDisplay);
  const hasMore = rewards.length > maxDisplay;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
      {displayRewards.map((reward, idx) => (
        <Chip
          key={idx}
          label={getRewardLabel(reward)}
          size="small"
          color="primary"
          variant="outlined"
        />
      ))}
      {hasMore && (
        <Typography variant="caption" color="text.secondary">
          +{rewards.length - maxDisplay} {t('surveys.moreRewards')}
        </Typography>
      )}
    </Box>
  );
};

export default RewardDisplay;

