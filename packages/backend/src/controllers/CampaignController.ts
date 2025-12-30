import { Response } from 'express';
import { CampaignModel } from '../models/Campaign';
import { VariantModel } from '../models/Variant';
import logger from '../config/logger';
import { GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types/auth';
import {
  CreateCampaignData,
  CreateCampaignConfigData,
  CreateConfigVariantData
} from '../types/remoteConfig';

export class CampaignController {
  /**
   * Get all campaigns with pagination and filters
   */
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const environment = req.environment;
      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const isActive = req.query.isActive === 'true' ? true :
        req.query.isActive === 'false' ? false : undefined;

      const result = await CampaignModel.list(page, limit, { environment, search, isActive });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in CampaignController.list:', error);
      if (error instanceof GatrixError) throw error;
      throw new GatrixError('Failed to fetch campaigns', 500);
    }
  }

  /**
   * Get campaign by ID
   */
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;
      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const campaign = await CampaignModel.findById(id, environment, true);

      if (!campaign) {
        throw new GatrixError('Campaign not found', 404);
      }

      res.json({
        success: true,
        data: campaign
      });
    } catch (error) {
      logger.error('Error in CampaignController.getById:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to fetch campaign', 500);
    }
  }

  /**
   * Create new campaign
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const environment = req.environment;
      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const userId = req.user?.userId;
      const data: CreateCampaignData = {
        ...req.body,
        createdBy: userId
      };

      // Validate required fields
      if (!data.campaignName) {
        throw new GatrixError('Campaign name is required', 400);
      }

      // Validate dates
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        if (start >= end) {
          throw new GatrixError('End date must be after start date', 400);
        }
      }

      const campaign = await CampaignModel.create(data, environment);

      res.status(201).json({
        success: true,
        message: 'Campaign created successfully',
        data: campaign
      });
    } catch (error) {
      logger.error('Error in CampaignController.create:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to create campaign', 500);
    }
  }

  /**
   * Update campaign
   */
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;
      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const data = req.body;

      // Validate dates if provided
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        if (start >= end) {
          throw new GatrixError('End date must be after start date', 400);
        }
      }

      const campaign = await CampaignModel.update(id, environment, data);

      res.json({
        success: true,
        message: 'Campaign updated successfully',
        data: campaign
      });
    } catch (error) {
      logger.error('Error in CampaignController.update:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to update campaign', 500);
    }
  }

  /**
   * Delete campaign
   */
  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;
      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      // Check if campaign exists
      const campaign = await CampaignModel.findById(id, environment, false);
      if (!campaign) {
        throw new GatrixError('Campaign not found', 404);
      }

      await CampaignModel.delete(id, environment);

      res.json({
        success: true,
        message: 'Campaign deleted successfully'
      });
    } catch (error) {
      logger.error('Error in CampaignController.delete:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to delete campaign', 500);
    }
  }

  /**
   * Add config to campaign
   */
  static async addConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const campaignId = parseInt(req.params.id);
      const environment = req.environment;
      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      const data: CreateCampaignConfigData = {
        campaignId,
        ...req.body
      };

      // Validate required fields
      if (!data.configId) {
        throw new GatrixError('Config ID is required', 400);
      }

      // Check if campaign exists
      const campaign = await CampaignModel.findById(campaignId, environment, false);
      if (!campaign) {
        throw new GatrixError('Campaign not found', 404);
      }

      const campaignConfig = await CampaignModel.addConfig(data, environment);

      res.status(201).json({
        success: true,
        message: 'Config added to campaign successfully',
        data: campaignConfig
      });
    } catch (error) {
      logger.error('Error in CampaignController.addConfig:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to add config to campaign', 500);
    }
  }

  /**
   * Remove config from campaign
   */
  static async removeConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const campaignId = parseInt(req.params.id);
      const configId = parseInt(req.params.configId);
      const environment = req.environment;
      if (!environment) {
        throw new GatrixError('Environment is required', 400);
      }

      // Check if campaign exists
      const campaign = await CampaignModel.findById(campaignId, environment, false);
      if (!campaign) {
        throw new GatrixError('Campaign not found', 404);
      }

      await CampaignModel.removeConfig(campaignId, configId, environment);

      res.json({
        success: true,
        message: 'Config removed from campaign successfully'
      });
    } catch (error) {
      logger.error('Error in CampaignController.removeConfig:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to remove config from campaign', 500);
    }
  }

  /**
   * Get variants for a config
   */
  static async getVariants(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const configId = parseInt(req.params.configId);
      const variants = await VariantModel.getVariantsByConfigId(configId);
      const trafficSummary = await VariantModel.getTrafficSummary(configId);

      res.json({
        success: true,
        data: {
          variants,
          trafficSummary
        }
      });
    } catch (error) {
      logger.error('Error in CampaignController.getVariants:', error);
      throw new GatrixError('Failed to fetch variants', 500);
    }
  }

  /**
   * Create variant for a config
   */
  static async createVariant(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const configId = parseInt(req.params.configId);
      const data: CreateConfigVariantData = {
        configId,
        ...req.body,
        createdBy: userId
      };

      // Validate required fields
      if (!data.variantName) {
        throw new GatrixError('Variant name is required', 400);
      }

      const variant = await VariantModel.create(data);

      res.status(201).json({
        success: true,
        message: 'Variant created successfully',
        data: variant
      });
    } catch (error) {
      logger.error('Error in CampaignController.createVariant:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to create variant', 500);
    }
  }

  /**
   * Update variant
   */
  static async updateVariant(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const variantId = parseInt(req.params.variantId);
      const data = req.body;

      const variant = await VariantModel.update(variantId, data);

      res.json({
        success: true,
        message: 'Variant updated successfully',
        data: variant
      });
    } catch (error) {
      logger.error('Error in CampaignController.updateVariant:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to update variant', 500);
    }
  }

  /**
   * Delete variant
   */
  static async deleteVariant(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const variantId = parseInt(req.params.variantId);

      // Check if variant exists
      const variant = await VariantModel.findById(variantId);
      if (!variant) {
        throw new GatrixError('Variant not found', 404);
      }

      await VariantModel.delete(variantId);

      res.json({
        success: true,
        message: 'Variant deleted successfully'
      });
    } catch (error) {
      logger.error('Error in CampaignController.deleteVariant:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to delete variant', 500);
    }
  }
}

export default CampaignController;
