import { Model } from "objection";
import { ChangeRequest } from "./ChangeRequest";

/**
 * Action Group type constants
 */
export const ACTION_GROUP_TYPES = {
  CREATE_ENTITY: "CREATE_ENTITY",
  UPDATE_ENTITY: "UPDATE_ENTITY",
  DELETE_ENTITY: "DELETE_ENTITY",
  TOGGLE_FLAG: "TOGGLE_FLAG",
  UPDATE_RULE: "UPDATE_RULE",
  BATCH_UPDATE: "BATCH_UPDATE",
  REVERT: "REVERT",
} as const;

export type ActionGroupType =
  (typeof ACTION_GROUP_TYPES)[keyof typeof ACTION_GROUP_TYPES];

/**
 * ActionGroup model
 *
 * Represents a user's semantic action unit within a Change Request.
 * Each Action Group can contain multiple ChangeItems (operations).
 *
 * Examples:
 * - "Create new service notice"
 * - "Update event reward rules"
 * - "Toggle maintenance mode"
 */
export class ActionGroup extends Model {
  static tableName = "g_action_groups";

  id!: string;
  changeRequestId!: string;
  actionType!: ActionGroupType;
  title!: string;
  description?: string;
  orderIndex!: number;
  createdAt!: Date;

  // Relations
  changeRequest?: ChangeRequest;
  changeItems?: any[]; // Circular import prevention

  static get jsonSchema() {
    return {
      type: "object",
      required: ["changeRequestId", "actionType", "title"],
      properties: {
        id: { type: "string" },
        changeRequestId: { type: "string" },
        actionType: {
          type: "string",
          enum: Object.values(ACTION_GROUP_TYPES),
        },
        title: { type: "string", minLength: 1, maxLength: 255 },
        description: { type: ["string", "null"] },
        orderIndex: { type: "integer", minimum: 0 },
        createdAt: { type: "string", format: "date-time" },
      },
    };
  }

  static get relationMappings() {
    const { ChangeItem } = require("./ChangeItem");

    return {
      changeRequest: {
        relation: Model.BelongsToOneRelation,
        modelClass: ChangeRequest,
        join: {
          from: "g_action_groups.changeRequestId",
          to: "g_change_requests.id",
        },
      },
      changeItems: {
        relation: Model.HasManyRelation,
        modelClass: ChangeItem,
        join: {
          from: "g_action_groups.id",
          to: "g_change_items.actionGroupId",
        },
      },
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
  }
}
