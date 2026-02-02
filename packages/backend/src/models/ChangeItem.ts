import { Model } from "objection";
import { ChangeRequest } from "./ChangeRequest";

/**
 * Operation types for field-level changes
 */
export type OpType = "SET" | "DEL" | "MOD";

/**
 * Single field-level operation
 */
export interface FieldOp {
  path: string; // Field name (or JSON path for nested)
  oldValue: any; // Previous value (null for SET)
  newValue: any; // New value (null for DEL)
  opType: OpType; // SET (add), DEL (remove), MOD (modify)
}

/**
 * Entity-level operation type
 */
export type EntityOpType = "CREATE" | "UPDATE" | "DELETE";

export class ChangeItem extends Model {
  static tableName = "g_change_items";

  id!: string;
  changeRequestId!: string;
  actionGroupId?: string;
  targetTable!: string;
  targetId!: string;
  entityVersion?: number;
  opType!: EntityOpType;
  ops!: FieldOp[];

  // Relations
  changeRequest?: ChangeRequest;
  actionGroup?: any; // Avoid circular import

  static get jsonSchema() {
    return {
      type: "object",
      required: ["changeRequestId", "targetTable", "targetId", "ops"],
      properties: {
        id: { type: "string" },
        changeRequestId: { type: "string" },
        actionGroupId: { type: ["string", "null"] },
        targetTable: { type: "string", maxLength: 100 },
        targetId: { type: "string", maxLength: 255 },
        entityVersion: { type: ["integer", "null"] },
        opType: { type: "string", enum: ["CREATE", "UPDATE", "DELETE"] },
        ops: {
          type: "array",
          items: {
            type: "object",
            required: ["path", "opType"],
            properties: {
              path: { type: "string" },
              oldValue: {},
              newValue: {},
              opType: { type: "string", enum: ["SET", "DEL", "MOD"] },
            },
          },
        },
      },
    };
  }

  // JSON parsing for ops column
  static get jsonAttributes() {
    return ["ops"];
  }

  static get relationMappings() {
    const { ActionGroup } = require("./ActionGroup");

    return {
      changeRequest: {
        relation: Model.BelongsToOneRelation,
        modelClass: ChangeRequest,
        join: {
          from: "g_change_items.changeRequestId",
          to: "g_change_requests.id",
        },
      },
      actionGroup: {
        relation: Model.BelongsToOneRelation,
        modelClass: ActionGroup,
        join: {
          from: "g_change_items.actionGroupId",
          to: "g_action_groups.id",
        },
      },
    };
  }
}
