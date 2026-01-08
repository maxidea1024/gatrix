import knex from '../config/knex';
import logger from '../config/logger';
import { RemoteConfigTemplate } from '../models/RemoteConfigTemplate';
import { RemoteConfigSegment } from '../models/RemoteConfigSegment';
import { GameWorldModel } from '../models/GameWorld';
import { PlanningDataService } from './PlanningDataService';

export interface CopyOptions {
  copyTemplates?: boolean;
  copyGameWorlds?: boolean;
  copySegments?: boolean;
  copyBanners?: boolean;
  copyClientVersions?: boolean;
  copyCoupons?: boolean;
  copyIngamePopupNotices?: boolean;
  copyMessageTemplates?: boolean;
  copyRewardTemplates?: boolean;
  copyServiceMaintenance?: boolean;
  copyServiceNotices?: boolean;
  copySurveys?: boolean;
  copyVars?: boolean;
  copyContextFields?: boolean;
  copyCampaigns?: boolean;
  copyAccountWhitelist?: boolean;
  copyIpWhitelist?: boolean;
  copyJobs?: boolean;
  copyPlanningData?: boolean;
  overwriteExisting?: boolean;
}

export interface CopyResultItem {
  copied: number;
  skipped: number;
  errors: string[];
}

export interface CopyResult {
  templates: CopyResultItem;
  gameWorlds: CopyResultItem;
  segments: CopyResultItem;
  banners: CopyResultItem;
  clientVersions: CopyResultItem;
  coupons: CopyResultItem;
  ingamePopupNotices: CopyResultItem;
  messageTemplates: CopyResultItem;
  rewardTemplates: CopyResultItem;
  serviceMaintenance: CopyResultItem;
  serviceNotices: CopyResultItem;
  surveys: CopyResultItem;
  vars: CopyResultItem;
  contextFields: CopyResultItem;
  campaigns: CopyResultItem;
  accountWhitelist: CopyResultItem;
  ipWhitelist: CopyResultItem;
  jobs: CopyResultItem;
  planningData: CopyResultItem;
}

export interface CopyPreviewSummary {
  total: number;
  conflicts: number;
}

export interface CopyPreview {
  source: { environment: string; name: string };
  target: { environment: string; name: string };
  summary: {
    templates: CopyPreviewSummary;
    gameWorlds: CopyPreviewSummary;
    segments: CopyPreviewSummary;
    banners: CopyPreviewSummary;
    clientVersions: CopyPreviewSummary;
    coupons: CopyPreviewSummary;
    ingamePopupNotices: CopyPreviewSummary;
    messageTemplates: CopyPreviewSummary;
    rewardTemplates: CopyPreviewSummary;
    serviceMaintenance: CopyPreviewSummary;
    serviceNotices: CopyPreviewSummary;
    surveys: CopyPreviewSummary;
    vars: CopyPreviewSummary;
    contextFields: CopyPreviewSummary;
    campaigns: CopyPreviewSummary;
    accountWhitelist: CopyPreviewSummary;
    ipWhitelist: CopyPreviewSummary;
    jobs: CopyPreviewSummary;
    planningData: CopyPreviewSummary;
  };
}

// Default empty result item
const emptyResult = (): CopyResultItem => ({ copied: 0, skipped: 0, errors: [] });

// Default empty summary
const emptySummary = (): CopyPreviewSummary => ({ total: 0, conflicts: 0 });

export class EnvironmentCopyService {
  /**
   * Get preview of data to be copied
   */
  static async getCopyPreview(
    sourceEnvironment: string,
    targetEnvironment: string
  ): Promise<CopyPreview> {
    // Get source counts
    const [
      templates,
      gameWorlds,
      segments,
      banners,
      clientVersions,
      coupons,
      ingamePopupNotices,
      messageTemplates,
      rewardTemplates,
      serviceMaintenance,
      serviceNotices,
      surveys,
      vars,
      contextFields,
      campaigns,
      accountWhitelist,
      ipWhitelist,
      jobs
    ] = await Promise.all([
      RemoteConfigTemplate.query().where('environment', sourceEnvironment).select('templateName'),
      knex('g_game_worlds').where('environment', sourceEnvironment).select('worldId'),
      RemoteConfigSegment.query().where('environment', sourceEnvironment).select('segmentName'),
      knex('g_banners').where('environment', sourceEnvironment).select('bannerId'),
      knex('g_client_versions').where('environment', sourceEnvironment).select('id', 'platform', 'version'),
      knex('g_coupons').where('environment', sourceEnvironment).select('id', 'code'),
      knex('g_ingame_popup_notices').where('environment', sourceEnvironment).select('id'),
      knex('g_message_templates').where('environment', sourceEnvironment).select('id', 'templateKey'),
      knex('g_reward_templates').where('environment', sourceEnvironment).select('id', 'templateKey'),
      knex('g_service_maintenance').where('environment', sourceEnvironment).select('id'),
      knex('g_service_notices').where('environment', sourceEnvironment).select('id'),
      knex('g_surveys').where('environment', sourceEnvironment).select('id'),
      knex('g_vars').where('environment', sourceEnvironment).select('id', 'varKey'),
      knex('g_remote_config_context_fields').where('environment', sourceEnvironment).select('id', 'fieldKey'),
      knex('g_remote_config_campaigns').where('environment', sourceEnvironment).select('id', 'campaignName'),
      knex('g_account_whitelist').where('environment', sourceEnvironment).select('id', 'accountId'),
      knex('g_ip_whitelist').where('environment', sourceEnvironment).select('id', 'ipAddress'),
      knex('g_jobs').where('environment', sourceEnvironment).select('id', 'name')
    ]);

    // Get target existing items
    const [
      existingTemplates,
      existingWorlds,
      existingSegments,
      existingBanners,
      existingClientVersions,
      existingCoupons,
      existingIngamePopupNotices,
      existingMessageTemplates,
      existingRewardTemplates,
      existingServiceMaintenance,
      existingServiceNotices,
      existingSurveys,
      existingVars,
      existingContextFields,
      existingCampaigns,
      existingAccountWhitelist,
      existingIpWhitelist,
      existingJobs
    ] = await Promise.all([
      RemoteConfigTemplate.query().where('environment', targetEnvironment).select('templateName'),
      knex('g_game_worlds').where('environment', targetEnvironment).select('worldId'),
      RemoteConfigSegment.query().where('environment', targetEnvironment).select('segmentName'),
      knex('g_banners').where('environment', targetEnvironment).select('bannerId'),
      knex('g_client_versions').where('environment', targetEnvironment).select('platform', 'version'),
      knex('g_coupons').where('environment', targetEnvironment).select('code'),
      knex('g_ingame_popup_notices').where('environment', targetEnvironment).select('id'),
      knex('g_message_templates').where('environment', targetEnvironment).select('templateKey'),
      knex('g_reward_templates').where('environment', targetEnvironment).select('templateKey'),
      knex('g_service_maintenance').where('environment', targetEnvironment).select('id'),
      knex('g_service_notices').where('environment', targetEnvironment).select('id'),
      knex('g_surveys').where('environment', targetEnvironment).select('id'),
      knex('g_vars').where('environment', targetEnvironment).select('varKey'),
      knex('g_remote_config_context_fields').where('environment', targetEnvironment).select('fieldKey'),
      knex('g_remote_config_campaigns').where('environment', targetEnvironment).select('campaignName'),
      knex('g_account_whitelist').where('environment', targetEnvironment).select('accountId'),
      knex('g_ip_whitelist').where('environment', targetEnvironment).select('ipAddress'),
      knex('g_jobs').where('environment', targetEnvironment).select('name')
    ]);

    // Create sets for conflict detection
    const existingTemplateName = new Set(existingTemplates.map(t => t.templateName));
    const existingWorldId = new Set(existingWorlds.map(w => w.worldId));
    const existingSegmentName = new Set(existingSegments.map(s => s.segmentName));
    const existingClientVersionKey = new Set(existingClientVersions.map(c => `${c.platform}:${c.version}`));
    const existingCouponCode = new Set(existingCoupons.map(c => c.code));
    const existingMessageTemplateKey = new Set(existingMessageTemplates.map(m => m.templateKey));
    const existingRewardTemplateKey = new Set(existingRewardTemplates.map(r => r.templateKey));
    const existingVarKey = new Set(existingVars.map(v => v.varKey));
    const existingContextFieldKey = new Set(existingContextFields.map(c => c.fieldKey));
    const existingCampaignName = new Set(existingCampaigns.map(c => c.campaignName));
    const existingAccountId = new Set(existingAccountWhitelist.map(a => a.accountId));
    const existingIpAddress = new Set(existingIpWhitelist.map(i => i.ipAddress));
    const existingJobName = new Set(existingJobs.map(j => j.name));

    return {
      source: { environment: '', name: '' }, // Will be filled by controller
      target: { environment: '', name: '' },
      summary: {
        templates: {
          total: templates.length,
          conflicts: templates.filter(t => existingTemplateName.has(t.templateName)).length
        },
        gameWorlds: {
          total: gameWorlds.length,
          conflicts: gameWorlds.filter(w => existingWorldId.has(w.worldId)).length
        },
        segments: {
          total: segments.length,
          conflicts: segments.filter(s => existingSegmentName.has(s.segmentName)).length
        },
        banners: {
          total: banners.length,
          conflicts: existingBanners.length // Banners don't have unique key, so any existing is conflict
        },
        clientVersions: {
          total: clientVersions.length,
          conflicts: clientVersions.filter(c => existingClientVersionKey.has(`${c.platform}:${c.version}`)).length
        },
        coupons: {
          total: coupons.length,
          conflicts: coupons.filter(c => existingCouponCode.has(c.code)).length
        },
        ingamePopupNotices: {
          total: ingamePopupNotices.length,
          conflicts: existingIngamePopupNotices.length
        },
        messageTemplates: {
          total: messageTemplates.length,
          conflicts: messageTemplates.filter(m => existingMessageTemplateKey.has(m.templateKey)).length
        },
        rewardTemplates: {
          total: rewardTemplates.length,
          conflicts: rewardTemplates.filter(r => existingRewardTemplateKey.has(r.templateKey)).length
        },
        serviceMaintenance: {
          total: serviceMaintenance.length,
          conflicts: existingServiceMaintenance.length
        },
        serviceNotices: {
          total: serviceNotices.length,
          conflicts: existingServiceNotices.length
        },
        surveys: {
          total: surveys.length,
          conflicts: existingSurveys.length
        },
        vars: {
          total: vars.length,
          conflicts: vars.filter(v => existingVarKey.has(v.varKey)).length
        },
        contextFields: {
          total: contextFields.length,
          conflicts: contextFields.filter(c => existingContextFieldKey.has(c.fieldKey)).length
        },
        campaigns: {
          total: campaigns.length,
          conflicts: campaigns.filter(c => existingCampaignName.has(c.campaignName)).length
        },
        accountWhitelist: {
          total: accountWhitelist.length,
          conflicts: accountWhitelist.filter(a => existingAccountId.has(a.accountId)).length
        },
        ipWhitelist: {
          total: ipWhitelist.length,
          conflicts: ipWhitelist.filter(i => existingIpAddress.has(i.ipAddress)).length
        },
        jobs: {
          total: jobs.length,
          conflicts: jobs.filter(j => existingJobName.has(j.name)).length
        },
        planningData: {
          total: 1, // Planning data is treated as a single unit
          conflicts: 0 // Always overwrite planning data
        }
      }
    };
  }

  /**
   * Copy all environment data
   */
  static async copyEnvironmentData(
    sourceEnvironment: string,
    targetEnvironment: string,
    options: CopyOptions,
    userId: number
  ): Promise<CopyResult> {
    const result: CopyResult = {
      templates: emptyResult(),
      gameWorlds: emptyResult(),
      segments: emptyResult(),
      banners: emptyResult(),
      clientVersions: emptyResult(),
      coupons: emptyResult(),
      ingamePopupNotices: emptyResult(),
      messageTemplates: emptyResult(),
      rewardTemplates: emptyResult(),
      serviceMaintenance: emptyResult(),
      serviceNotices: emptyResult(),
      surveys: emptyResult(),
      vars: emptyResult(),
      contextFields: emptyResult(),
      campaigns: emptyResult(),
      accountWhitelist: emptyResult(),
      ipWhitelist: emptyResult(),
      jobs: emptyResult(),
      planningData: emptyResult()
    };

    const { overwriteExisting = false } = options;

    // Copy Templates
    if (options.copyTemplates !== false) {
      await this.copyTemplates(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.templates);
    }

    // Copy Game Worlds
    if (options.copyGameWorlds !== false) {
      await this.copyGameWorlds(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.gameWorlds);
    }

    // Copy Segments
    if (options.copySegments !== false) {
      await this.copySegments(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.segments);
    }

    // Copy Banners
    if (options.copyBanners !== false) {
      await this.copySimpleTable('g_banners', sourceEnvironment, targetEnvironment, userId, result.banners);
    }

    // Copy Client Versions
    if (options.copyClientVersions !== false) {
      await this.copyClientVersions(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.clientVersions);
    }

    // Copy Coupons (complex with related tables)
    if (options.copyCoupons !== false) {
      await this.copyCoupons(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.coupons);
    }

    // Copy Ingame Popup Notices
    if (options.copyIngamePopupNotices !== false) {
      await this.copySimpleTable('g_ingame_popup_notices', sourceEnvironment, targetEnvironment, userId, result.ingamePopupNotices);
    }

    // Copy Message Templates
    if (options.copyMessageTemplates !== false) {
      await this.copyMessageTemplates(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.messageTemplates);
    }

    // Copy Reward Templates
    if (options.copyRewardTemplates !== false) {
      await this.copyRewardTemplates(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.rewardTemplates);
    }

    // Copy Service Maintenance
    if (options.copyServiceMaintenance !== false) {
      await this.copyServiceMaintenance(sourceEnvironment, targetEnvironment, userId, result.serviceMaintenance);
    }

    // Copy Service Notices
    if (options.copyServiceNotices !== false) {
      await this.copySimpleTable('g_service_notices', sourceEnvironment, targetEnvironment, userId, result.serviceNotices);
    }

    // Copy Surveys
    if (options.copySurveys !== false) {
      await this.copySimpleTable('g_surveys', sourceEnvironment, targetEnvironment, userId, result.surveys);
    }

    // Copy Vars
    if (options.copyVars !== false) {
      await this.copyVars(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.vars);
    }

    // Copy Context Fields
    if (options.copyContextFields !== false) {
      await this.copyContextFields(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.contextFields);
    }

    // Copy Campaigns
    if (options.copyCampaigns !== false) {
      await this.copyCampaigns(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.campaigns);
    }

    // Copy Account Whitelist
    if (options.copyAccountWhitelist !== false) {
      await this.copyAccountWhitelist(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.accountWhitelist);
    }

    // Copy IP Whitelist
    if (options.copyIpWhitelist !== false) {
      await this.copyIpWhitelist(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.ipWhitelist);
    }

    // Copy Jobs
    if (options.copyJobs !== false) {
      await this.copyJobs(sourceEnvironment, targetEnvironment, userId, overwriteExisting, result.jobs);
    }

    // Copy Planning Data (Redis cache + files)
    if (options.copyPlanningData !== false) {
      await this.copyPlanningData(sourceEnvironment, targetEnvironment, result.planningData);
    }

    return result;
  }

  /**
   * Copy planning data from source to target environment
   */
  private static async copyPlanningData(
    sourceEnv: string, targetEnv: string, result: CopyResultItem
  ): Promise<void> {
    try {
      logger.info('Copying planning data...', { sourceEnv, targetEnv });
      const copyResult = await PlanningDataService.copyPlanningData(sourceEnv, targetEnv);
      result.copied = copyResult.filesCopied;
      logger.info('Planning data copied successfully', { sourceEnv, targetEnv, filesCopied: copyResult.filesCopied });
    } catch (e) {
      result.errors.push(`Planning data: ${e instanceof Error ? e.message : 'Error'}`);
      logger.error('Failed to copy planning data', { error: e, sourceEnv, targetEnv });
    }
  }

  // Individual copy methods
  private static async copyTemplates(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await RemoteConfigTemplate.query().where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await RemoteConfigTemplate.query()
          .where('environment', targetEnv)
          .where('templateName', item.templateName)
          .first();
        if (existing && !overwrite) { result.skipped++; continue; }
        if (existing) {
          await RemoteConfigTemplate.query().findById(existing.id).patch({
            displayName: item.displayName, description: item.description,
            templateType: item.templateType, templateData: item.templateData,
            metadata: item.metadata, status: 'draft', updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await RemoteConfigTemplate.query().insert({
            environment: targetEnv, templateName: item.templateName,
            displayName: item.displayName, description: item.description,
            templateType: item.templateType, status: 'draft', version: 1,
            templateData: item.templateData, metadata: item.metadata, createdBy: userId
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`Template ${item.templateName}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyGameWorlds(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await GameWorldModel.list({ environment: sourceEnv });
    for (const item of sources) {
      try {
        const existing = await knex('g_game_worlds')
          .where('environment', targetEnv).where('worldId', item.worldId).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const data = {
          name: item.name, description: item.description, isVisible: item.isVisible,
          isMaintenance: false, displayOrder: item.displayOrder, tags: item.tags,
          worldServerAddress: item.worldServerAddress,
          customPayload: item.customPayload ? JSON.stringify(item.customPayload) : null,
          infraSettings: item.infraSettings ? JSON.stringify(item.infraSettings) : null,
          infraSettingsRaw: item.infraSettingsRaw, updatedAt: new Date()
        };
        if (existing) {
          await knex('g_game_worlds').where('id', existing.id).update({ ...data, updatedBy: userId });
        } else {
          await knex('g_game_worlds').insert({
            ...data, environment: targetEnv, worldId: item.worldId, createdBy: userId, createdAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`GameWorld ${item.worldId}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copySegments(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await RemoteConfigSegment.query().where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await RemoteConfigSegment.query()
          .where('environment', targetEnv).where('segmentName', item.segmentName).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        if (existing) {
          await RemoteConfigSegment.query().findById(existing.id).patch({
            displayName: item.displayName, description: item.description,
            segmentConditions: item.segmentConditions, updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await RemoteConfigSegment.query().insert({
            environment: targetEnv, segmentName: item.segmentName,
            displayName: item.displayName, description: item.description,
            segmentConditions: item.segmentConditions, isActive: item.isActive, createdBy: userId
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`Segment ${item.segmentName}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copySimpleTable(
    tableName: string, sourceEnv: string, targetEnv: string, userId: number, result: CopyResultItem
  ): Promise<void> {
    try {
      const sources = await knex(tableName).where('environment', sourceEnv);
      for (const item of sources) {
        try {
          const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
          await knex(tableName).insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
          result.copied++;
        } catch (e) { result.errors.push(`${tableName} id=${item.id}: ${e instanceof Error ? e.message : 'Error'}`); }
      }
    } catch (e) { result.errors.push(`${tableName}: ${e instanceof Error ? e.message : 'Error'}`); }
  }

  private static async copyClientVersions(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_client_versions').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_client_versions')
          .where('environment', targetEnv)
          .where('platform', item.platform)
          .where('version', item.version)
          .first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        if (existing) {
          await knex('g_client_versions').where('id', existing.id).update({
            ...data, environment: targetEnv, updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await knex('g_client_versions').insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`ClientVersion ${item.platform}/${item.version}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyCoupons(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    // Note: Coupons have complex relationships, only copying coupon definitions (not uses/logs)
    const sources = await knex('g_coupons').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_coupons')
          .where('environment', targetEnv).where('code', item.code).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, usedCount: _usedCount, ...data } = item;
        if (existing) {
          await knex('g_coupons').where('id', existing.id).update({
            ...data, environment: targetEnv, usedCount: 0, updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await knex('g_coupons').insert({
            ...data, environment: targetEnv, usedCount: 0, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`Coupon ${item.code}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyMessageTemplates(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_message_templates').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_message_templates')
          .where('environment', targetEnv).where('templateKey', item.templateKey).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        let newId: number;
        if (existing) {
          await knex('g_message_templates').where('id', existing.id).update({
            ...data, environment: targetEnv, updatedBy: userId, updatedAt: new Date()
          });
          newId = existing.id;
          // Delete old locales
          await knex('g_message_template_locales').where('templateId', existing.id).del();
        } else {
          const [insertId] = await knex('g_message_templates').insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
          newId = insertId;
        }
        // Copy locales
        const locales = await knex('g_message_template_locales').where('templateId', item.id);
        for (const locale of locales) {
          const { id: _localeId, templateId: _templateId, ...localeData } = locale;
          await knex('g_message_template_locales').insert({ ...localeData, templateId: newId });
        }
        result.copied++;
      } catch (e) { result.errors.push(`MessageTemplate ${item.templateKey}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyRewardTemplates(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_reward_templates').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_reward_templates')
          .where('environment', targetEnv).where('templateKey', item.templateKey).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        let newId: number;
        if (existing) {
          await knex('g_reward_templates').where('id', existing.id).update({
            ...data, environment: targetEnv, updatedBy: userId, updatedAt: new Date()
          });
          newId = existing.id;
          // Delete old items
          await knex('g_reward_items').where('templateId', existing.id).del();
        } else {
          const [insertId] = await knex('g_reward_templates').insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
          newId = insertId;
        }
        // Copy reward items
        const items = await knex('g_reward_items').where('templateId', item.id);
        for (const rewardItem of items) {
          const { id: _itemId, templateId: _templateId, ...itemData } = rewardItem;
          await knex('g_reward_items').insert({ ...itemData, templateId: newId });
        }
        result.copied++;
      } catch (e) { result.errors.push(`RewardTemplate ${item.templateKey}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyServiceMaintenance(
    sourceEnv: string, targetEnv: string, userId: number, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_service_maintenance').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        const [newId] = await knex('g_service_maintenance').insert({
          ...data, environment: targetEnv, isActive: false, // Start inactive in new env
          createdBy: userId, createdAt: new Date(), updatedAt: new Date()
        });
        // Copy locales
        const locales = await knex('g_service_maintenance_locales').where('maintenanceId', item.id);
        for (const locale of locales) {
          const { id: _localeId, maintenanceId: _maintenanceId, ...localeData } = locale;
          await knex('g_service_maintenance_locales').insert({ ...localeData, maintenanceId: newId });
        }
        result.copied++;
      } catch (e) { result.errors.push(`ServiceMaintenance id=${item.id}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyVars(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_vars').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_vars')
          .where('environment', targetEnv).where('varKey', item.varKey).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        if (existing) {
          await knex('g_vars').where('id', existing.id).update({
            ...data, environment: targetEnv, updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await knex('g_vars').insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`Var ${item.varKey}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyContextFields(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_remote_config_context_fields').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_remote_config_context_fields')
          .where('environment', targetEnv).where('fieldKey', item.fieldKey).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        if (existing) {
          await knex('g_remote_config_context_fields').where('id', existing.id).update({
            ...data, environment: targetEnv, updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await knex('g_remote_config_context_fields').insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`ContextField ${item.fieldKey}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyCampaigns(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_remote_config_campaigns').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_remote_config_campaigns')
          .where('environment', targetEnv).where('campaignName', item.campaignName).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        if (existing) {
          await knex('g_remote_config_campaigns').where('id', existing.id).update({
            ...data, environment: targetEnv, status: 'draft', updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await knex('g_remote_config_campaigns').insert({
            ...data, environment: targetEnv, status: 'draft', createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`Campaign ${item.campaignName}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyAccountWhitelist(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_account_whitelist').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_account_whitelist')
          .where('environment', targetEnv).where('accountId', item.accountId).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        if (existing) {
          await knex('g_account_whitelist').where('id', existing.id).update({
            ...data, environment: targetEnv, updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await knex('g_account_whitelist').insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`Account Whitelist ${item.accountId}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyIpWhitelist(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_ip_whitelist').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_ip_whitelist')
          .where('environment', targetEnv).where('ipAddress', item.ipAddress).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        if (existing) {
          await knex('g_ip_whitelist').where('id', existing.id).update({
            ...data, environment: targetEnv, updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await knex('g_ip_whitelist').insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`IP Whitelist ${item.ipAddress}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }

  private static async copyJobs(
    sourceEnv: string, targetEnv: string, userId: number, overwrite: boolean, result: CopyResultItem
  ): Promise<void> {
    const sources = await knex('g_jobs').where('environment', sourceEnv);
    for (const item of sources) {
      try {
        const existing = await knex('g_jobs')
          .where('environment', targetEnv).where('name', item.name).first();
        if (existing && !overwrite) { result.skipped++; continue; }
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item;
        if (existing) {
          await knex('g_jobs').where('id', existing.id).update({
            ...data, environment: targetEnv, updatedBy: userId, updatedAt: new Date()
          });
        } else {
          await knex('g_jobs').insert({
            ...data, environment: targetEnv, createdBy: userId, createdAt: new Date(), updatedAt: new Date()
          });
        }
        result.copied++;
      } catch (e) { result.errors.push(`Job ${item.name}: ${e instanceof Error ? e.message : 'Error'}`); }
    }
  }
}

