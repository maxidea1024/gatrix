import { Model } from "objection";
import { User } from "./User";
import { ulid } from "ulid";

export interface ProjectData {
  id?: string; // ULID (26 characters)
  projectName: string;
  displayName: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  createdBy: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Project extends Model implements ProjectData {
  static tableName = "g_projects";

  id!: string; // ULID
  projectName!: string;
  displayName!: string;
  description?: string;
  isDefault!: boolean;
  isActive!: boolean;
  createdBy!: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  creator?: User;
  updater?: User;

  static get jsonSchema() {
    return {
      type: "object",
      required: ["projectName", "displayName", "createdBy"],
      properties: {
        id: { type: "string", minLength: 26, maxLength: 26 }, // ULID
        projectName: {
          type: "string",
          minLength: 1,
          maxLength: 100,
          pattern: "^[a-z0-9_-]+$",
        },
        displayName: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: ["string", "null"], maxLength: 1000 },
        isDefault: { type: "boolean" },
        isActive: { type: "boolean" },
        createdBy: { type: "integer" },
        updatedBy: { type: ["integer", "null"] },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    };
  }

  static get relationMappings() {
    const { Environment } = require("./Environment");
    return {
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: "g_projects.createdBy",
          to: "g_users.id",
        },
      },
      updater: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: "g_projects.updatedBy",
          to: "g_users.id",
        },
      },
      environments: {
        relation: Model.HasManyRelation,
        modelClass: Environment,
        join: {
          from: "g_projects.id",
          to: "g_environments.projectId",
        },
      },
    };
  }

  $beforeInsert() {
    if (!this.id) {
      this.id = ulid();
    }
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }

  /**
   * Get default project
   */
  static async getDefault(): Promise<Project | undefined> {
    return await this.query().where("isDefault", true).first();
  }

  /**
   * Get project by name
   */
  static async getByName(projectName: string): Promise<Project | undefined> {
    return await this.query().where("projectName", projectName).first();
  }

  /**
   * Get all active projects
   */
  static async getAllActive(): Promise<Project[]> {
    return await this.query()
      .where("isActive", true)
      .orderBy("isDefault", "desc")
      .orderBy("displayName");
  }

  /**
   * Validate project name format
   */
  static isValidProjectName(name: string): boolean {
    return /^[a-z0-9_-]+$/.test(name) && name.length >= 1 && name.length <= 100;
  }

  /**
   * Create new project
   */
  static async createProject(
    data: Omit<ProjectData, "id" | "createdAt" | "updatedAt">,
  ): Promise<Project> {
    if (!this.isValidProjectName(data.projectName)) {
      throw new Error(
        "Invalid project name. Use only lowercase letters, numbers, underscore, and hyphen.",
      );
    }

    const existing = await this.getByName(data.projectName);
    if (existing) {
      throw new Error(`Project '${data.projectName}' already exists`);
    }

    if (data.isDefault) {
      await this.query().patch({ isDefault: false });
    }

    return await this.query().insert(data);
  }
}

export default Project;
