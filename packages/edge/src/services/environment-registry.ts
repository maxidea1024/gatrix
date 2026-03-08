/**
 * EnvironmentRegistry - Manages organization/project/environment tree for Edge
 *
 * Responsibilities:
 * - Fetch complete org/project/env tree on startup via internal API
 * - Maintain in-memory tree for fast lookups
 * - Listen to Redis PubSub events for real-time tree synchronization
 *   (environment.created, environment.deleted, project.created, project.deleted, etc.)
 */

import axios from 'axios';
import Redis from 'ioredis';
import { config } from '../config/env';
import { createLogger } from '../config/logger';

const logger = createLogger('EnvironmentRegistry');

export interface EnvironmentNode {
  id: string;
  name: string;
  displayName?: string;
  environmentType?: string;
}

export interface ProjectNode {
  id: string;
  projectName: string;
  displayName?: string;
  environments: EnvironmentNode[];
}

export interface OrgNode {
  id: string;
  orgName: string;
  displayName?: string;
  projects: ProjectNode[];
}

/**
 * EnvironmentRegistry - Singleton service
 */
class EnvironmentRegistry {
  private tree: OrgNode[] = [];
  private subscriber: Redis | null = null;
  private initialized = false;
  private readonly CHANNEL_PREFIX = 'gatrix-sdk-events';
  private treeChangeCallbacks: Array<() => void> = [];

  // Lookup maps for fast access
  private envMap: Map<string, { orgId: string; projectId: string }> = new Map();
  private projectMap: Map<string, { orgId: string }> = new Map();

  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Already initialized');
      return;
    }

    logger.info('Initializing environment registry...');

    // Fetch initial tree
    await this.fetchTree();

    // Subscribe to environment lifecycle events
    await this.subscribeToEvents();

    this.initialized = true;
    logger.info('Initialized', {
      orgs: this.tree.length,
      projects: this.getAllProjects().length,
      environments: this.getAllEnvironmentIds().length,
    });
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.subscriber) {
      try {
        await this.subscriber.punsubscribe(`${this.CHANNEL_PREFIX}:*`);
        await this.subscriber.quit();
        this.subscriber = null;
      } catch (error) {
        logger.error('Error during shutdown:', error);
      }
    }
    this.tree = [];
    this.envMap.clear();
    this.projectMap.clear();
    this.initialized = false;
    logger.info('Shutdown complete');
  }

  /**
   * Fetch the complete org/project/env tree from backend
   */
  async fetchTree(): Promise<void> {
    try {
      const response = await axios.get(
        `${config.gatrixUrl}/api/v1/server/internal/environment-tree`,
        {
          headers: {
            'x-api-token': config.apiToken,
            'x-application-name': config.applicationName,
          },
          timeout: 10000,
        }
      );

      if (response.data?.success && response.data?.data?.organisations) {
        this.tree = response.data.data.organisations;
        this.rebuildMaps();

        logger.info('Environment tree fetched', {
          orgs: this.tree.length,
          projects: this.getAllProjects().length,
          environments: this.getAllEnvironmentIds().length,
        });

        // Notify tree change listeners
        for (const cb of this.treeChangeCallbacks) {
          try {
            cb();
          } catch (e) {
            logger.error('Tree change callback error:', e);
          }
        }
      } else {
        logger.error('Invalid response from environment-tree API:', response.data);
      }
    } catch (error: any) {
      logger.error('Failed to fetch environment tree:', error.message);
      throw error;
    }
  }

  /**
   * Rebuild lookup maps from tree
   */
  private rebuildMaps(): void {
    this.envMap.clear();
    this.projectMap.clear();

    for (const org of this.tree) {
      for (const project of org.projects) {
        this.projectMap.set(project.id, { orgId: org.id });
        for (const env of project.environments) {
          this.envMap.set(env.id, { orgId: org.id, projectId: project.id });
        }
      }
    }
  }

  /**
   * Subscribe to lifecycle events
   */
  private async subscribeToEvents(): Promise<void> {
    try {
      this.subscriber = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        lazyConnect: true,
        maxRetriesPerRequest: null,
        autoResubscribe: true,
      });

      await this.subscriber.connect();

      this.subscriber.on('pmessage', (_pattern: string, _channel: string, message: string) => {
        this.handleEvent(message);
      });

      await this.subscriber.psubscribe(`${this.CHANNEL_PREFIX}:*`);

      logger.info(`Subscribed to Redis pattern: ${this.CHANNEL_PREFIX}:*`);
    } catch (error: any) {
      logger.error('Failed to subscribe to events:', error.message);
      // Continue without real-time updates
    }
  }

  /**
   * Handle incoming lifecycle events
   */
  private handleEvent(message: string): void {
    try {
      const event = JSON.parse(message);
      const type = event.type;

      // Only handle environment/project/org lifecycle events
      if (
        type === 'environment.created' ||
        type === 'environment.deleted' ||
        type === 'project.created' ||
        type === 'project.deleted' ||
        type === 'org.created' ||
        type === 'org.deleted'
      ) {
        logger.info(`Received lifecycle event: ${type}`, { data: event.data });

        // Full tree refetch for simplicity and reliability
        this.fetchTree().catch((err) => {
          logger.error('Failed to refetch tree after event:', err.message);
        });
      }
    } catch (error: any) {
      logger.error('Failed to parse event:', error.message);
    }
  }

  // ==================== Query Methods ====================

  /**
   * Get the full tree
   */
  getTree(): OrgNode[] {
    return this.tree;
  }

  /**
   * Get all environment IDs
   */
  getAllEnvironmentIds(): string[] {
    return Array.from(this.envMap.keys());
  }

  /**
   * Get all project IDs
   */
  getAllProjects(): ProjectNode[] {
    return this.tree.flatMap((org) => org.projects);
  }

  /**
   * Get org/project for a given environment ID
   */
  getEnvironmentContext(environmentId: string): { orgId: string; projectId: string } | undefined {
    return this.envMap.get(environmentId);
  }

  /**
   * Get org for a given project ID
   */
  getProjectContext(projectId: string): { orgId: string } | undefined {
    return this.projectMap.get(projectId);
  }

  /**
   * Get environments for a specific project
   */
  getEnvironmentsByProject(projectId: string): EnvironmentNode[] {
    for (const org of this.tree) {
      for (const project of org.projects) {
        if (project.id === projectId) {
          return project.environments;
        }
      }
    }
    return [];
  }

  /**
   * Check if an environment ID exists
   */
  hasEnvironment(environmentId: string): boolean {
    return this.envMap.has(environmentId);
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force refresh
   */
  async refresh(): Promise<void> {
    await this.fetchTree();
  }

  /**
   * Register callback for tree changes.
   * Returns an unsubscribe function.
   */
  onTreeChanged(callback: () => void): () => void {
    this.treeChangeCallbacks.push(callback);
    return () => {
      this.treeChangeCallbacks = this.treeChangeCallbacks.filter((cb) => cb !== callback);
    };
  }
}

export const environmentRegistry = new EnvironmentRegistry();
