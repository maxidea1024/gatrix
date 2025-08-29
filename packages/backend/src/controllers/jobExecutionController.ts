import { Request, Response } from 'express';
import { JobExecutionModel } from '../models/JobExecution';
import logger from '../config/logger';

// Job 실행 이력 목록 조회
export const getJobExecutions = async (req: Request, res: Response) => {
  try {
    const { 
      job_id, 
      schedule_id, 
      status, 
      date_from, 
      date_to, 
      limit = 50, 
      offset = 0 
    } = req.query;
    
    const filters: any = {};
    if (job_id) filters.job_id = parseInt(job_id as string);
    if (schedule_id) filters.schedule_id = parseInt(schedule_id as string);
    if (status) filters.status = status as string;
    if (date_from) filters.date_from = date_from as string;
    if (date_to) filters.date_to = date_to as string;
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const executions = await JobExecutionModel.findAll(filters);
    
    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    logger.error('Error getting job executions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job executions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Job 실행 이력 상세 조회
export const getJobExecution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const execution = await JobExecutionModel.findById(parseInt(id));
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Job execution not found'
      });
    }
    
    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    logger.error('Error getting job execution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job execution',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Job 실행 통계 조회
export const getJobExecutionStatistics = async (req: Request, res: Response) => {
  try {
    const { date_from, date_to } = req.query;
    
    const statistics = await JobExecutionModel.getStatistics(
      date_from as string,
      date_to as string
    );
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Error getting job execution statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job execution statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
