/**
 * OpenPanel 스타일 이벤트 정규화 유틸리티
 *
 * 중첩된 객체를 평탄화하여 ClickHouse Map 타입에 저장하기 쉽게 만듭니다.
 *
 * 예시:
 * { user: { name: 'John', age: 30 } }
 * → { 'user.name': 'John', 'user.age': '30' }
 */

/**
 * 중첩된 객체를 점(.) 표기법으로 평탄화합니다.
 *
 * @param obj - 평탄화할 객체
 * @param prefix - 키 접두사 (재귀 호출시 사용)
 * @returns 평탄화된 객체
 *
 * @example
 * ```typescript
 * const nested = {
 *   user: {
 *     name: 'John',
 *     address: {
 *       city: 'Seoul',
 *       country: 'KR'
 *     }
 *   },
 *   age: 30
 * };
 *
 * const flattened = toDots(nested);
 * // {
 * //   'user.name': 'John',
 * //   'user.address.city': 'Seoul',
 * //   'user.address.country': 'KR',
 * //   'age': '30'
 * // }
 * ```
 */
export function toDots(
  obj: Record<string, any>,
  prefix: string = "",
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    // null, undefined는 건너뜀
    if (value === null || value === undefined) {
      continue;
    }

    const newKey = prefix ? `${prefix}.${key}` : key;

    // 배열은 JSON 문자열로 변환
    if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    }
    // 객체는 재귀적으로 평탄화
    else if (typeof value === "object" && value !== null) {
      // Date 객체는 ISO 문자열로 변환
      if (value instanceof Date) {
        result[newKey] = value.toISOString();
      } else {
        Object.assign(result, toDots(value, newKey));
      }
    }
    // 기본 타입은 문자열로 변환
    else {
      result[newKey] = String(value);
    }
  }

  return result;
}

/**
 * 평탄화된 객체를 원래 중첩 구조로 복원합니다.
 *
 * @param obj - 평탄화된 객체
 * @returns 중첩된 객체
 *
 * @example
 * ```typescript
 * const flattened = {
 *   'user.name': 'John',
 *   'user.address.city': 'Seoul',
 *   'age': '30'
 * };
 *
 * const nested = fromDots(flattened);
 * // {
 * //   user: {
 * //     name: 'John',
 * //     address: {
 * //       city: 'Seoul'
 * //     }
 * //   },
 * //   age: '30'
 * // }
 * ```
 */
export function fromDots(obj: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split(".");
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]!;
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }

    const lastKey = keys[keys.length - 1]!;
    current[lastKey] = value;
  }

  return result;
}

/**
 * ClickHouse Map 타입으로 변환합니다.
 *
 * @param obj - 변환할 객체
 * @returns Map 형태의 객체 { keys: string[], values: string[] }
 *
 * @example
 * ```typescript
 * const obj = { name: 'John', age: 30 };
 * const map = toClickHouseMap(obj);
 * // { keys: ['name', 'age'], values: ['John', '30'] }
 * ```
 */
export function toClickHouseMap(obj: Record<string, any>): {
  keys: string[];
  values: string[];
} {
  const flattened = toDots(obj);
  return {
    keys: Object.keys(flattened),
    values: Object.values(flattened),
  };
}

/**
 * ClickHouse Map 타입에서 객체로 변환합니다.
 *
 * @param map - Map 형태의 객체
 * @returns 일반 객체
 *
 * @example
 * ```typescript
 * const map = { keys: ['name', 'age'], values: ['John', '30'] };
 * const obj = fromClickHouseMap(map);
 * // { name: 'John', age: '30' }
 * ```
 */
export function fromClickHouseMap(map: {
  keys: string[];
  values: string[];
}): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < map.keys.length; i++) {
    result[map.keys[i]!] = map.values[i]!;
  }
  return result;
}

/**
 * 빈 값을 제거합니다.
 *
 * @param obj - 정리할 객체
 * @returns 빈 값이 제거된 객체
 *
 * @example
 * ```typescript
 * const obj = { name: 'John', age: '', city: null, country: undefined };
 * const cleaned = removeEmpty(obj);
 * // { name: 'John' }
 * ```
 */
export function removeEmpty(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    // null, undefined, 빈 문자열 제거
    if (value === null || value === undefined || value === "") {
      continue;
    }

    // 빈 배열 제거
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    // 빈 객체 제거
    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    ) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

/**
 * LowCardinality 필드 목록
 * 이 필드들은 ClickHouse에서 LowCardinality 타입으로 저장됩니다.
 */
export const LOW_CARDINALITY_FIELDS = [
  "name",
  "country",
  "region",
  "os",
  "osVersion",
  "browser",
  "browserVersion",
  "device",
  "brand",
  "model",
  "referrerType",
  "utmSource",
  "utmMedium",
  "utmCampaign",
] as const;

/**
 * 압축 코덱이 적용된 필드 목록
 */
export const COMPRESSED_FIELDS = {
  // ZSTD(3) 압축
  zstd: [
    "projectId",
    "deviceId",
    "profileId",
    "path",
    "origin",
    "referrer",
    "referrerName",
    "userAgent",
  ],
  // LZ4 압축
  lz4: ["sessionId"],
  // Delta + LZ4 압축 (시계열 데이터)
  delta: ["duration", "screenViews"],
  // DoubleDelta + ZSTD 압축 (타임스탬프)
  doubleDelta: ["createdAt", "timestamp"],
  // Gorilla + LZ4 압축 (Float 시계열)
  gorilla: ["latitude", "longitude"],
} as const;

/**
 * 이벤트 데이터를 정규화합니다.
 *
 * @param event - 정규화할 이벤트
 * @returns 정규화된 이벤트
 */
export function normalizeEvent(
  event: Record<string, any>,
): Record<string, any> {
  const normalized = { ...event };

  // properties를 평탄화
  if (normalized.properties && typeof normalized.properties === "object") {
    normalized.properties = toDots(normalized.properties);
  }

  // 빈 값 제거
  return removeEmpty(normalized);
}

/**
 * 이벤트 배열을 정규화합니다.
 *
 * @param events - 정규화할 이벤트 배열
 * @returns 정규화된 이벤트 배열
 */
export function normalizeEvents(
  events: Record<string, any>[],
): Record<string, any>[] {
  return events.map(normalizeEvent);
}
