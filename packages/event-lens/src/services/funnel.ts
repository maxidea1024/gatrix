import { clickhouse } from '../config/clickhouse';
import logger from '../utils/logger';
import { FunnelStep } from '../types';

export class FunnelService {
  async analyzeFunnel(params: {
    projectId: string;
    steps: string[];
    startDate: string;
    endDate: string;
  }): Promise<FunnelStep[]> {
    const { projectId, steps, startDate, endDate } = params;

    try {
      if (steps.length < 2) {
        throw new Error('Funnel must have at least 2 steps');
      }

      // 각 단계별 CTE 생성
      const stepCTEs = steps.map((_step, index) => `
        step${index} AS (
          SELECT deviceId, min(createdAt) as timestamp
          FROM events
          WHERE projectId = {projectId:String}
            AND name = {step${index}:String}
            AND createdAt >= {startDate:DateTime}
            AND createdAt <= {endDate:DateTime}
          GROUP BY deviceId
        )
      `).join(',\n');

      // 각 단계별 카운트 및 전환율 계산
      const stepSelects = steps.map((_, index) => {
        if (index === 0) {
          return `count(DISTINCT step${index}.deviceId) as step${index}_count, 100 as step${index}_conversion`;
        } else {
          return `count(DISTINCT step${index}.deviceId) as step${index}_count, 
                  (step${index}_count / step0_count * 100) as step${index}_conversion`;
        }
      }).join(',\n');

      // JOIN 조건 생성
      const stepJoins = steps.slice(1).map((_, index) => {
        const currentStep = index + 1;
        const prevStep = index;
        return `LEFT JOIN step${currentStep} ON step${currentStep}.deviceId = step${prevStep}.deviceId
          AND step${currentStep}.timestamp > step${prevStep}.timestamp`;
      }).join('\n');

      const query = `
        WITH ${stepCTEs}
        SELECT ${stepSelects}
        FROM step0
        ${stepJoins}
      `;

      const queryParams: any = { projectId, startDate, endDate };
      steps.forEach((step, index) => {
        queryParams[`step${index}`] = step;
      });

      const result = await clickhouse.query({
        query,
        query_params: queryParams,
      });

      const data: any = await result.json();
      const row = data.data?.[0] || {};

      // 결과 변환
      const funnelSteps: FunnelStep[] = steps.map((step, index) => ({
        name: step,
        count: row[`step${index}_count`] || 0,
        conversion: row[`step${index}_conversion`] || 0,
      }));

      return funnelSteps;
    } catch (error) {
      logger.error('Failed to analyze funnel', { error, params });
      throw error;
    }
  }
}

export default FunnelService;

