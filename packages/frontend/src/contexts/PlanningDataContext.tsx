import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import planningDataService, { RewardTypeInfo, RewardLookupData } from '../services/planningDataService';

interface PlanningDataContextType {
  rewardTypes: RewardTypeInfo[];
  rewardLookup: RewardLookupData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const PlanningDataContext = createContext<PlanningDataContextType | undefined>(undefined);

export const usePlanningData = () => {
  const context = useContext(PlanningDataContext);
  if (!context) {
    throw new Error('usePlanningData must be used within PlanningDataProvider');
  }
  return context;
};

interface PlanningDataProviderProps {
  children: React.ReactNode;
}

export const PlanningDataProvider: React.FC<PlanningDataProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [rewardTypes, setRewardTypes] = useState<RewardTypeInfo[]>([]);
  const [rewardLookup, setRewardLookup] = useState<RewardLookupData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load planning data on mount and when language changes
  useEffect(() => {
    // Only load if we haven't loaded yet or language changed
    if (!hasLoaded || rewardTypes.length === 0) {
      loadPlanningData();
    }
  }, [i18n.language]);

  // Listen for planning data updates via custom event (dispatched by SSE handler)
  useEffect(() => {
    const handlePlanningDataUpdate = () => {
      console.log('Planning data updated, reloading...');
      loadPlanningData();
    };

    window.addEventListener('planning-data-updated', handlePlanningDataUpdate);
    return () => window.removeEventListener('planning-data-updated', handlePlanningDataUpdate);
  }, []);

  const loadPlanningData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Map i18n language to API language
      const languageMap: Record<string, 'kr' | 'en' | 'zh'> = {
        'ko': 'kr',
        'en': 'en',
        'zh': 'zh',
      };
      const language = languageMap[i18n.language] || 'kr';

      // Load reward types
      const types = await planningDataService.getRewardTypeList();
      setRewardTypes(types);

      // Load reward lookup data
      const lookup = await planningDataService.getRewardLookup(language);
      setRewardLookup(lookup);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load planning data';
      setError(errorMessage);
      console.error('Failed to load planning data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const value: PlanningDataContextType = {
    rewardTypes,
    rewardLookup,
    isLoading,
    error,
    refresh: loadPlanningData,
  };

  return (
    <PlanningDataContext.Provider value={value}>
      {children}
    </PlanningDataContext.Provider>
  );
};

export default PlanningDataContext;

