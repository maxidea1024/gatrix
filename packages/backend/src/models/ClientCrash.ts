import { Model, QueryBuilder } from "objection";
import { CrashState, CrashFilters } from "../types/crash";
import { generateULID } from "../utils/ulid";
import { isGreaterThan } from "../utils/semver";

/**
 * ClientCrash Model
 * Represents a crash group (deduplicated by hash + branch)
 */
export class ClientCrash extends Model {
  static tableName = "crashes";

  id!: string; // ULID
  chash!: string; // MD5 hash of stack trace
  branch!: string; // Branch name
  environment!: string; // Environment
  platform!: string; // Platform
  marketType?: string; // Market type
  isEditor!: boolean; // Whether crash occurred in editor

  firstLine?: string; // First line of stack trace
  stackFilePath?: string; // Path to stack trace file

  crashesCount!: number; // Number of occurrences
  firstCrashEventId?: string; // ULID of first crash event
  lastCrashEventId?: string; // ULID of last crash event
  firstCrashAt!: Date; // First occurrence timestamp
  lastCrashAt!: Date; // Last occurrence timestamp

  crashesState!: CrashState; // Current state
  assignee?: string; // Assigned developer/team
  jiraTicket?: string; // Jira ticket URL

  maxAppVersion?: string; // Maximum app version
  maxResVersion?: string; // Maximum resource version

  createdAt!: Date;
  updatedAt!: Date;

  static get jsonSchema() {
    return {
      type: "object",
      required: ["id", "chash", "branch", "environment", "platform"],
      properties: {
        id: { type: "string", maxLength: 26 }, // ULID
        chash: { type: "string", maxLength: 32 }, // MD5 hash
        branch: { type: "string", maxLength: 50 },
        environment: { type: "string", maxLength: 50 },
        platform: { type: "string", maxLength: 50 },
        marketType: { type: ["string", "null"], maxLength: 50 },
        isEditor: { type: "boolean", default: false },
        firstLine: { type: ["string", "null"], maxLength: 200 },
        stackFilePath: { type: ["string", "null"], maxLength: 500 },
        crashesCount: { type: "integer", default: 1 },
        firstCrashEventId: { type: ["string", "null"], maxLength: 26 },
        lastCrashEventId: { type: ["string", "null"], maxLength: 26 },
        firstCrashAt: { type: ["string", "object"], format: "date-time" },
        lastCrashAt: { type: ["string", "object"], format: "date-time" },
        crashesState: { type: "integer", enum: [0, 1, 2, 3, 4], default: 0 },
        assignee: { type: ["string", "null"], maxLength: 100 },
        jiraTicket: { type: ["string", "null"], maxLength: 200 },
        maxAppVersion: { type: ["string", "null"], maxLength: 50 },
        maxResVersion: { type: ["string", "null"], maxLength: 50 },
        createdAt: { type: ["string", "object"], format: "date-time" },
        updatedAt: { type: ["string", "object"], format: "date-time" },
      },
    };
  }

  static get relationMappings() {
    return {
      events: {
        relation: Model.HasManyRelation,
        modelClass: "CrashEvent",
        join: {
          from: "crashes.id",
          to: "crash_events.crashId",
        },
      },
    };
  }

  $beforeInsert() {
    if (!this.id) {
      this.id = generateULID();
    }
  }

  /**
   * Find crash by hash and branch
   */
  static async findByHashAndBranch(
    chash: string,
    branch: string,
  ): Promise<ClientCrash | undefined> {
    return await this.query()
      .where("chash", chash)
      .where("branch", branch)
      .first();
  }

  /**
   * Find crashes with filtering and pagination
   */
  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: CrashFilters = {},
  ) {
    const query = this.query();

    // Apply filters
    this.applyFilters(query, filters);

    // Count total
    const countQuery = this.query();
    this.applyFilters(countQuery, filters);
    const total = await countQuery.resultSize();

    // Apply pagination
    const offset = (page - 1) * limit;
    query.offset(offset).limit(limit);

    // Order by last crash time (most recent first)
    query.orderBy("lastCrashAt", "desc");

    const crashes = await query;

    return {
      crashes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Apply filters to query
   */
  private static applyFilters(
    query: QueryBuilder<ClientCrash>,
    filters: CrashFilters,
  ) {
    // Search in firstLine, assignee, jiraTicket
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query.where(function () {
        this.where("firstLine", "like", searchTerm)
          .orWhere("assignee", "like", searchTerm)
          .orWhere("jiraTicket", "like", searchTerm);
      });
    }

    // Date range filter
    if (filters.dateFrom) {
      query.where("firstCrashAt", ">=", filters.dateFrom);
    }
    if (filters.dateTo) {
      query.where("lastCrashAt", "<=", filters.dateTo);
    }

    // Platform filter
    if (filters.platform) {
      query.where("platform", filters.platform);
    }

    // Environment filter
    if (filters.environment) {
      query.where("environment", filters.environment);
    }

    // Branch filter
    if (filters.branch) {
      query.where("branch", filters.branch);
    }

    // Market type filter
    if (filters.marketType) {
      query.where("marketType", filters.marketType);
    }

    // isEditor filter
    if (filters.isEditor !== undefined) {
      query.where("isEditor", filters.isEditor);
    }

    // State filter
    if (filters.state !== undefined) {
      query.where("crashesState", filters.state);
    }

    // Assignee filter
    if (filters.assignee) {
      query.where("assignee", filters.assignee);
    }

    // App version filter
    if (filters.appVersion) {
      query.where("maxAppVersion", "like", `%${filters.appVersion}%`);
    }
  }

  /**
   * Increment crash count and update last crash event
   */
  async incrementCount(lastCrashEventId: string) {
    return await this.$query().patch({
      crashesCount: this.crashesCount + 1,
      lastCrashEventId,
      lastCrashAt: ClientCrash.knex().fn.now(),
    });
  }

  /**
   * Update crash state
   */
  async updateState(state: CrashState) {
    return await this.$query().patch({
      crashesState: state,
      updatedAt: new Date(),
    });
  }

  /**
   * Update assignee
   */
  async updateAssignee(assignee: string) {
    return await this.$query().patch({
      assignee,
      updatedAt: new Date(),
    });
  }

  /**
   * Update Jira ticket
   */
  async updateJiraTicket(jiraTicket: string) {
    return await this.$query().patch({
      jiraTicket,
      updatedAt: new Date(),
    });
  }

  /**
   * Update max versions
   */
  async updateMaxVersions(appVersion?: string, resVersion?: string) {
    const updates: any = {};

    if (
      appVersion &&
      (!this.maxAppVersion || isGreaterThan(appVersion, this.maxAppVersion))
    ) {
      updates.maxAppVersion = appVersion;
    }

    if (
      resVersion &&
      (!this.maxResVersion || resVersion > this.maxResVersion)
    ) {
      updates.maxResVersion = resVersion;
    }

    if (Object.keys(updates).length > 0) {
      return await this.$query().patch(updates);
    }
  }

  /**
   * Reopen crash (change state to REPEATED)
   */
  async reopen() {
    return await this.$query().patch({
      crashesState: CrashState.REPEATED,
      updatedAt: new Date(),
    });
  }

  /**
   * Get crash with events
   */
  static async findByIdWithEvents(id: string) {
    return await this.query()
      .findById(id)
      .withGraphFetched("events")
      .modifyGraph("events", (builder) => {
        builder.orderBy("createdAt", "desc");
      });
  }

  /**
   * Get crash summary statistics
   */
  static async getSummary() {
    const stats = await this.query()
      .select(
        this.raw("COUNT(*) as totalCrashes"),
        this.raw(
          "SUM(CASE WHEN crashesState = 0 THEN 1 ELSE 0 END) as openCrashes",
        ),
        this.raw(
          "SUM(CASE WHEN crashesState = 1 THEN 1 ELSE 0 END) as closedCrashes",
        ),
        this.raw(
          "SUM(CASE WHEN crashesState = 3 THEN 1 ELSE 0 END) as resolvedCrashes",
        ),
        this.raw(
          "SUM(CASE WHEN crashesState = 4 THEN 1 ELSE 0 END) as repeatedCrashes",
        ),
        this.raw("SUM(crashesCount) as totalEvents"),
      )
      .first();

    const recentCrashes = await this.query()
      .orderBy("lastCrashAt", "desc")
      .limit(10);

    return {
      ...stats,
      recentCrashes,
    };
  }
}
