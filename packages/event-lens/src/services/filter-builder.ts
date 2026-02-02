import { clickhouse } from "../config/clickhouse";
import logger from "../utils/logger";

export interface Filter {
  field: string;
  operator:
    | "eq"
    | "ne"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "nin"
    | "contains"
    | "notContains";
  value: any;
}

export class FilterBuilder {
  /**
   * 동적 필터를 ClickHouse WHERE 절로 변환
   */
  buildFilterClause(filters: Filter[]): string {
    if (!filters || filters.length === 0) {
      return "";
    }

    const clauses = filters.map((filter) => this.buildSingleFilter(filter));
    return `AND (${clauses.join(" AND ")})`;
  }

  private buildSingleFilter(filter: Filter): string {
    const { field, operator, value } = filter;

    // Properties JSON 필드 처리
    if (field.startsWith("properties.")) {
      const propertyKey = field.replace("properties.", "");
      return this.buildPropertyFilter(propertyKey, operator, value);
    }

    // 일반 필드 처리
    switch (operator) {
      case "eq":
        return `${field} = ${this.formatValue(value)}`;
      case "ne":
        return `${field} != ${this.formatValue(value)}`;
      case "gt":
        return `${field} > ${this.formatValue(value)}`;
      case "gte":
        return `${field} >= ${this.formatValue(value)}`;
      case "lt":
        return `${field} < ${this.formatValue(value)}`;
      case "lte":
        return `${field} <= ${this.formatValue(value)}`;
      case "in":
        return `${field} IN (${this.formatArray(value)})`;
      case "nin":
        return `${field} NOT IN (${this.formatArray(value)})`;
      case "contains":
        return `${field} LIKE '%${this.escapeString(value)}%'`;
      case "notContains":
        return `${field} NOT LIKE '%${this.escapeString(value)}%'`;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  private buildPropertyFilter(
    key: string,
    operator: string,
    value: any,
  ): string {
    // JSONExtractString을 사용하여 properties JSON에서 값 추출
    const extractExpr = `JSONExtractString(properties, '${this.escapeString(key)}')`;

    switch (operator) {
      case "eq":
        return `${extractExpr} = ${this.formatValue(value)}`;
      case "ne":
        return `${extractExpr} != ${this.formatValue(value)}`;
      case "contains":
        return `${extractExpr} LIKE '%${this.escapeString(value)}%'`;
      case "notContains":
        return `${extractExpr} NOT LIKE '%${this.escapeString(value)}%'`;
      case "in":
        return `${extractExpr} IN (${this.formatArray(value)})`;
      case "nin":
        return `${extractExpr} NOT IN (${this.formatArray(value)})`;
      default:
        // 숫자 비교는 JSONExtractFloat 사용
        const numExpr = `JSONExtractFloat(properties, '${this.escapeString(key)}')`;
        switch (operator) {
          case "gt":
            return `${numExpr} > ${value}`;
          case "gte":
            return `${numExpr} >= ${value}`;
          case "lt":
            return `${numExpr} < ${value}`;
          case "lte":
            return `${numExpr} <= ${value}`;
          default:
            throw new Error(`Unsupported property operator: ${operator}`);
        }
    }
  }

  private formatValue(value: any): string {
    if (typeof value === "string") {
      return `'${this.escapeString(value)}'`;
    }
    if (typeof value === "number") {
      return value.toString();
    }
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    if (value === null) {
      return "NULL";
    }
    return `'${this.escapeString(String(value))}'`;
  }

  private formatArray(values: any[]): string {
    return values.map((v) => this.formatValue(v)).join(", ");
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
  }

  /**
   * 프로젝트의 모든 이벤트에서 사용된 properties 키 추출
   * (필터 UI에서 자동완성용)
   */
  async getPropertyKeys(
    projectId: string,
    eventName?: string,
  ): Promise<string[]> {
    try {
      let query = `
        SELECT DISTINCT arrayJoin(propertiesKeys) as key
        FROM event_lens.events
        WHERE projectId = {projectId:String}
      `;

      if (eventName) {
        query += ` AND name = {eventName:String}`;
      }

      query += `
        ORDER BY key
        LIMIT 1000
      `;

      const result = await clickhouse.query({
        query,
        query_params: eventName ? { projectId, eventName } : { projectId },
      });

      const data: any = await result.json();
      return (data.data || []).map((row: any) => row.key);
    } catch (error: any) {
      logger.error("Failed to get property keys", {
        error: error.message,
        projectId,
      });
      return [];
    }
  }

  /**
   * 특정 property 키의 고유 값 추출
   * (필터 UI에서 값 선택용)
   */
  async getPropertyValues(
    projectId: string,
    propertyKey: string,
    eventName?: string,
    limit: number = 100,
  ): Promise<any[]> {
    try {
      let query = `
        SELECT DISTINCT JSONExtractString(properties, {propertyKey:String}) as value
        FROM event_lens.events
        WHERE projectId = {projectId:String}
          AND has(propertiesKeys, {propertyKey:String})
      `;

      if (eventName) {
        query += ` AND name = {eventName:String}`;
      }

      query += `
        AND value != ''
        ORDER BY value
        LIMIT {limit:UInt32}
      `;

      const result = await clickhouse.query({
        query,
        query_params: eventName
          ? { projectId, propertyKey, eventName, limit }
          : { projectId, propertyKey, limit },
      });

      const data: any = await result.json();
      return (data.data || []).map((row: any) => row.value);
    } catch (error: any) {
      logger.error("Failed to get property values", {
        error: error.message,
        projectId,
        propertyKey,
      });
      return [];
    }
  }

  /**
   * 이벤트 이름 목록 추출
   */
  async getEventNames(projectId: string): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT name
        FROM event_lens.events
        WHERE projectId = {projectId:String}
        ORDER BY name
        LIMIT 1000
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId },
      });

      const data: any = await result.json();
      return (data.data || []).map((row: any) => row.name);
    } catch (error: any) {
      logger.error("Failed to get event names", {
        error: error.message,
        projectId,
      });
      return [];
    }
  }

  /**
   * 경로 목록 추출
   */
  async getPaths(projectId: string, limit: number = 100): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT path
        FROM event_lens.events
        WHERE projectId = {projectId:String}
          AND path IS NOT NULL
        ORDER BY path
        LIMIT {limit:UInt32}
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, limit },
      });

      const data: any = await result.json();
      return (data.data || []).map((row: any) => row.path);
    } catch (error: any) {
      logger.error("Failed to get paths", { error: error.message, projectId });
      return [];
    }
  }

  /**
   * 국가 목록 추출
   */
  async getCountries(projectId: string): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT country
        FROM event_lens.events
        WHERE projectId = {projectId:String}
          AND country IS NOT NULL
        ORDER BY country
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId },
      });

      const data: any = await result.json();
      return (data.data || []).map((row: any) => row.country);
    } catch (error: any) {
      logger.error("Failed to get countries", {
        error: error.message,
        projectId,
      });
      return [];
    }
  }
}

export default FilterBuilder;
