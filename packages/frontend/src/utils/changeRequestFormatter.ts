import { TFunction } from "i18next";

/**
 * Maps database table names to localization keys
 */
export const getTableLocalizationKey = (tableName: string): string => {
  // Remove g_ prefix if present for cleaner matching
  const cleanName = tableName.startsWith("g_") ? tableName.slice(2) : tableName;

  // Check for common table names
  const mapping: Record<string, string> = {
    service_notices: "tables.serviceNotices",
    ingame_popup_notices: "tables.ingamePopupNotices",
    coupons: "tables.coupons",
    events: "tables.events",
    store_products: "tables.storeProducts",
    server_lifecycle_events: "tables.serverLifecycleEvents",
    users: "tables.users",
    client_versions: "tables.clientVersions",
    game_worlds: "tables.gameWorlds",
    // Add more mappings as needed
  };

  return mapping[cleanName] || mapping[tableName] || `tables.${cleanName}`;
};

/**
 * Formats a Change Request title into a localized, friendly string
 * Attempts to parse standard generated patterns like "[table] Action: ID"
 */
export const formatChangeRequestTitle = (
  title: string,
  t: TFunction,
): string => {
  if (!title) return "";

  // Regex for standard generated title: [table] Action: Identifier
  // Example: "[service_notices] Update: 123"
  const standardPattern = /^\[(.*?)\] (Create|Update|Delete): (.*)$/;
  const match = title.match(standardPattern);

  if (match) {
    const [, tableName, action, identifier] = match;
    const tableKey = getTableLocalizationKey(tableName);
    const tableNameLocalized = t(tableKey, { defaultValue: tableName });

    let actionLocalized = action;
    if (action === "Create") actionLocalized = t("common.create");
    else if (action === "Update") actionLocalized = t("common.update");
    else if (action === "Delete") actionLocalized = t("common.delete");

    // Format: [Service Notice] Update: 123
    // Or more natural Korean: 서비스 공지 수정: 123
    // Let's stick to a bracket format for clarity but localized
    let identifierLocalized = identifier;
    if (identifier === "New Item") {
      identifierLocalized = t("common.newItem");
    }
    return `[${tableNameLocalized}] ${actionLocalized}: ${identifierLocalized}`;
  }

  // Action Group Title Pattern: "Create service_notices" (from ActionGroup generation)
  const actionGroupPattern = /^(Create|Update|Delete|Batch Update) (.*)$/;
  const agMatch = title.match(actionGroupPattern);

  if (agMatch) {
    const [, action, tableName] = agMatch;
    const tableKey = getTableLocalizationKey(tableName);
    const tableNameLocalized = t(tableKey, { defaultValue: tableName });

    // Map common actions
    const actionMap: Record<string, string> = {
      Create: "common.create",
      Update: "common.update",
      Delete: "common.delete",
      "Batch Update": "common.batchUpdate",
    };

    const actionLocalized = t(
      actionMap[action] || `common.${action.toLowerCase()}`,
      { defaultValue: action },
    );

    return `${tableNameLocalized} ${actionLocalized}`;
  }

  return title;
};

/**
 * Formats a single Change Item identifier into a localized, friendly string
 * Format: "Table Name: Friendly Name (or ID)"
 */
export const formatChangeItemTitle = (
  table: string,
  targetId: string,
  afterData: any,
  t: TFunction,
): string => {
  const tableKey = getTableLocalizationKey(table);
  const tableNameLocalized = t(tableKey, { defaultValue: table });

  let friendlyName = targetId;

  // Try to find a friendly name from the data if available
  if (afterData && typeof afterData === "object") {
    const cleanTable = table.replace(/^g_/, "");

    // Table specific priorities
    if (cleanTable === "game_worlds") {
      if (afterData.name) friendlyName = afterData.name;
      else if (afterData.worldId) friendlyName = afterData.worldId;
    } else if (cleanTable === "client_versions") {
      if (afterData.clientVersion) friendlyName = afterData.clientVersion;
    }

    // Fallback to general list if still ID or strict ID needed
    // Only run if we haven't found a better name (fetched ID is same as targetId usually)
    if (friendlyName === targetId || friendlyName.startsWith("NEW_")) {
      // List of potential friendly name fields in priority order
      const nameFields = [
        "title",
        "name",
        "displayName",
        "code",
        "clientVersion",
        "worldId",
        "id",
      ];

      for (const field of nameFields) {
        if (
          afterData[field] &&
          (typeof afterData[field] === "string" ||
            typeof afterData[field] === "number")
        ) {
          friendlyName = String(afterData[field]);
          break;
        }
      }
    }
  }

  // Special handling for NEW_ IDs: if friendlyName is still the ID, try to make it generic
  if (friendlyName.startsWith("NEW_")) {
    // If we couldn't find a better name, just call it "New Item" but localized
    // However, often the user just wants the table name if no specific name exists yet
    // keeping ID is safer for debugging but maybe we can shorten it
  }

  return `${tableNameLocalized}: ${friendlyName}`;
};
