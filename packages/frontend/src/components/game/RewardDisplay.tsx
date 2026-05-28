import React, { useEffect, useState, useMemo } from 'react';
import { Box, Chip, Typography, Skeleton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Reward } from '../../services/surveyService';
import { RewardTypeInfo, RewardItem } from '../../services/planningDataService';
import rewardTemplateService from '../../services/rewardTemplateService';
import { usePlanningData } from '../../contexts/PlanningDataContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';

interface RewardDisplayProps {
  rewards?: any[];
  rewardTemplateId?: string | null;
  maxDisplay?: number;
}

/**
 * Display component for participation rewards
 * Shows reward type and item name with quantity
 */
const RewardDisplay: React.FC<RewardDisplayProps> = ({
  rewards,
  rewardTemplateId,
  maxDisplay = 3,
}) => {
  const { t } = useTranslation();
  const {
    rewardTypes,
    rewardLookup,
    isLoading: contextLoading,
  } = usePlanningData();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const [loadedTemplateRewards, setLoadedTemplateRewards] = useState<
    Reward[] | null
  >(null);
  const [showAll, setShowAll] = useState(false);

  // Synchronously parse rewards if provided as a prop
  const displayRewards = useMemo<Reward[] | null>(() => {
    if (!rewards || rewards.length === 0) return null;
    return rewards.map((reward: any) => ({
      rewardType: String(
        reward.type !== undefined ? reward.type : reward.rewardType
      ),
      itemId: String(
        reward.id !== undefined
          ? reward.id
          : reward.itemId
            ? parseInt(reward.itemId.split('_')[1] || reward.itemId)
            : 0
      ),
      quantity: reward.quantity,
      type: reward.type !== undefined ? reward.type : reward.rewardType,
      id:
        reward.id !== undefined
          ? reward.id
          : reward.itemId
            ? parseInt(reward.itemId.split('_')[1] || reward.itemId)
            : 0,
    }));
  }, [rewards]);

  // Load rewards from template asynchronously only if rewards prop is not provided
  useEffect(() => {
    if (rewards && rewards.length > 0) {
      setLoadedTemplateRewards(null);
      return;
    }

    if (!rewardTemplateId) {
      setLoadedTemplateRewards([]);
      return;
    }

    let isMounted = true;
    const fetchTemplate = async () => {
      try {
        const template = await rewardTemplateService.getRewardTemplateById(
          projectApiPath,
          rewardTemplateId
        );
        if (!isMounted) return;
        if (
          template &&
          template.rewardItems &&
          Array.isArray(template.rewardItems)
        ) {
          const convertedRewards: Reward[] = template.rewardItems.map(
            (item: any) => ({
              rewardType: String(item.rewardType || item.type || 0),
              itemId: String(item.itemId || item.id || 0),
              quantity: item.quantity || 0,
              type: item.rewardType || item.type || 0,
              id: item.itemId || item.id || 0,
            })
          );
          setLoadedTemplateRewards(convertedRewards);
        } else {
          setLoadedTemplateRewards([]);
        }
      } catch (error) {
        console.error('Failed to load rewards from template:', error);
        if (isMounted) {
          setLoadedTemplateRewards([]);
        }
      }
    };

    fetchTemplate();
    return () => {
      isMounted = false;
    };
  }, [rewards, rewardTemplateId, projectApiPath]);

  // Resolve active rewards list
  const resolvedRewards = useMemo<Reward[]>(() => {
    if (displayRewards !== null) {
      return displayRewards;
    }
    return loadedTemplateRewards || [];
  }, [displayRewards, loadedTemplateRewards]);

  // Build reward type map synchronously from context
  const rewardTypeMap = useMemo(() => {
    const typeMap = new Map<number, RewardTypeInfo>();
    if (rewardTypes && rewardTypes.length > 0) {
      rewardTypes.forEach((type) => {
        typeMap.set(type.value, type);
      });
    }
    return typeMap;
  }, [rewardTypes]);

  // Build reward items map synchronously from context lookup data
  const rewardItemsMap = useMemo(() => {
    const itemsMap = new Map<string, RewardItem>();
    if (resolvedRewards && resolvedRewards.length > 0 && rewardLookup) {
      // Get unique reward types with explicit typing
      const uniqueTypes: number[] = [
        ...new Set(
          resolvedRewards.map((r) => parseInt(r.type || r.rewardType || '0'))
        ),
      ];

      // Extract items from reward lookup data if available
      uniqueTypes.forEach((rewardType) => {
        const rewardTypeData = rewardLookup[rewardType];
        if (rewardTypeData?.items && Array.isArray(rewardTypeData.items)) {
          rewardTypeData.items.forEach((item) => {
            itemsMap.set(`${rewardType}_${item.id}`, item);
          });
        }
      });
    }
    return itemsMap;
  }, [rewardLookup, resolvedRewards]);

  // Determine if context lookup or template fetch is loading
  const isLookupLoading = contextLoading && !rewardLookup;
  const isTemplateLoading =
    rewardTemplateId && !rewards && loadedTemplateRewards === null;
  const isComponentLoading = isLookupLoading || isTemplateLoading;

  // No rewards
  if (!isComponentLoading && resolvedRewards.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('surveys.noRewards')}
      </Typography>
    );
  }

  // Loading state
  if (isComponentLoading) {
    const skeletonCount =
      resolvedRewards.length > 0
        ? Math.min(resolvedRewards.length, maxDisplay)
        : maxDisplay;
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {[...Array(skeletonCount)].map((_, idx) => (
          <Skeleton
            key={idx}
            variant="rectangular"
            width={120}
            height={24}
            sx={{ borderRadius: 1 }}
          />
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
  const rewardsToDisplay = showAll
    ? resolvedRewards
    : resolvedRewards.slice(0, maxDisplay);
  const hasMore = resolvedRewards.length > maxDisplay;

  // Darker orange color (15% darker than #ff9800)
  const orangeColor = '#d98200';

  return (
    <Box
      sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}
    >
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
              },
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
            },
          }}
          onClick={() => setShowAll(true)}
        >
          +{resolvedRewards.length - maxDisplay} {t('surveys.moreRewards')}
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
            },
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
