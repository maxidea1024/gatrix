import axios from "axios";
import Redis from "ioredis";
import { config } from "../config/env";
import logger from "../config/logger";

/**
 * Token structure mirrored from backend
 * Note: id is number to match backend database ID for usage tracking
 */
export interface MirroredToken {
  id: number;
  tokenName: string;
  tokenValue: string;
  tokenType: "client" | "server" | "edge" | "all";
  allowAllEnvironments: boolean;
  environments: string[]; // ['*'] for all, or list of environment names
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  token?: MirroredToken;
  reason?: "not_found" | "expired" | "invalid_type" | "invalid_environment";
}

/**
 * TokenMirrorService - Mirrors all API tokens from backend to Edge memory
 * Uses ioredis for real-time token change notifications via Redis PubSub
 */
class TokenMirrorService {
  private tokens: Map<string, MirroredToken> = new Map(); // tokenValue -> token
  private tokenById: Map<number, MirroredToken> = new Map(); // id -> token
  private subscriber: Redis | null = null;
  private initialized = false;
  private readonly CHANNEL_NAME = "gatrix-sdk-events";

  /**
   * Initialize the token mirror service
   * Fetches all tokens from backend and subscribes to change events
   * Note: This should be called after SDK initialization (backend is ready)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn("[TokenMirror] Already initialized");
      return;
    }

    logger.info("[TokenMirror] Initializing token mirror service...");

    // Fetch initial tokens
    await this.fetchAllTokens();

    // Subscribe to token change events
    await this.subscribeToEvents();

    this.initialized = true;
    logger.info(`[TokenMirror] Initialized with ${this.tokens.size} tokens`);
  }

  /**
   * Shutdown the token mirror service
   */
  async shutdown(): Promise<void> {
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(this.CHANNEL_NAME);
        await this.subscriber.quit();
        this.subscriber = null;
      } catch (error) {
        logger.error("[TokenMirror] Error during shutdown:", error);
      }
    }
    this.tokens.clear();
    this.tokenById.clear();
    this.initialized = false;
    logger.info("[TokenMirror] Shutdown complete");
  }

  /**
   * Fetch all tokens from backend
   */
  async fetchAllTokens(): Promise<void> {
    try {
      const response = await axios.get(
        `${config.gatrixUrl}/api/v1/server/internal/tokens`,
        {
          headers: {
            "x-api-token": config.apiToken,
            "x-application-name": config.applicationName,
          },
          timeout: 10000,
        },
      );

      if (response.data?.success && response.data?.data?.tokens) {
        const tokens: MirroredToken[] = response.data.data.tokens;

        // Clear existing tokens
        this.tokens.clear();
        this.tokenById.clear();

        // Add new tokens
        for (const token of tokens) {
          this.tokens.set(token.tokenValue, token);
          this.tokenById.set(token.id, token);
        }

        logger.info(
          `[TokenMirror] Fetched ${tokens.length} tokens from backend`,
        );
      } else {
        logger.error(
          "[TokenMirror] Invalid response from backend:",
          response.data,
        );
      }
    } catch (error: any) {
      logger.error("[TokenMirror] Failed to fetch tokens:", error.message);
      throw error;
    }
  }

  /**
   * Subscribe to token change events via Redis PubSub
   */
  private async subscribeToEvents(): Promise<void> {
    try {
      this.subscriber = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        lazyConnect: true,
      });

      await this.subscriber.connect();

      this.subscriber.on("message", (channel: string, message: string) => {
        if (channel === this.CHANNEL_NAME) {
          this.handleEvent(message);
        }
      });

      await this.subscriber.subscribe(this.CHANNEL_NAME);

      logger.info(
        `[TokenMirror] Subscribed to Redis channel: ${this.CHANNEL_NAME}`,
      );
    } catch (error: any) {
      logger.error(
        "[TokenMirror] Failed to subscribe to events:",
        error.message,
      );
      // Continue without real-time updates - will rely on manual refresh
    }
  }

  /**
   * Handle incoming event from Redis PubSub
   */
  private handleEvent(message: string): void {
    try {
      const event = JSON.parse(message);

      if (!event.type?.startsWith("api_token.")) {
        return; // Not a token event
      }

      logger.info(`[TokenMirror] Received event: ${event.type}`, {
        id: event.data?.id,
      });

      // For any token change, refetch all tokens
      // This is simpler and more reliable than incremental updates
      this.fetchAllTokens().catch((err) => {
        logger.error(
          "[TokenMirror] Failed to refetch tokens after event:",
          err.message,
        );
      });
    } catch (error: any) {
      logger.error("[TokenMirror] Failed to parse event:", error.message);
    }
  }

  /**
   * Validate a token
   */
  validateToken(
    tokenValue: string,
    requiredType: "client" | "server" | "all",
    environment?: string,
  ): TokenValidationResult {
    // Check for unsecured client token (for testing purposes, client -> edge)
    // Note: id=0 is used for unsecured tokens to skip usage tracking
    if (tokenValue === config.unsecuredClientToken) {
      logger.debug("Unsecured client token used for testing");
      const unsecuredToken: MirroredToken = {
        id: 0, // 0 indicates unsecured token, usage tracking will be skipped
        tokenName: "Unsecured Client Token (Testing)",
        tokenValue: config.unsecuredClientToken,
        tokenType: "all",
        allowAllEnvironments: true,
        environments: ["*"],
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { valid: true, token: unsecuredToken };
    }

    const token = this.tokens.get(tokenValue);

    if (!token) {
      return { valid: false, reason: "not_found" };
    }

    // Check expiration
    if (token.expiresAt) {
      const expiresAt = new Date(token.expiresAt);
      if (expiresAt < new Date()) {
        return { valid: false, token, reason: "expired" };
      }
    }

    // Check token type
    // 'all' type can access both client and server APIs
    if (token.tokenType !== "all" && token.tokenType !== requiredType) {
      return { valid: false, token, reason: "invalid_type" };
    }

    // Check environment access
    if (environment && !token.allowAllEnvironments) {
      if (
        !token.environments.includes(environment) &&
        !token.environments.includes("*")
      ) {
        return { valid: false, token, reason: "invalid_environment" };
      }
    }

    return { valid: true, token };
  }

  /**
   * Get token by value
   */
  getToken(tokenValue: string): MirroredToken | undefined {
    return this.tokens.get(tokenValue);
  }

  /**
   * Get token by ID
   */
  getTokenById(id: number): MirroredToken | undefined {
    return this.tokenById.get(id);
  }

  /**
   * Get all tokens count
   */
  getTokenCount(): number {
    return this.tokens.size;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force refresh tokens from backend
   */
  async refresh(): Promise<void> {
    await this.fetchAllTokens();
  }
}

export const tokenMirrorService = new TokenMirrorService();
