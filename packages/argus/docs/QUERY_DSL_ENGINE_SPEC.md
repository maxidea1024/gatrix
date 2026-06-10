# Query DSL Engine Specification

> **Status**: Draft v1.1  
> **Last Updated**: 2025-06-09  
> **Author**: Gatrix Frontend Team  
> **Scope**: Frontend Query DSL Engine for Argus (Logs, Issues, Discover, Performance, Feedback, Sessions)

---

## 1. Overview

### 1.1 Purpose

Argus Query DSL Engine은 Sentry / Datadog / Kibana 스타일의 **Context-Aware Query Editor**를 구현하는 프로젝트이다.

단순 검색 입력창이 아니라, DSL 문법을 이해하고 현재 입력 상태·커서 위치·문법 상태에 따라 적절한 추천을 제공하는 **Query DSL Engine**이다.

### 1.2 Core Principles

1. **검색은 Enter 시에만 실행** — 입력 중 검색 API 호출 금지
2. **자동완성과 검색은 완전히 분리**
3. **문법 처리는 반드시 Lexer → Parser → AST 기반** — 정규식/split/includes 기반 금지
4. **미완성 입력을 정상 처리** — 사용자는 항상 완성된 문장을 입력하지 않음
5. **DSL 로직과 UI는 완전히 분리** — UI는 렌더링만 담당
6. **문법 오류 시 쿼리 실행 차단** — 오류가 있으면 Enter를 눌러도 검색 실행하지 않음
7. **자동완성으로 오류 예방** — 자동완성이 사용자를 올바른 문법으로 유도하여 오류 발생을 최소화

### 1.3 Architecture

```
User Input (contentEditable)
    ↓
  Lexer          — 문자 단위 스캔 → Token[]
    ↓
  Parser         — 재귀 하강 파싱 → AST
    ↓
  Editor FSM     — 토큰 + 커서 위치 → EditorState
    ↓
  CursorContext  — 커서 위치 기반 context 분석
    ↓
  SuggestionEngine — context + 필드 메타 → SuggestionItem[]
    ↓
  UI (Dropdown)  — 순수 렌더링
```

---

## 2. DSL Grammar

### 2.1 기본 문법

DSL의 기본 문법은 `field:value`이다. Colon(`:`)은 필드와 값을 구분하는 구분자이다.

```
country:KR
os:iOS
level:100
message:"network error"
```

### 2.2 연산자 문법

연산자는 colon 뒤에 위치한다.

#### 비교 연산자 (colon 직후)

```
country:KR           — 기본 (= 연산자, 암시적)
country:!=CN         — 부정
level:>100           — 초과
level:>=100          — 이상
level:<1000          — 미만
level:<=1000         — 이하
```

#### 함수형 연산자 (괄호 포함)

```
message:contains("timeout")
message:startsWith("network")
message:endsWith("error")
createdAt:before("2025-02-01")
createdAt:after("2025-01-01")
```

#### IN 연산자 (다중 값 검색)

여러 값을 OR로 반복하는 대신 `in()` 함수형 연산자로 간결하게 표현할 수 있다.

```
country:in("KR", "JP", "US")     — country가 KR, JP, US 중 하나
level:in("error", "fatal")        — level이 error 또는 fatal
```

**IN은 내부적으로 OR 체인으로 변환된다:**
```
country:in("KR", "JP")  →  (country:KR or country:JP)
```

### 2.2 값 표현

```
country:KR
message:"network error"
level:>100
message:contains("timeout")
createdAt:before("2025-02-01")
createdAt:after("2025-01-01")
```

#### 상대 시간 (Relative Time)

datetime 필드에서 상대 시간 표기를 지원한다.

```
timestamp:after("now-1h")         — 1시간 전 이후
timestamp:before("now-7d")        — 7일 전 이전
timestamp:after("-24h")           — 24시간 전 이후 (축약형)
timestamp:after("-30m")           — 30분 전 이후
```

| 포맷 | 의미 | 예시 |
|------|------|------|
| `now` | 현재 시각 | `now` |
| `now-Nd` | N일 전 | `now-7d` |
| `now-Nh` | N시간 전 | `now-1h` |
| `now-Nm` | N분 전 | `now-30m` |
| `-Nd` / `-Nh` / `-Nm` | 축약형 (now 생략) | `-24h` |
| `YYYY-MM-DD` | 절대 날짜 | `2025-01-01` |
| `YYYY-MM-DDTHH:mm:ss` | 절대 시각 | `2025-01-01T00:00:00` |

상대 시간은 **Serializer에서 절대 시각으로 변환하지 않는다** — 백엔드에 문자열 그대로 전달하고 백엔드가 해석한다.

### 2.2.1 Free Text Search (필드 없는 검색)

필드 없이 단독으로 입력하면 **message 필드의 contains 검색**으로 처리한다.

```
timeout                    → message:contains("timeout")
"network error"            → message:contains("network error")
timeout and country:KR     → message:contains("timeout") and country:KR
```

### 2.2.2 와일드카드 및 정규식 지원 정책

| 기능 | 지원 여부 | 이유 |
|------|-----------|------|
| **와일드카드 (`*`, `?`)** | ❌ 미지원 | `contains`/`startsWith`/`endsWith` 함수형 연산자로 대체. 와일드카드는 모호성 유발 |
| **정규식** | ❌ 미지원 | 백엔드 ClickHouse가 정규식 검색을 지원하지만, 쿼리 성능 저하 위험. 향후 Extension Point로 예약 |

값 내부의 `*`, `?`는 **특수문자가 아닌 일반 문자**로 취급한다:
```
message:contains("*network*")  → "*network*" 문자열 그대로 검색 (와일드카드 아님)
message:"test?.log"            → "test?.log" 문자열 그대로 검색 (와일드카드 아님)
```

### 2.3 논리 연산자

```
country:KR and level:>100
country:KR or country:JP
not country:CN
!country:CN                              — not의 축약형
!(country:KR or country:JP)
(country:KR or country:JP) and level:>100
```

- `and`, `or`, `not` — 대소문자 구분 없음 (`AND`, `Or`, `NOT` 모두 동일)
- `!` — `not`의 축약형. 동일한 동작. 백엔드와 1:1 호환

### 2.4 EBNF Grammar

```
Query         = Expression | ε
Expression    = OrExpr
OrExpr        = AndExpr ( OR AndExpr )*
AndExpr       = UnaryExpr ( AND UnaryExpr )*
UnaryExpr     = (NOT | BANG) UnaryExpr | Primary
Primary       = LPAREN Expression RPAREN | Filter | FreeText

Filter        = FIELD COLON ValueExpr
FreeText      = QuotedString | UnquotedString    — 필드 없이 단독 입력 → FreeTextExpression AST 노드

ValueExpr     = CompareOp Value
              | FuncOp LPAREN ArgList RPAREN
              | Value

ArgList       = QuotedString ( ',' QuotedString )*    — in() 등 다중 인자 지원

CompareOp     = '!=' | '>=' | '<=' | '>' | '<'
FuncOp        = 'contains' | 'startsWith' | 'endsWith' | 'before' | 'after' | 'in'

Value         = QuotedString | NUMBER | BOOLEAN | UnquotedString
QuotedString  = '"' ( EscapeChar | [^"\\] )* '"'
UnquotedString = [^\s()"]+
Identifier    = [a-zA-Z_][a-zA-Z0-9_.]*    — 필드명 허용 문자 규칙

OR            = 'or' | 'OR' | 'Or'
AND           = 'and' | 'AND' | 'And'
NOT           = 'not' | 'NOT' | 'Not'
BANG          = '!'                          — NOT의 축약형 (!=와 구별: colon 뒤가 아닌 위치)
```

---

## 3. Token Types

```typescript
enum TokenType {
  // === Literals ===
  FIELD         = 'FIELD',         // identifier: country, level, message, ...
  STRING        = 'STRING',        // "quoted string" or unquoted word
  NUMBER        = 'NUMBER',        // 100, 3.14, -50
  BOOLEAN       = 'BOOLEAN',       // true, false

  // === Structural ===
  COLON         = 'COLON',         // :
  LPAREN        = 'LPAREN',        // (
  RPAREN        = 'RPAREN',        // )

  // === Comparison Operators (after colon) ===
  NE            = 'NE',            // !=
  GT            = 'GT',            // >
  GTE           = 'GTE',           // >=
  LT            = 'LT',           // <
  LTE           = 'LTE',          // <=

  // === Function Operators (identifiers after colon) ===
  CONTAINS      = 'CONTAINS',      // contains
  STARTS_WITH   = 'STARTS_WITH',   // startsWith
  ENDS_WITH     = 'ENDS_WITH',     // endsWith
  BEFORE        = 'BEFORE',        // before
  AFTER         = 'AFTER',         // after
  IN            = 'IN',            // in (다중 값 검색)

  // === Logical Operators ===
  AND           = 'AND',
  OR            = 'OR',
  NOT           = 'NOT',           // not (keyword)
  BANG          = 'BANG',          // ! (NOT의 축약형, != 와 구분)

  // === Special ===
  COMMA         = 'COMMA',         // , (함수 인자 구분)
  EOF           = 'EOF',
  ERROR         = 'ERROR',
}
```

### 3.1 Token Interface

```typescript
interface Token {
  type: TokenType;
  value: string;
  start: number;      // 0-indexed byte offset (inclusive)
  end: number;         // 0-indexed byte offset (exclusive)
}
```

모든 토큰은 반드시 `start`/`end` 위치 정보를 포함해야 한다. 이 정보는 CursorContextResolver와 자동완성 Replace에서 핵심적으로 사용된다.

---

## 4. AST (Abstract Syntax Tree)

### 4.1 Node Types

```typescript
interface FilterExpression {
  type: 'FilterExpression';
  field: string;
  operator: string;     // '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'startsWith' | 'endsWith' | 'before' | 'after' | 'in'
  value: string | number | boolean;
  /** IN 연산자의 경우 다중 값 */
  values?: (string | number | boolean)[];
  start: number;
  end: number;
}

/**
 * 필드 없이 단독 입력된 텍스트.
 * Parser 단계에서 FreeTextExpression AST 노드로 생성된다.
 * Serializer 단계에서 message:contains("...") 로 변환된다.
 * 
 * 이유: Parser는 DSL 문법을 구조화만 할 뿐, 의미 해석(어떤 필드에 매핑할지)은
 * Serializer의 책임이다. Parser가 직접 FilterExpression으로 변환하면
 * AST에서 사용자의 원래 의도(free text 입력)를 구분할 수 없다.
 */
interface FreeTextExpression {
  type: 'FreeTextExpression';
  value: string;
  quoted: boolean;
  start: number;
  end: number;
}

interface BinaryExpression {
  type: 'BinaryExpression';
  operator: 'and' | 'or';
  left: Expression;
  right: Expression;
  start: number;
  end: number;
}

interface NotExpression {
  type: 'NotExpression';
  expression: Expression;
  /** ! 사용 여부 (not 대신) */
  usedBang: boolean;
  start: number;
  end: number;
}

interface GroupExpression {
  type: 'GroupExpression';
  expression: Expression;
  start: number;
  end: number;
}

interface PartialExpression {
  type: 'PartialExpression';
  field?: string;
  operator?: string;
  raw: string;
  start: number;
  end: number;
}

type Expression =
  | FilterExpression
  | FreeTextExpression
  | BinaryExpression
  | NotExpression
  | GroupExpression
  | PartialExpression;
```

### 4.2 ParseResult

```typescript
interface ParseError {
  message: string;
  start: number;
  end: number;
}

interface ParseResult {
  ast: Expression | null;
  tokens: Token[];
  errors: ParseError[];
}
```

### 4.3 부분 파싱 (Partial Parsing)

파싱 실패 시에도 최대한 AST를 반환해야 한다. 미완성 부분은 `PartialExpression` 노드로 표현한다.

| Input | AST |
|---|---|
| `country:KR` | `FilterExpression(country, =, KR)` |
| `country:KR and` | `BinaryExpression(and, FilterExpression(country, =, KR), PartialExpression)` |
| `country:` | `PartialExpression(field=country)` |
| `message:contains(` | `PartialExpression(field=message, operator=contains)` |
| `(country:KR` | `PartialExpression(raw="(country:KR")` |

---

## 5. Field Metadata

### 5.1 QueryField Interface

```typescript
interface QueryField {
  key: string;                    // DB column name or identifier
  label: string;                  // Display label (i18n key)
  type: 'string' | 'number' | 'boolean' | 'datetime';
  searchable: boolean;
  operators: QueryOperator[];
  autocompleteProvider?: string;  // Provider ID for value suggestions
  category: FieldCategory;       // For grouping in dropdown
  description: string;           // i18n key for field description
  staticValues?: string[];       // 정적 자동완성 값 (예: status → ['resolved', 'unresolved', ...])
}

type QueryOperator =
  | '='  | '!='
  | '>'  | '>=' | '<' | '<='
  | 'contains' | 'startsWith' | 'endsWith'
  | 'before' | 'after';

type FieldCategory = 'log' | 'resource' | 'trace' | 'event' | 'user' | 'custom';
```

### 5.2 Field-Operator Compatibility Matrix

| Type | Operators |
|------|-----------|
| **string** | `=`, `!=`, `contains`, `startsWith`, `endsWith` |
| **number** | `=`, `!=`, `>`, `>=`, `<`, `<=` |
| **boolean** | `=`, `!=` |
| **datetime** | `=`, `!=`, `before`, `after` |

### 5.3 All Fields Registry (전체 필드 등록소)

```typescript
// 모든 사용 가능한 필드를 정의하는 마스터 레지스트리
const ALL_QUERY_FIELDS: QueryField[] = [
  // ── Log fields ──
  { key: 'level',        label: 'dsl.field.level',        type: 'string',   category: 'log',      operators: ['=', '!='], searchable: true, description: 'dsl.field.level.desc', staticValues: ['debug', 'info', 'warning', 'error', 'fatal'] },
  { key: 'message',      label: 'dsl.field.message',      type: 'string',   category: 'log',      operators: ['=', '!=', 'contains', 'startsWith', 'endsWith'], searchable: true, description: 'dsl.field.message.desc' },
  { key: 'body',         label: 'dsl.field.body',         type: 'string',   category: 'log',      operators: ['=', '!=', 'contains', 'startsWith', 'endsWith'], searchable: true, description: 'dsl.field.body.desc' },
  { key: 'logger_name',  label: 'dsl.field.loggerName',   type: 'string',   category: 'log',      operators: ['=', '!='], searchable: true, description: 'dsl.field.loggerName.desc' },
  { key: 'timestamp',    label: 'dsl.field.timestamp',    type: 'datetime', category: 'log',      operators: ['=', '!=', 'before', 'after'], searchable: false, description: 'dsl.field.timestamp.desc' },

  // ── Resource fields ──
  { key: 'service',      label: 'dsl.field.service',      type: 'string',   category: 'resource', operators: ['=', '!='], searchable: true, description: 'dsl.field.service.desc' },
  { key: 'environment',  label: 'dsl.field.environment',  type: 'string',   category: 'resource', operators: ['=', '!='], searchable: true, description: 'dsl.field.environment.desc' },
  { key: 'release',      label: 'dsl.field.release',      type: 'string',   category: 'resource', operators: ['=', '!='], searchable: true, description: 'dsl.field.release.desc' },

  // ── Trace fields ──
  { key: 'trace_id',     label: 'dsl.field.traceId',      type: 'string',   category: 'trace',    operators: ['=', '!='], searchable: true, description: 'dsl.field.traceId.desc' },
  { key: 'span_id',      label: 'dsl.field.spanId',       type: 'string',   category: 'trace',    operators: ['=', '!='], searchable: true, description: 'dsl.field.spanId.desc' },
  { key: 'log_id',       label: 'dsl.field.logId',        type: 'string',   category: 'trace',    operators: ['=', '!='], searchable: true, description: 'dsl.field.logId.desc' },
  { key: 'issue_id',     label: 'dsl.field.issueId',      type: 'number',   category: 'trace',    operators: ['=', '!=', '>', '>=', '<', '<='], searchable: true, description: 'dsl.field.issueId.desc' },

  // ── Event/Issue fields ──
  { key: 'type',         label: 'dsl.field.type',         type: 'string',   category: 'event',    operators: ['=', '!='], searchable: true, description: 'dsl.field.type.desc' },
  { key: 'value',        label: 'dsl.field.value',        type: 'string',   category: 'event',    operators: ['=', '!=', 'contains', 'startsWith', 'endsWith'], searchable: true, description: 'dsl.field.value.desc' },
  { key: 'handled',      label: 'dsl.field.handled',      type: 'boolean',  category: 'event',    operators: ['=', '!='], searchable: false, description: 'dsl.field.handled.desc' },
  { key: 'platform',     label: 'dsl.field.platform',     type: 'string',   category: 'event',    operators: ['=', '!='], searchable: true, description: 'dsl.field.platform.desc' },
  { key: 'status',       label: 'dsl.field.status',       type: 'string',   category: 'event',    operators: ['=', '!='], searchable: true, description: 'dsl.field.status.desc' },
  { key: 'assigned',     label: 'dsl.field.assigned',     type: 'string',   category: 'event',    operators: ['=', '!='], searchable: true, description: 'dsl.field.assigned.desc', staticValues: ['me', 'none', 'my_teams'] },

  // ── User fields ──
  { key: 'browser_name', label: 'dsl.field.browserName',  type: 'string',   category: 'user',     operators: ['=', '!='], searchable: true, description: 'dsl.field.browserName.desc' },
  { key: 'os_name',      label: 'dsl.field.osName',       type: 'string',   category: 'user',     operators: ['=', '!='], searchable: true, description: 'dsl.field.osName.desc' },
  { key: 'device',       label: 'dsl.field.device',       type: 'string',   category: 'user',     operators: ['=', '!='], searchable: true, description: 'dsl.field.device.desc' },

  // ── Performance fields ──
  { key: 'transaction',  label: 'dsl.field.transaction',  type: 'string',   category: 'event',    operators: ['=', '!=', 'contains'], searchable: true, description: 'dsl.field.transaction.desc' },
  { key: 'duration',     label: 'dsl.field.duration',     type: 'number',   category: 'event',    operators: ['=', '!=', '>', '>=', '<', '<='], searchable: false, description: 'dsl.field.duration.desc' },

  // ── Feedback fields ──
  { key: 'contact_email', label: 'dsl.field.contactEmail', type: 'string',  category: 'user',     operators: ['=', '!=', 'contains'], searchable: true, description: 'dsl.field.contactEmail.desc' },
  { key: 'feedback',     label: 'dsl.field.feedback',     type: 'string',   category: 'event',    operators: ['=', '!=', 'contains'], searchable: true, description: 'dsl.field.feedback.desc' },
];
```

### 5.4 DomainConfig (도메인별 설정)

각 페이지(로그, 이슈, 퍼포먼스, 디스커버 등)는 **서로 다른 필드 목록**을 사용한다. DSL 엔진은 동일하되, 자동완성에서 노출하는 필드가 달라진다.

공용 컴포넌트는 도메인 지식을 **내부에 보유하지 않으며**, 각 페이지가 `DomainConfig` 객체를 조립하여 주입한다.

```typescript
interface DomainConfig {
  /** 도메인 이름 (로깅/디버깅용) */
  name: string;
  /** 이 도메인에서 사용 가능한 필드 목록 */
  fields: QueryField[];
  /** 필드 별칭 (severity → level 등) */
  aliases?: Record<string, string>;
  /** 패싯 endpoint (lazy loading용) */
  facetsEndpoint?: string;
  /** free text 기본 매핑 필드 (기본: 'message') */
  freeTextField?: string;
}
```

#### 도메인별 Config 정의

각 페이지에서 config를 정의하여 `QueryDSLEditor`에 전달한다.

```typescript
// ── Logs Config ──
const LOGS_CONFIG: DomainConfig = {
  name: 'logs',
  fields: pickFields(['level', 'message', 'body', 'logger_name', 'timestamp',
    'service', 'environment', 'release',
    'trace_id', 'span_id', 'log_id', 'issue_id']),
  aliases: { severity: 'level', logger: 'logger_name' },
  facetsEndpoint: '/logs/facets',
};

// ── Issues Config ──
// Issues 도메인은 status, assigned 필드를 포함하며 staticValues로 정적 자동완성을 제공한다.
const ISSUES_CONFIG: DomainConfig = {
  name: 'issues',
  fields: pickFields(['type', 'value', 'message', 'handled', 'platform',
    'level', 'environment', 'release', 'service',
    'browser_name', 'os_name', 'device',
    'timestamp', 'trace_id', 'issue_id',
    'status', 'assigned'],
    // 도메인별 staticValues 오버라이드
    {
      status: { staticValues: ['resolved', 'unresolved', 'ignored', 'archived', 'regressed', 'escalating'] },
    }),
  aliases: { severity: 'level' },
  facetsEndpoint: '/issues/facets',
};

// ── Discover Config ──
const DISCOVER_CONFIG: DomainConfig = {
  name: 'discover',
  fields: ALL_QUERY_FIELDS,  // 모든 필드 접근 가능 (파워유저용)
  aliases: { severity: 'level', logger: 'logger_name' },
  facetsEndpoint: '/discover/facets',
};

// ── Feedback Config ──
// Feedback 도메인은 free text 기본 필드가 'feedback'이다.
const FEEDBACK_CONFIG: DomainConfig = {
  name: 'feedback',
  fields: pickFields(['feedback', 'contact_email',
    'environment', 'release', 'service',
    'browser_name', 'os_name', 'device', 'level',
    'timestamp', 'status', 'assigned'],
    {
      status: { staticValues: ['resolved', 'unresolved', 'spam'] },
    }),
  facetsEndpoint: '/feedback/facets',
  freeTextField: 'feedback',  // free text → feedback:contains("...")로 변환
};

// ── Performance Config ──
const PERFORMANCE_CONFIG: DomainConfig = {
  name: 'performance',
  fields: pickFields(['transaction', 'duration', 'status',
    'service', 'environment', 'release',
    'browser_name', 'os_name',
    'timestamp', 'trace_id', 'span_id'],
    {
      status: { staticValues: ['ok', 'cancelled', 'unknown', 'invalid_argument'] },
    }),
  facetsEndpoint: '/performance/facets',
};

// ── Sessions Config ──
const SESSIONS_CONFIG: DomainConfig = {
  name: 'sessions',
  fields: pickFields(['environment', 'release', 'service',
    'browser_name', 'os_name', 'device',
    'duration', 'timestamp']),
  facetsEndpoint: '/sessions/facets',
};
```

#### Config 사용 예시

```typescript
// 로그 페이지
<QueryDSLEditor config={LOGS_CONFIG} onSearch={handleSearch} />

// 이슈 페이지
<QueryDSLEditor config={ISSUES_CONFIG} onSearch={handleSearch} />

// 디스커버 (모든 필드)
<QueryDSLEditor config={DISCOVER_CONFIG} onSearch={handleSearch} />

// 피드백 (freeText → feedback 필드)
<QueryDSLEditor config={FEEDBACK_CONFIG} onSearch={handleSearch} />
```

#### DomainConfig가 영향을 미치는 것

| 영향 받는 기능 | 동작 |
|---|---|
| **자동완성 필드 추천** | config.fields에 포함된 필드만 추천 |
| **정적 값 자동완성** | field.staticValues가 있으면 값 추천에 사용 (fetchFieldValues보다 우선) |
| **Validator** | config.fields에 없는 필드 → `UNKNOWN_FIELD` 경고 |
| **Facet Provider** | config.facetsEndpoint 사용 |
| **Field Aliases** | config.aliases 적용 |
| **Free Text 필드** | config.freeTextField로 매핑 (기본: 'message') |

#### DomainConfig가 영향을 미치지 않는 것 (= DSL 엔진 자체는 불변)

| 불변 기능 | 이유 |
|---|---|
| **Lexer** | 토큰화는 필드 목록과 무관 |
| **Parser** | AST 생성은 필드 목록과 무관 |
| **Serializer** | 백엔드 포맷 변환은 필드 목록과 무관 |
| **Formatter** | 포맷팅은 필드 목록과 무관 |

### 5.5 Field Aliases

```typescript
// Preset별로 다를 수 있음 (5.4 참조)
const DEFAULT_FIELD_ALIASES: Record<string, string> = {
  severity: 'level',
  logger: 'logger_name',
};
```

---

## 6. Lexer

### 6.1 Design Rules

- **문자 단위 스캔** (character-by-character) — 정규식 금지
- 모든 토큰에 `start`/`end` 위치 포함
- 키워드 판별은 **case-insensitive** (`and`, `AND`, `And` 모두 동일)
- 미완성 따옴표도 STRING 토큰으로 처리 (에러가 아님)
- escape sequence 지원: `\"` inside quoted strings
- **colon 뒤 공백 허용**: `country: KR` → `country:KR`로 처리 (공백 무시)
- **Free text**: colon 없이 단독 입력된 단어 → FreeText 토큰으로 처리

### 6.2 Identifier (필드명) Lexical Rules

필드명으로 인식되는 문자열의 허용 범위:

```
Identifier = [a-zA-Z_][a-zA-Z0-9_.]*
```

| 규칙 | 설명 | 예시 |
|------|------|------|
| 시작 문자 | 영문 대소문자 또는 `_` | `level`, `_custom` |
| 후속 문자 | 영문, 숫자, `_`, `.` | `logger_name`, `event.type` |
| 금지 문자 | 공백, 특수문자 (`!@#$%^&*` 등) | ❌ `my field`, ❌ `field@name` |
| 길이 | 1자 이상, 64자 이하 | — |

**특수한 경우:**
- 필드명이 논리 키워드(`and`, `or`, `not`)와 동일한 경우: **colon이 따라오면 FIELD**, 아니면 논리 키워드
- 필드명이 boolean 값(`true`, `false`)과 동일한 경우: 동일 규칙 적용

```
and:value   →  FIELD("and"), COLON, STRING("value")   — colon이 따라오므로 FIELD
and level:1 →  AND, FIELD("level"), COLON, ...          — colon이 없으므로 AND
```

### 6.3 Tokenization Rules

| Input | Token(s) |
|---|---|
| `country` | `FIELD("country")` |
| `:` | `COLON` |
| `KR` | `STRING("KR")` |
| `"timeout"` | `STRING("timeout")` |
| `"network` (미완성) | `STRING("network")` |
| `100` | `NUMBER(100)` |
| `-50` | `NUMBER(-50)` |
| `3.14` | `NUMBER(3.14)` |
| `true` | `BOOLEAN(true)` |
| `!=` | `NE` |
| `>=` | `GTE` |
| `>` | `GT` |
| `contains` | `CONTAINS` (colon 뒤에서만) |
| `startsWith` | `STARTS_WITH` (colon 뒤에서만) |
| `in` | `IN` (colon 뒤에서만) |
| `and` | `AND` |
| `or` | `OR` |
| `not` | `NOT` |
| `!` | `BANG` (colon 뒤 아닌 위치) |
| `(` | `LPAREN` |
| `)` | `RPAREN` |
| `,` | `COMMA` (함수 인자 구분) |
| `now-1h` | `STRING("now-1h")` (datetime 값) |
| `-7d` | `STRING("-7d")` (상대 시간 축약형) |

### 6.4 Context-Sensitive Lexing

`contains`, `startsWith`, `endsWith`, `before`, `after`, `in`은 **colon 직후**에 나타날 때만 함수형 연산자로 인식한다. 그 외 위치에서는 일반 FIELD 또는 STRING으로 취급한다.

```
message:contains("timeout")
         ^^^^^^^^ → CONTAINS token

country:in("KR", "JP")
         ^^ → IN token

contains:value
^^^^^^^^ → FIELD token (field named "contains")
```

마찬가지로 `before`/`after`는 colon 직후에서만 연산자이다.

---

## 7. Parser

### 7.1 재귀 하강 파서 (Recursive Descent Parser)

```
parseExpression()  →  parseOrExpr()
parseOrExpr()      →  parseAndExpr() ( 'or' parseAndExpr() )*
parseAndExpr()     →  parseUnaryExpr() ( 'and' parseUnaryExpr() )*
parseUnaryExpr()   →  ('not' | '!') parseUnaryExpr() | parsePrimary()
parsePrimary()     →  '(' parseExpression() ')' | parseFilter()

parseFilter()      →  FIELD ':' parseValueExpr()
parseValueExpr()   →  CompareOp Value
                   |  FuncOp '(' QuotedString ')'
                   |  Value
```

### 7.2 연산자 우선순위

1. `not` (highest)
2. `and`
3. `or` (lowest)

파서 구조로 자연스럽게 보장됨 (or → and → unary 순서로 중첩).

### 7.3 Error Recovery

- 예상치 못한 토큰을 만나면 `PartialExpression` 생성
- 가능한 한 많은 정상 노드 반환
- `errors` 배열에 에러 수집

---

## 8. Editor FSM (Finite State Machine)

### 8.1 States

```typescript
enum EditorState {
  EXPECT_FIELD,               // 필드 이름 입력 대기
  EXPECT_COLON,               // ':' 입력 대기
  EXPECT_OPERATOR_OR_VALUE,   // 연산자 또는 값 입력 대기 (colon 직후)
  EXPECT_VALUE,               // 값 입력 대기 (연산자 입력 후)
  EXPECT_LOGICAL_OPERATOR,    // and/or 입력 대기 (조건 완료 후)
  IN_QUOTED_STRING,           // 따옴표 내부
  IN_PARENTHESIS,             // 괄호 내부 (재귀적으로 EXPECT_FIELD로 전이)
}
```

### 8.2 State Transitions

```
[초기]
  → EXPECT_FIELD

[EXPECT_FIELD]
  FIELD 입력 → EXPECT_COLON
  LPAREN '(' → IN_PARENTHESIS (→ EXPECT_FIELD)
  NOT 입력   → EXPECT_FIELD
  BANG '!'   → EXPECT_FIELD     — not과 동일 동작

[EXPECT_COLON]
  COLON ':' → EXPECT_OPERATOR_OR_VALUE

[EXPECT_OPERATOR_OR_VALUE]
  CompareOp (>, >=, <, <=, !=) → EXPECT_VALUE
  FuncOp (contains, startsWith, ...) → EXPECT_VALUE (LPAREN 대기)
  Quote '"'                    → IN_QUOTED_STRING
  Value (unquoted)             → EXPECT_LOGICAL_OPERATOR
  Number                       → EXPECT_LOGICAL_OPERATOR
  Boolean                      → EXPECT_LOGICAL_OPERATOR

[EXPECT_VALUE]
  Value 입력 → EXPECT_LOGICAL_OPERATOR
  Quote '"'  → IN_QUOTED_STRING

[IN_QUOTED_STRING]
  닫는 따옴표 → EXPECT_LOGICAL_OPERATOR (또는 RPAREN 대기)

[EXPECT_LOGICAL_OPERATOR]
  AND → EXPECT_FIELD
  OR  → EXPECT_FIELD
  EOF → 완료

[IN_PARENTHESIS]
  RPAREN ')' → EXPECT_LOGICAL_OPERATOR
  (내부는 EXPECT_FIELD부터 재귀)
```

### 8.3 FSM 사용 목적

- AST만으로는 **현재 입력 중인 상태**를 정확히 알 수 없음
- FSM은 토큰 시퀀스를 순회하며 현재 커서 위치의 **편집 상태**를 결정
- SuggestionEngine은 이 상태를 기반으로 추천 필터링

---

## 9. CursorContextResolver

### 9.1 Purpose

**가장 중요한 컴포넌트**. 커서 위치(caret position)를 기반으로 사용자가 현재 무엇을 입력 중인지 분석한다.

### 9.2 Interface

```typescript
interface CursorContext {
  type: 'FIELD' | 'OPERATOR' | 'VALUE' | 'LOGICAL_OPERATOR';
  field?: string;         // 현재 필터의 필드명 (OPERATOR, VALUE 상태에서)
  operator?: string;      // 현재 필터의 연산자 (VALUE 상태에서)
  prefix: string;         // 현재까지 입력한 부분 문자열
  tokenStart: number;     // 현재 토큰의 시작 위치
  tokenEnd: number;       // 현재 토큰의 끝 위치 (= cursor 위치)
  editorState: EditorState;
  inQuotedString: boolean;
  inParenthesis: boolean;
}
```

### 9.3 Resolution Examples

| Input (`|` = cursor) | type | field | operator | prefix |
|---|---|---|---|---|
| `\|` | FIELD | — | — | `` |
| `cou\|` | FIELD | — | — | `cou` |
| `country\|` | FIELD | — | — | `country` |
| `country:\|` | OPERATOR | `country` | — | `` |
| `country:K\|` | VALUE | `country` | `=` | `K` |
| `country:KR\|` | VALUE | `country` | `=` | `KR` |
| `country:!=\|` | VALUE | `country` | `!=` | `` |
| `country:!=C\|` | VALUE | `country` | `!=` | `C` |
| `level:>\|` | VALUE | `level` | `>` | `` |
| `level:>10\|` | VALUE | `level` | `>` | `10` |
| `message:cont\|` | OPERATOR | `message` | — | `cont` |
| `message:contains(\|` | VALUE | `message` | `contains` | `` |
| `message:contains("\|` | VALUE | `message` | `contains` | `` |
| `message:contains("net\|` | VALUE | `message` | `contains` | `net` |
| `message:"\|` | VALUE | `message` | `=` | `` |
| `message:"net\|` | VALUE | `message` | `=` | `net` |
| `country:KR \|` | LOGICAL_OPERATOR | — | — | `` |
| `country:KR a\|` | LOGICAL_OPERATOR | — | — | `a` |
| `country:KR and \|` | FIELD | — | — | `` |
| `country:KR and le\|` | FIELD | — | — | `le` |
| `(\|` | FIELD | — | — | `` |

### 9.4 tokenStart / tokenEnd

CursorContextResolver는 반드시 **현재 편집 중인 토큰의 범위**를 반환해야 한다. 이 범위는 자동완성 Replace에서 사용된다.

```
Input:  country:KOREA|
                ^^^^^
tokenStart = 8 (K의 위치)
tokenEnd   = 13 (커서 위치)

"KR" 선택 시:
→ replace(8, 13, "KR")
→ 결과: country:KR
```

---

## 10. Autocomplete Rules

### 10.1 자동완성 선택 시 Replace (Insert 금지)

자동완성은 항상 **replace**를 수행한다. 절대 insert하지 않는다.

```
cou|  → "country" 선택 → country
(tokenStart=0, tokenEnd=3을 "country"로 replace)

country:K|  → "KR" 선택 → country:KR
(tokenStart=8, tokenEnd=9를 "KR"로 replace)

message:cont|  → "contains" 선택 → message:contains("|")
(tokenStart=8, tokenEnd=12를 "contains(\"" 로 replace, 커서 위치 조정)

message:contains("tim|  → "timeout" 선택 → message:contains("timeout")
(tokenStart=19, tokenEnd=22를 "timeout\")" 로 replace)
```

### 10.2 Logical Operator 노출 규칙

`and`, `or`는 **EXPECT_LOGICAL_OPERATOR 상태에서만** 추천한다.

| 상태 | and/or 추천 |
|---|---|
| `\|` | ❌ |
| `cou\|` | ❌ |
| `country:\|` | ❌ |
| `country:K\|` | ❌ |
| `message:"net\|` | ❌ |
| `country:KR \|` | ✅ |
| `(country:KR or country:JP) \|` | ✅ |

`not`은 **문장 시작** 또는 **and/or 뒤**에서만 추천한다.

### 10.3 IN_QUOTED_STRING 상태 추천 규칙

따옴표 내부에서는:
- ❌ 필드 추천
- ❌ 연산자 추천
- ❌ and/or/not 추천
- ✅ 문자열 값 추천만 허용

### 10.4 자동 따옴표/괄호 생성

**문자열 타입 필드에서 직접 값 입력 시:**

```
message:  (사용자가 colon 입력)
→ 자동 생성: message:"|"
→ 커서는 따옴표 내부
```

**함수형 연산자 선택 시:**

```
message:cont|  → "contains" 선택
→ 자동 생성: message:contains("|")
→ 커서는 괄호+따옴표 내부
```

### 10.5 자동 닫기

```
message:"abc  (닫는 따옴표 없이 다음 토큰 또는 Enter)
→ message:"abc"  (자동 닫기)
```

### 10.6 자동완성을 통한 문법 오류 예방 (Proactive Error Prevention)

자동완성의 가장 중요한 역할은 **사용자가 문법 오류를 만들지 않도록 유도**하는 것이다. 디테일의 차이가 완성도를 결정한다.

#### Rule 1: 상태에 맞는 추천만 제공

현재 FSM 상태에 적합한 항목만 추천한다. 잘못된 추천은 절대 노출하지 않는다.

| FSM State | 추천하는 것 | 절대 추천하지 않는 것 |
|---|---|---|
| `EXPECT_FIELD` | 필드 이름, `not`, `(` | 연산자, 값, `and`, `or` |
| `EXPECT_COLON` | (자동으로 colon 삽입) | 필드, 값, 연산자 |
| `EXPECT_OPERATOR_OR_VALUE` | 해당 필드의 연산자, 값 | 다른 필드, `and`/`or` |
| `EXPECT_VALUE` | 해당 필드/연산자의 값 | 필드, 연산자, `and`/`or` |
| `IN_QUOTED_STRING` | 문자열 값만 | 필드, 연산자, 논리 연산자 |
| `EXPECT_LOGICAL_OPERATOR` | `and`, `or` | 연산자, 값 |

#### Rule 2: 필드 선택 시 자동 colon 삽입

필드를 자동완성으로 선택하면 **자동으로 colon을 삽입**하여 사용자가 `country` 만 입력하고 멈추는 상황을 방지한다.

```
cou|  → "country" 선택 → country:|  (colon 자동 삽입)
```

#### Rule 3: 연산자 선택 시 자동 구조 완성

함수형 연산자 선택 시 **괄호와 따옴표를 자동 생성**하여 구조적 오류를 방지한다.

```
message:|  → "contains" 선택 → message:contains("|")
                                             ^ 커서
```

비교 연산자 선택 시에도 **커서를 적절한 위치에 배치**한다.

```
level:|  → ">" 선택 → level:>|  (커서는 > 뒤)
```

#### Rule 4: 값 선택 시 자동 닫기

따옴표 또는 괄호 내부에서 값을 선택하면 **자동으로 닫는 따옴표/괄호를 삽입**한다.

```
message:contains("net|  → "network error" 선택 → message:contains("network error")
                                                                              ^^ 자동 닫기
```

#### Rule 5: 논리 연산자 선택 시 자동 공백 + 필드 추천

`and`/`or` 선택 후 **자동으로 뒤에 공백을 삽입**하고, 즉시 필드 추천 드롭다운을 표시한다.

```
country:KR |  → "and" 선택 → country:KR and |  → 즉시 필드 추천 표시
```

이렇게 하면 `country:KR and` 상태에서 사용자가 멈추는 것을 방지한다.

#### Rule 6: 잘못된 타이핑 시 가까운 올바른 옵션 제안

사용자가 현재 상태에서 올바르지 않은 것을 타이핑하면, **가장 가까운 올바른 옵션**을 추천한다.

```
country:KR an|  → 현재 상태: LOGICAL_OPERATOR
                → "and" 추천 (prefix "an" 매칭)
                → 사용자가 실수로 "an" 까지만 타이핑해도 올바른 추천 표시

level: cont|    → 현재 상태: EXPECT_OPERATOR_OR_VALUE
                → level은 number 타입이므로 contains 미추천
                → 대신 비교 연산자 (>, >=, <, <=) 추천
```

#### Rule 7: Enter 직전 자동 수정 (Auto-Fix)

Enter를 눌렀을 때 자동으로 수정 가능한 오류는 **수정 후 실행**한다.

| 입력 | 자동 수정 | 동작 |
|---|---|---|
| `message:"hello` | `message:"hello"` | 닫는 따옴표 자동 삽입 후 실행 |
| `message:contains("hello"` | `message:contains("hello")` | 닫는 괄호 자동 삽입 후 실행 |
| `country:KR and` | — | ❌ 자동 수정 불가, 실행 차단 |
| `country:KR or` | — | ❌ 자동 수정 불가, 실행 차단 |

---

## 11. Suggestion Engine

### 11.1 Context별 추천

| CursorContext.type | 추천 내용 |
|---|---|
| `FIELD` | 필드 목록 (prefix 매칭, 카테고리별 그룹핑) |
| `OPERATOR` | 현재 필드가 허용하는 연산자만 (필드 메타데이터 기반) |
| `VALUE` | **staticValues 우선** → facet 값 → 타입별 기본값 (boolean → true/false, number → 없음, datetime → 프리셋) |
| `LOGICAL_OPERATOR` | `and`, `or` (조건 충족 시만) |

#### 11.1.1 staticValues 기반 값 추천

필드에 `staticValues`가 정의되어 있으면, **fetchFieldValues (동적 로딩)보다 우선**하여 정적 값을 추천한다. 두 소스의 결과는 병합되며, 중복은 제거한다.

```typescript
// 값 추천 우선순위:
// 1. field.staticValues (정적, 즉시 제공)
// 2. fetchFieldValues (동적, 네트워크 요청)
// 3. 타입별 기본값 (boolean → true/false)
//
// 예: status 필드 (staticValues: ['resolved', 'unresolved', ...])
//   → 사용자가 "status:" 입력 시 즉시 정적 값 추천 표시
//   → fetchFieldValues 응답이 도착하면 병합
```

### 11.1.2 추천 개수 제한

추천 목록은 **최대 20개**까지만 표시한다. 너무 많으면 사용자가 선택하기 어렵다.

```typescript
const DEFAULT_MAX_SUGGESTIONS = 20;

function getSuggestions(
  context: CursorContext,
  config: DomainConfig,
  options?: { maxSuggestions?: number }
): SuggestionItem[] {
  const max = options?.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;
  const allItems = buildSuggestions(context, config);
  
  // 정렬: prefix 매칭 우선, 사용 빈도 순
  const sorted = sortByRelevance(allItems, context.prefix);
  
  return sorted.slice(0, max);
}
```

| 설정 | 기본값 | 변경 방법 |
|------|--------|-----------|
| `maxSuggestions` | `20` | `<QueryDSLEditor maxSuggestions={30} />` |

### 11.2 Operator 추천 상세

```
country (string, operators: [=, !=])
→ 추천: =, !=

message (string, operators: [=, !=, contains, startsWith, endsWith])
→ 추천: contains, startsWith, endsWith, =, !=

level (number, operators: [=, !=, >, >=, <, <=])
→ 추천: >, >=, <, <=, =, !=

createdAt (datetime, operators: [=, !=, before, after])
→ 추천: before, after, =, !=
```

### 11.3 SuggestionProvider Interface

```typescript
interface SuggestionProvider {
  getFieldSuggestions(prefix: string): SuggestionItem[];
  getValueSuggestions(field: string, operator: string, prefix: string): Promise<SuggestionItem[]>;
}

interface SuggestionItem {
  label: string;          // 표시 텍스트
  value: string;          // 실제 삽입 값
  description?: string;   // 설명
  type: 'field' | 'operator' | 'value' | 'logical';
  category?: FieldCategory;
  /** 필드의 도메인 카테고리 (log, resource, trace 등). 탭 그룹핑에 사용 */
  fieldCategory?: string;
  count?: number;         // facet count
  icon?: string;
}
```

### 11.4 Provider 구현체

| Provider | 용도 |
|---|---|
| `MemoryProvider` | 정적 enum 값 (level: error/warning/info 등) |
| `FacetProvider` | 백엔드 facets 데이터 기반 |
| `RemoteProvider` | API 호출 (`GET /api/query/autocomplete`) |
| `CompositeProvider` | 여러 Provider 결과 병합 |

### 11.5 Race Condition 방지

#### 문제 상황 (Why This Matters)

자동완성의 `RemoteProvider`는 사용자가 타이핑할 때마다 API를 호출한다. 네트워크 응답은 **요청 순서와 다른 순서로 도착**할 수 있다. 이것을 처리하지 않으면 **이전 입력의 결과가 현재 입력의 결과를 덮어쓰는** 심각한 UX 버그가 발생한다.

```
시간 →

T1: 사용자 입력 "K"  → Request A 발송 (field=country, prefix=K)
T2: 사용자 입력 "KR" → Request B 발송 (field=country, prefix=KR)

T3: Response B 도착 → ["KR"]           ← 정확한 결과
T4: Response A 도착 → ["KR", "KP", …]  ← ❌ 이전 요청의 결과가 현재를 덮어씀!

결과: 사용자는 "KR"을 입력했는데 "K"에 대한 추천 목록을 보게 됨
```

이 문제는 네트워크 지연이 일정하지 않은 실제 환경에서 **빈번하게** 발생한다.

#### 왜 디바운스만으로는 불충분한가

디바운스(debounce)는 요청 빈도를 줄이지만 **순서 역전 문제를 해결하지 못한다**:

```
디바운스 300ms 적용:

T0:    사용자 입력 "K"  → 디바운스 대기
T100:  사용자 입력 "KR" → 디바운스 대기 (이전 타이머 리셋)
T400:  디바운스 만료    → Request A 발송 (prefix=KR)
T500:  사용자 입력 "KRX" → 디바운스 대기
T800:  디바운스 만료    → Request B 발송 (prefix=KRX)
T1200: Response B 도착 → []
T1500: Response A 도착 → ["KR"] ← ❌ 여전히 순서 역전!
```

디바운스**만**으로는 문제를 근본적으로 해결하지 못한다. 하지만 **서버 부하 방어**에는 효과적이다.

#### 해결: 하이브리드 전략 (Short Debounce + AbortController + Request ID)

**디바운스(100ms)** + **AbortController** + **Request ID** 3중 보호를 사용한다.

| 계층 | 역할 | 필요 이유 |
|------|------|----------|
| **Debounce (100ms)** | 빠른 타이핑 시 불필요한 요청 발생 억제 | 서버 부하 방지, 비용 절감 |
| **AbortController** | 이전 진행 중 요청을 즉시 취소 | 네트워크 자원 해제, 대역폭 절약 |
| **Request ID** | 응답 도착해도 stale이면 무시 | abort 직전에 도착한 응답 방어 (race window) |

```typescript
const REMOTE_DEBOUNCE_MS = 100; // 체감 속도에 영향 없는 최소 디바운스

class RemoteProvider implements SuggestionProvider {
  private currentController: AbortController | null = null;
  private currentRequestId = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async getValueSuggestions(
    field: string,
    operator: string,
    prefix: string
  ): Promise<SuggestionItem[]> {
    // 1. 이전 디바운스 타이머 취소
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 2. 이전 네트워크 요청 abort
    if (this.currentController) {
      this.currentController.abort();
    }

    // 3. 짧은 디바운스 (100ms) — 빠른 타이핑 시 서버 부하 방지
    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        const controller = new AbortController();
        this.currentController = controller;
        const requestId = ++this.currentRequestId;

        try {
          const response = await fetch(
            `/api/query/autocomplete?field=${field}&operator=${operator}&prefix=${prefix}`,
            { signal: controller.signal }
          );
          const data = await response.json();

          // 4. Request ID 확인 — stale response 방어
          if (requestId !== this.currentRequestId) {
            resolve([]); // stale
            return;
          }

          resolve(data.map(toSuggestionItem));
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            resolve([]); // 정상적인 abort
            return;
          }
          resolve([]); // 네트워크 에러 시 빈 결과
        }
      }, REMOTE_DEBOUNCE_MS);
    });
  }
}
```

#### 왜 디바운스 100ms인가?

| 디바운스 값 | 체감 | 서버 부하 |
|-------------|------|----------|
| 0ms | 즉각 반응 | ⚠️ 키 입력마다 요청 (부하 높음) |
| **100ms** | **거의 즉각 반응** | **✅ 빠른 타이핑 시 불필요한 요청 억제** |
| 200ms | 약간의 지연 체감 | 좋음 |
| 300ms+ | 확실한 지연 체감 | 매우 좋음 (하지만 UX 저하) |

100ms는 인간의 타이핑 속도(평균 키 간격 ~50-150ms)를 고려할 때 **체감 지연 없이 불필요한 요청을 충분히 억제**하는 최적 값이다.

#### 로컬 Provider에는 디바운스 불필요

| Provider | 디바운스 | 이유 |
|----------|----------|------|
| `MemoryProvider` | ❌ | 메모리 내 즉시 반환 — 지연 없음 |
| `FacetProvider` | ❌ | 이미 캐시된 데이터에서 필터링 |
| `RemoteProvider` | ✅ 100ms | 네트워크 요청 → 서버 부하 방지 필요 |

### 11.6 Domain-Aware Suggestion Tabs (도메인 기반 추천 탭)

추천 팝오버의 탭은 필드의 `category`(도메인 카테고리) 기반으로 동적 생성된다.
Sentry의 검색 패턴(Recent / All / Logs / Attributes / Logic)을 참고하되, 프로젝트의 필드 분류에 맞게 구현한다.

#### 11.6.1 탭 표시 조건

| 입력 상태 | 탭 표시 | 이유 |
|-----------|---------|------|
| **빈 입력** (포커스 첫 진입) | ✅ 표시 | 필드 탐색/선택 모드 |
| **텍스트 입력 중** (`1111111`) | ❌ 숨김 | 스마트 추천만 flat 표시 |
| **필드:연산자 입력 중** (`level:>`) | ❌ 숨김 | 값 추천만 flat 표시 |

#### 11.6.2 탭 종류 (도메인 카테고리 기반)

```typescript
const FIELD_CAT_TABS: Record<string, { fallback: string }> = {
  log:       { fallback: 'Logs' },
  resource:  { fallback: 'Resource' },
  trace:     { fallback: 'Trace' },
  event:     { fallback: 'Event' },
  user:      { fallback: 'User' },
  attribute: { fallback: 'Attributes' },  // facets에서 온 동적 필드
};
```

| 탭 | 포함 필드 | 표시 조건 |
|----|-----------|----------|
| **Recent** | 최근 검색 히스토리 (localStorage) | 히스토리 존재 시 |
| **All** | 현재 도메인의 모든 필드 | 항상 |
| **Logs** | `category: 'log'` 필드들 (level, message, body 등) | 해당 필드 존재 시 |
| **Resource** | `category: 'resource'` 필드들 (service, environment 등) | 해당 필드 존재 시 |
| **Trace** | `category: 'trace'` 필드들 (trace_id, span_id 등) | 해당 필드 존재 시 |
| **Event** | `category: 'event'` 필드들 (type, value 등) | 해당 필드 존재 시 |
| **Attributes** | facets에서 온 동적 필드 (static registry에 없는 것) | 해당 필드 존재 시 |

도메인별로 사용하는 필드가 다르므로 (Section 5.4), 탭도 도메인에 따라 다르게 표시된다.

```
logs 도메인    → Recent | All | Logs | Resource | Trace
issues 도메인  → Recent | All | Logs | Resource | Trace | Event | User
```

#### 11.6.3 Smart Suggestions (스마트 추천)

사용자가 필드명 없이 자유 텍스트를 입력할 때, Sentry 스타일로 문장형 필터를 제안한다.

```
사용자 입력: 1111111

추천:
• message contains 1111111    → insertText: message:contains("1111111")
• message is 1111111          → insertText: message:"1111111"
```

이 추천은 탭 없이 flat 리스트로 표시된다. 카테고리 헤더도 숨긴다.

#### 11.6.4 칩 모드에서 AND/OR 토글

칩 모드에서 칩과 칩 사이에 join 연산자 라벨(`AND` / `OR`)을 표시한다.
AND는 기본(implicit)이고, OR는 주황색으로 강조 표시한다.
클릭으로 AND ↔ OR 토글이 가능하다.

---

## 12. Validation & Error Handling

### 12.1 Validation Rules

필드 타입과 연산자 타입을 동시에 검증한다.

| Expression | Valid? | Reason |
|---|---|---|
| `message:contains("timeout")` | ✅ | string 필드 + contains |
| `message:>100` | ❌ | string 필드에 > 연산자 |
| `createdAt:after("2025-01-01")` | ✅ | datetime 필드 + after |
| `createdAt:contains("2025")` | ❌ | datetime 필드에 contains |
| `level:before(100)` | ❌ | number 필드에 before |
| `country:>KR` | ❌ | string 필드에 > 연산자 |
| `level:>100` | ✅ | number 필드 + > |
| `status:true` | ✅ | boolean 필드 + = |

### 12.2 Structural Syntax Errors (문법 오류)

AST 파싱 단계에서 **구조적 문법 오류**를 감지한다. 이것은 필드/연산자 호환성(semantic validation)과 별개의 **구문 오류**이다.

| Input | Error Type | Message |
|---|---|---|
| `country:KR and` | `DANGLING_OPERATOR` | 논리 연산자 뒤에 표현식 없음 |
| `country:KR or` | `DANGLING_OPERATOR` | 논리 연산자 뒤에 표현식 없음 |
| `country:KR and or` | `UNEXPECTED_TOKEN` | 연속된 논리 연산자 |
| `and country:KR` | `UNEXPECTED_TOKEN` | 문장 시작에 and/or |
| `country:` | `INCOMPLETE_FILTER` | 값 누락 (입력 중에는 경고, Enter 시 오류) |
| `(country:KR` | `UNCLOSED_PAREN` | 괄호 미닫힘 |
| `message:contains(` | `INCOMPLETE_FUNCTION` | 함수 호출 미완성 |
| `message:"hello` | `UNCLOSED_QUOTE` | 따옴표 미닫힘 |
| `unknownField:value` | `UNKNOWN_FIELD` | 등록되지 않은 필드 (경고) |

#### 입력 중 vs Enter 시 오류 구분

| Error Type | 입력 중 표시 | Enter 시 동작 |
|---|---|---|
| `DANGLING_OPERATOR` | 🔴 빨간 밑줄 | ❌ 쿼리 실행 차단 |
| `UNEXPECTED_TOKEN` | 🔴 빨간 밑줄 | ❌ 쿼리 실행 차단 |
| `INCOMPLETE_FILTER` | ⚠️ 회색 밑줄 (입력 중일 수 있음) | ❌ 쿼리 실행 차단 |
| `UNCLOSED_PAREN` | ⚠️ 회색 밑줄 | ❌ 쿼리 실행 차단 (자동 닫기 시도 후) |
| `UNCLOSED_QUOTE` | ⚠️ 회색 밑줄 | 자동 닫기 후 실행 |
| `UNKNOWN_FIELD` | 🟡 노란 밑줄 | ⚠️ 경고 표시 후 실행 허용 |
| Field-Operator mismatch | 🔴 빨간 밑줄 | ❌ 쿼리 실행 차단 |

### 12.3 Error Display (UI)

#### Red Underline (빨간 밑줄)

문법 오류가 있는 토큰에 **빨간색 wavy underline**을 표시한다.

```html
<div contenteditable>
  <span class="token-field">country</span>
  <span class="token-colon">:</span>
  <span class="token-value">KR</span>
  <span class="token-space"> </span>
  <span class="token-logical token-error">and</span>
  <!--                      ^^^^^^^^^^^
    빨간 밑줄: "and" 뒤에 표현식이 없음
    CSS: text-decoration: wavy underline red;
  -->
</div>
```

```css
.token-error {
  text-decoration: wavy underline;
  text-decoration-color: #f44336;
  text-underline-offset: 3px;
}

.token-warning {
  text-decoration: wavy underline;
  text-decoration-color: #ff9800;
  text-underline-offset: 3px;
}
```

#### Error Tooltip (에러 툴팁)

오류가 있는 토큰에 마우스를 올리거나, 커서가 위치하면 **에러 메시지 tooltip**을 표시한다. 메시지는 **오류 원인 + 수정 예시**를 모두 포함해야 한다.

```html
<!-- 에러 토큰 위에 표시되는 tooltip -->
<div class="dsl-error-tooltip">
  <span class="error-icon">⚠</span>
  <span class="error-message">
    "and" 뒤에 검색 조건이 필요합니다.
  </span>
  <span class="error-hint">
    예: country:KR and level:>100
  </span>
</div>
```

#### Error Badge

에디터 우측에 오류 개수를 표시하는 **badge**를 제공한다.

```
[🔍 country:KR and                              ⚠ 1 error]
```

### 12.4 Error Messages & i18n (에러 메시지 로컬라이징)

**모든 에러 메시지는 반드시 i18n 키를 통해 로컬라이징되어야 한다.** 하드코딩된 문자열 금지.

#### 에러 메시지 카탈로그

| Error Type | i18n Key | 한국어 (ko) | English (en) |
|---|---|---|---|
| `DANGLING_OPERATOR` | `dsl.error.danglingOperator` | `"{{op}}" 뒤에 검색 조건이 필요합니다` | `Expected expression after "{{op}}"` |
| `UNEXPECTED_TOKEN` | `dsl.error.unexpectedToken` | `예상하지 못한 "{{token}}"이(가) 있습니다` | `Unexpected "{{token}}"` |
| `INCOMPLETE_FILTER` | `dsl.error.incompleteFilter` | `"{{field}}" 필드에 값이 필요합니다` | `Field "{{field}}" requires a value` |
| `UNCLOSED_PAREN` | `dsl.error.unclosedParen` | `닫는 괄호 ")"가 필요합니다` | `Missing closing parenthesis ")"` |
| `UNCLOSED_QUOTE` | `dsl.error.unclosedQuote` | `닫는 따옴표가 필요합니다` | `Missing closing quote` |
| `INCOMPLETE_FUNCTION` | `dsl.error.incompleteFunction` | `{{op}}() 함수의 인자가 필요합니다` | `{{op}}() requires an argument` |
| `UNKNOWN_FIELD` | `dsl.error.unknownField` | `"{{field}}"은(는) 알 수 없는 필드입니다` | `Unknown field "{{field}}"` |
| `INVALID_OPERATOR` | `dsl.error.invalidOperator` | `"{{field}}" 필드에 "{{op}}" 연산자를 사용할 수 없습니다` | `Operator "{{op}}" is not valid for field "{{field}}"` |
| `INVALID_VALUE_TYPE` | `dsl.error.invalidValueType` | `"{{field}}" 필드에 {{expected}} 타입의 값이 필요합니다` | `Field "{{field}}" expects a {{expected}} value` |

#### 에러 힌트 (수정 예시) 카탈로그

각 에러 타입에는 사용자가 어떻게 고쳐야 하는지 알려주는 **hint(수정 예시)**도 함께 표시한다.

| Error Type | i18n Key (hint) | 한국어 (ko) | English (en) |
|---|---|---|---|
| `DANGLING_OPERATOR` | `dsl.hint.danglingOperator` | `예: {{example}}` | `e.g. {{example}}` |
| `UNEXPECTED_TOKEN` | `dsl.hint.unexpectedToken` | `이 위치에서는 {{expected}}이(가) 와야 합니다` | `Expected {{expected}} at this position` |
| `INCOMPLETE_FILTER` | `dsl.hint.incompleteFilter` | `예: {{field}}:{{exampleValue}}` | `e.g. {{field}}:{{exampleValue}}` |
| `UNCLOSED_PAREN` | `dsl.hint.unclosedParen` | `표현식 끝에 ")"를 추가하세요` | `Add ")" at the end of the expression` |
| `INCOMPLETE_FUNCTION` | `dsl.hint.incompleteFunction` | `예: {{field}}:{{op}}("값")` | `e.g. {{field}}:{{op}}("value")` |
| `UNKNOWN_FIELD` | `dsl.hint.unknownField` | `사용 가능한 필드: {{availableFields}}` | `Available fields: {{availableFields}}` |
| `INVALID_OPERATOR` | `dsl.hint.invalidOperator` | `"{{field}}"에 사용 가능한 연산자: {{validOps}}` | `Valid operators for "{{field}}": {{validOps}}` |
| `INVALID_VALUE_TYPE` | `dsl.hint.invalidValueType` | `예: {{field}}:{{exampleValue}}` | `e.g. {{field}}:{{exampleValue}}` |

#### 구체적 에러 메시지 표시 예시

```
입력: country:KR and
                 ~~~
  ⚠ "and" 뒤에 검색 조건이 필요합니다
     예: country:KR and level:>100

입력: message:>100
              ~~~~
  ⚠ "message" 필드에 ">" 연산자를 사용할 수 없습니다
     "message"에 사용 가능한 연산자: contains, startsWith, endsWith, =, !=

입력: xyzField:value
      ~~~~~~~~
  ⚠ "xyzField"은(는) 알 수 없는 필드입니다
     사용 가능한 필드: level, message, service, environment, ...

입력: level:before("2025")
           ~~~~~~
  ⚠ "level" 필드에 "before" 연산자를 사용할 수 없습니다
     "level"에 사용 가능한 연산자: >, >=, <, <=, =, !=

입력: and country:KR
      ~~~
  ⚠ 예상하지 못한 "and"이(가) 있습니다
     이 위치에서는 필드 이름이(가) 와야 합니다
```

#### i18n 구현 규칙

```typescript
// ✅ 올바른 구현 — i18n 키 사용
function getErrorMessage(error: ValidationError, t: TFunction): string {
  return t(`dsl.error.${error.type}`, {
    op: error.operator,
    field: error.field,
    token: error.raw,
    expected: getExpectedTypeLabel(error, t),
  });
}

function getErrorHint(error: ValidationError, t: TFunction): string {
  return t(`dsl.hint.${error.type}`, {
    field: error.field,
    op: error.operator,
    example: getExampleForError(error),
    expected: getExpectedAtPosition(error, t),
    exampleValue: getExampleValueForField(error.field),
    validOps: getValidOpsForField(error.field).join(', '),
    availableFields: QUERY_FIELDS.map(f => f.key).slice(0, 5).join(', ') + ', ...',
  });
}

// ❌ 금지 — 하드코딩
function getErrorMessage(error: ValidationError): string {
  return `"${error.field}" 필드에 값이 필요합니다`; // 금지!
}
```

#### Tooltip 렌더링 사양

```typescript
interface ErrorTooltipProps {
  error: ValidationError;
  position: { x: number; y: number };
}

// Tooltip은 에러 토큰 바로 아래에 표시
// 최대 너비: 360px
// 배경: dark mode → #2d2d2d, light mode → #fff
// border: 1px solid error color
// 내용: [icon] [message] + [hint in muted color]
// 에러 토큰에 커서가 있거나 마우스 hover 시 표시
// 300ms 딜레이 후 표시 (깜빡임 방지)
```

### 12.5 Query Execution Blocking (쿼리 실행 차단)

**문법 오류가 감지되면 Enter를 눌러도 쿼리를 실행하지 않는다.**

```typescript
function handleEnter(event: KeyboardEvent) {
  const parseResult = parse(currentInput);
  const validationErrors = validate(parseResult.ast, fields);
  const allErrors = [...parseResult.errors, ...validationErrors];
  
  // severity: 'error' 가 하나라도 있으면 실행 차단
  const hasBlockingErrors = allErrors.some(e => e.severity === 'error');
  
  if (hasBlockingErrors) {
    // 1. 오류 토큰에 빨간 밑줄 강조 (shake animation)
    // 2. 에러 메시지 toast 표시 (로컬라이징된 메시지)
    // 3. onSearch 호출하지 않음
    event.preventDefault();
    showErrorFeedback(allErrors, t); // t = i18n translate function
    return;
  }
  
  // 경고(warning)만 있으면 실행 허용
  onSearch(serializeForBackend(parseResult.ast));
}
```

#### Enter 차단 시 사용자 피드백

1. **Shake animation** — 에러 토큰이 좌우로 살짝 흔들림
2. **Error toast** — 하단에 **로컬라이징된** 에러 메시지 표시 (2초 후 자동 사라짐)
3. **Focus to error** — 첫 번째 에러 토큰으로 커서 이동
4. **Tooltip auto-show** — 에러 토큰 위에 tooltip 자동 표시

### 12.6 ValidationError Interface

```typescript
interface ValidationError {
  type: 
    | 'DANGLING_OPERATOR'     // 끝에 and/or만 있음
    | 'UNEXPECTED_TOKEN'      // 예상치 못한 토큰
    | 'INCOMPLETE_FILTER'     // field: 뒤에 값 없음
    | 'UNCLOSED_PAREN'        // 괄호 미닫힘
    | 'UNCLOSED_QUOTE'        // 따옴표 미닫힘
    | 'INCOMPLETE_FUNCTION'   // contains( 미완성
    | 'UNKNOWN_FIELD'         // 등록되지 않은 필드
    | 'INVALID_OPERATOR'      // 필드에 허용되지 않는 연산자
    | 'INVALID_VALUE_TYPE';   // 값 타입 불일치
  /** i18n message key: `dsl.error.${type}` */
  messageKey: string;
  /** i18n hint key: `dsl.hint.${type}` */
  hintKey: string;
  /** Interpolation params for i18n */
  params: Record<string, string>;
  field?: string;
  operator?: string;
  raw?: string;              // 오류를 일으킨 원본 텍스트
  start: number;             // 오류 토큰의 시작 위치
  end: number;               // 오류 토큰의 끝 위치
  severity: 'error' | 'warning';
}
```

---

## 13. Backend Compatibility

### 13.1 현재 백엔드 쿼리 파서

백엔드 (`packages/argus/src/utils/queryParser.ts`)는 **Sentry-compatible** 포맷을 사용한다:

```
severity:error                          → level = 'error'
!severity:error                         → NOT (level = 'error')
level!=warning                          → level != 'warning'
message.contains:timeout                → message ILIKE '%timeout%'
message.starts_with:Error               → message ILIKE 'Error%'
message.ends_with:.js                   → message ILIKE '%.js'
severity:error AND service:api          → level = 'error' AND service = 'api'
(severity:error OR severity:warn)       → (level = 'error' OR level = 'warn')
```

### 13.2 Frontend DSL → Backend 변환

프론트엔드의 새 DSL 문법을 백엔드가 이해하는 형식으로 **serialize** 해야 한다.

| Frontend DSL | Backend Format |
|---|---|
| `country:KR` | `country:KR` (동일) |
| `country:!=CN` | `country!=CN` 또는 `!country:CN` |
| `level:>100` | `level:>100` (동일) |
| `level:>=100` | `level:>=100` (동일) |
| `message:contains("timeout")` | `message.contains:timeout` |
| `message:startsWith("network")` | `message.starts_with:network` |
| `message:endsWith("error")` | `message.ends_with:error` |
| `createdAt:before("2025-02-01")` | `timestamp<2025-02-01` |
| `createdAt:after("2025-01-01")` | `timestamp>2025-01-01` |
| `A and B` | `A AND B` |
| `A or B` | `A OR B` |
| `not A` | `!A` (negation prefix) |
| `(A or B) and C` | `(A OR B) AND C` |

### 13.3 Serializer 구현

```typescript
function serializeForBackend(ast: Expression): string {
  // AST를 백엔드 호환 문자열로 변환
  // FilterExpression → Sentry format
  // BinaryExpression → AND/OR
  // NotExpression → ! prefix
}
```

### 13.4 Backend Allowed Columns

```typescript
const LOGS_ALLOWED_COLUMNS = [
  'log_id', 'trace_id', 'span_id', 'issue_id',
  'timestamp', 'level', 'logger_name',
  'message', 'body',
  'service', 'environment', 'release',
];

const COLUMN_ALIASES = {
  severity: 'level',
  logger: 'logger_name',
};
```

---

## 14. UI Implementation

### 14.1 contentEditable + Span 방식 (Sentry Style)

- `contentEditable` div 사용
- 토큰별 `<span>` 으로 syntax highlighting
- 커서 위치 추적: `window.getSelection()` + `Range` API
- 입력 이벤트: `onInput`, `onKeyDown`, `onCompositionStart/End`

### 14.2 Syntax Highlighting

```html
<div contenteditable>
  <span class="token-field">country</span>
  <span class="token-colon">:</span>
  <span class="token-value">KR</span>
  <span class="token-space"> </span>
  <span class="token-logical">and</span>
  <span class="token-space"> </span>
  <span class="token-field">level</span>
  <span class="token-colon">:</span>
  <span class="token-operator">></span>
  <span class="token-number">100</span>
</div>
```

### 14.3 Component Props

```typescript
interface QueryDSLEditorProps {
  /** 도메인별 설정 (5.4 참조) — 필드 목록, 별칭, facet endpoint, freeText 필드 등 */
  config: DomainConfig;
  /** 초기 쿼리 문자열 */
  initialQuery?: string;
  /** Enter 시에만 호출. 문법 오류 시 호출되지 않음 */
  onSearch: (query: string) => void;
  /** 쿼리 변경 시 호출 (부모 상태 동기화용) */
  onChange?: (query: string) => void;
  /** 필드 값 동적 로딩 콜백 (staticValues 없는 필드용) */
  fetchFieldValues?: (fieldKey: string) => Promise<string[]>;
  /** placeholder 텍스트 (i18n key) */
  placeholder?: string;
  /** 최대 추천 개수 (기본: 20) */
  maxSuggestions?: number;
}
```

### 14.4 키보드 인터랙션

| Key | Action |
|---|---|
| `Enter` | 문법 오류 없으면 쿼리 커밋 + 검색 실행. **오류 있으면 실행 차단 + 에러 피드백** |
| `Escape` | 드롭다운 닫기 |
| `↑` / `↓` | 드롭다운 항목 탐색. **드롭다운이 닫혀있으면 `↓`로 열기 (WAI-ARIA combobox pattern)** |
| `←` / `→` | 드롭다운 열린 상태: **탭 전환 우선**. 닫힌 상태: 토큰 탐색 |
| `Tab` | 선택된 항목 적용 |
| `Backspace` | 일반 삭제 (빈 입력에서는 무시) |

#### 14.4.0 드롭다운 열기 정책

추천 드롭다운은 **포커스 또는 클릭 시 자동으로 열리지 않는다**. 사용자가 명시적으로 열기 동작을 수행해야 한다.

| 트리거 | 드롭다운 열림 | 비고 |
|--------|---------------|------|
| **입력 필드 포커스** | ❌ | 포커스만으로는 열리지 않음 |
| **입력 필드 클릭** | ❌ | 클릭만으로는 열리지 않음 |
| **`↓` 키 입력** | ✅ | 모든 팝오버가 닫혀있을 때 |
| **텍스트 타이핑** | ✅ | 1글자 이상 입력 시 자동으로 열림 |

> **설계 의도**: 포커스/클릭 시 자동 팝오버는 기존 칩 편집이나 쿼리 확인 시 불필요한 시각적 방해를 유발한다. 사용자가 필요할 때만 `↓` 키로 열 수 있어 더 쾌적한 UX를 제공한다.

#### 14.4.1 ArrowDown으로 드롭다운 열기

모든 팝오버(추천, 필드 편집, 값 편집)가 닫혀있고 토큰 탐색 중이 아닐 때, `↓` 키로 추천 드롭다운을 열 수 있다.

```
조건:
  - showDropdown === false
  - editingToken === null
  - chipEditingRef.current === false
  - selectedTokenIdx < 0
동작:
  - setShowDropdown(true)
  - setSelectedIndex(-1)
```

#### 14.4.2 탭 전환 vs 토큰 탐색 우선순위

드롭다운이 열려있을 때 `←`/`→`는 **탭 전환을 우선**한다. 토큰 탐색을 하려면 먼저 `Escape`로 드롭다운을 닫아야 한다.

```
드롭다운 열림 + ← → dropdownRef.prevTab()
드롭다운 열림 + → → dropdownRef.nextTab()
드롭다운 닫힘 + ← → 토큰 탐색 (이전 토큰)
드롭다운 닫힘 + → → 토큰 탐색 (다음 토큰)
```

#### 14.4.3 Filtered Suggestion Index 매핑

`selectedIndex`는 현재 탭의 **filteredSuggestions** 기준이다. Enter/Tab 시 `dropdownRef.getItemAtIndex(selectedIndex)`로 정확한 아이템을 가져온다. 전체 `suggestions` 배열의 인덱스와 혼동하지 않는다.

```typescript
// ✅ 올바른 구현
const item = dropdownRef.current?.getItemAtIndex(selectedIndex);
if (item) applySuggestion(item);

// ❌ 금지 — 탭 필터링 시 잘못된 아이템 선택
applySuggestion(suggestions[selectedIndex]);
```

### 14.5 칩 모드: 값 인라인 편집

칩의 값 편집은 **항상 인라인 텍스트 입력 모드**를 사용한다. 최초 칩 생성(composing)이든, 완성된 칩의 값 수정이든 동일하다. 타이핑이 primary이고, 추천 팝오버는 optional helper이다.

> **적용 범위**: 값(`value`) part 편집은 **모든 경우**에 인라인 input 사용. 팝오버 내 InputBase는 사용하지 않는다.

#### 14.5.1 인라인 편집 진입

**시나리오 A: 최초 칩 생성 (composing)**

```
1. 사용자가 field "level" 선택, operator "is" 선택
2. [level] [is] [________]       ← 값 셀이 인라인 input (빈 상태, 커서 깜빡임)
                  ┌────────────────┐
                  │ ☐ debug        │  ← 추천 팝오버 (optional, 포커스 없음)
                  │ ☐ error        │
                  │ ☐ info         │
                  └────────────────┘
3. 사용자가 직접 타이핑 or 방향키로 선택 or 체크박스 클릭
```

**시나리오 B: 완성된 칩 값 편집**

```
완성된 칩:  [level] [is] [debug or error or info or warn]
                                    ↓ 값 영역 클릭
편집 모드:  [level] [is] [debug, error, info, warn____]   ← 인라인 <input>
                          ┌────────────────┐
                          │ ☑ debug        │  ← 추천 팝오버 (optional, 포커스 없음)
                          │ ☑ error        │
                          │ ☑ info         │
                          │ ☑ warn         │
                          └────────────────┘
```

**진입 조건:**
- 칩의 `composingPart`가 `undefined` (완성된 칩)
- 클릭된 part가 `'value'`

**진입 시 동작:**
1. 값 셀의 `<span>` → `<input>`으로 DOM 전환
2. 기존 값을 쉼표+공백 구분 텍스트로 표시 (`"debug, error, info, warn"`)
3. input에 `autoFocus` → 즉시 커서 표시
4. 추천 팝오버 열림 (앵커: 칩 컨테이너 `[data-chip]`)
5. 원래 값을 ref에 저장 (Escape 복원용)

#### 14.5.2 인라인 input 키보드 인터랙션

| 키 | 동작 |
|----|------|
| 일반 타이핑 | 인라인 input에 텍스트 직접 입력 (primary) |
| `←` / `→` | 인라인 input 내 텍스트 커서 이동 (네이티브) |
| `↓` | 추천 팝오버 리스트에서 하이라이트 아래로 이동 |
| `↑` | 추천 팝오버 리스트에서 하이라이트 위로 이동 |
| `Enter` (하이라이트 없음, idx=-1) | 현재 인라인 텍스트로 확정 → 편집 종료 |
| `Enter` (하이라이트 있음, idx≥0) | 하이라이트 항목을 토글 (체크박스처럼) → 편집 계속 |
| `Tab` | 현재 값으로 확정 → 편집 종료 |
| `Escape` | 원래 값 복원 → 편집 종료 |

#### 14.5.3 추천 팝오버 동작

- **상단 InputBase 없음** — 인라인 input이 대체하므로 불필요
- **하단 multi-select hint 없음** — 체크박스로 충분히 self-explanatory
- **Popover 포커스 비간섭**: `disableAutoFocus`, `disableEnforceFocus`, `disableRestoreFocus` 설정하여 인라인 input에서 포커스를 빼앗지 않음
- **팝오버 내 클릭**: 체크박스 클릭 → 값 토글 → 인라인 텍스트 동기화 → 포커스 인라인 input 유지
- **텍스트 클릭 (체크박스 아닌 부분)**: 단일 선택 → 편집 종료
- **필터링**: 인라인 input에서 쉼표 뒤의 마지막 토큰을 필터 텍스트로 사용

```
인라인 input: "debug, error, in"
                              ^^ 마지막 토큰 → 팝오버에서 "info" 필터링 표시
```

#### 14.5.4 값 파싱 규칙

인라인 input의 텍스트를 칩의 `values` 배열로 파싱:

```typescript
"debug, error, info, warn"  →  ["debug", "error", "info", "warn"]
"debug"                     →  ["debug"]
""                          →  []  (빈 값 → 원래 값 복원)
"hello world, foo bar"      →  ["hello world", "foo bar"]  (공백 포함 값 허용)
```

| 파싱 규칙 | 설명 |
|-----------|------|
| 쉼표(`,`) 구분 | 쉼표를 기준으로 분할 |
| 각 토큰 trim | 앞뒤 공백 제거 |
| 빈 토큰 무시 | `"debug, , error"` → `["debug", "error"]` |
| 단일 값 | `values` 배열 길이 1, `value`에도 동일 저장 |

#### 14.5.5 편집 종료 조건

| 이벤트 | 동작 |
|--------|------|
| `Enter` (하이라이트 없음) | 현재 텍스트 파싱 → 칩 업데이트 → 편집 종료 |
| `Tab` | 현재 텍스트 파싱 → 칩 업데이트 → 편집 종료 |
| `Escape` | 원래 값 복원 → 칩 업데이트 → 편집 종료 |
| 외부 클릭 (click-away) | 현재 텍스트 파싱 → 칩 업데이트 → 편집 종료 |
| 다른 칩/part 클릭 | 현재 편집 커밋 → 새 편집 시작 |

#### 14.5.6 엣지 케이스

| 엣지 케이스 | 처리 방법 |
|-------------|-----------|
| **빈 input + Enter** | 원래 값 복원 (빈 필터는 무의미) |
| **has/!has 칩 field 클릭** | HasToggleMenu 표시 — `has`/`not has` 전환만 가능. 전체 FieldMenu 미표시 |
| **has/!has 칩 value 클릭** | HasFieldSelector Popover — 인라인 input 미적용 (Popover 앵커 안정성 보장) |
| **has:"" 자동 삽입** | 텍스트 입력에서 `has:` 또는 `!has:` 입력 시 자동으로 `""` 추가, 커서는 따옴표 사이 |
| **facet에서 has/!has 제외** | facet 데이터에 `has`/`!has` 키가 있어도 필드 추천·HasFieldSelector에서 제외 (특수 연산자이므로) |
| **값에 쉼표 포함** | 현재 스코프에서는 쉼표를 구분자로만 사용. 향후 따옴표 이스케이프 고려 |
| **IME 조합 중 (한글/일본어)** | `compositionend` 이전에 Enter 무시 — 조합 완료 후에만 커밋 |
| **앵커 안정성** | 값 셀이 `<span>` → `<input>` 전환되어도 앵커는 칩 컨테이너 `[data-chip]` 사용 → DOM 변경에 안전 |
| **Popover onClose 간섭** | `disableAutoFocus`/`disableEnforceFocus` 설정 + 체크박스 클릭 시 `event.stopPropagation()` |
| **동시 편집 방지** | 한 번에 하나의 칩만 편집 가능. 다른 칩 클릭 시 현재 편집 커밋 후 전환 |
| **facet 없는 필드** | 추천 팝오버가 빈 리스트 → 팝오버 숨김 → 순수 타이핑 모드 |
| **실시간 칩 업데이트** | 타이핑 중 칩의 values를 실시간 업데이트하되, `chipEditingRef.current = true`로 `onChange` 전파 억제 |
| **입력값 > maxWidth** | 인라인 input의 width를 텍스트 길이에 따라 동적 조절, `maxWidth: 300px` 제한 |

### 14.6 칩 모드: 토큰 탐색 (좌/우 방향키)

좌/우 방향키로 칩의 토큰을 탐색할 때 **경계에서 멈춤 (clamping)** 방식을 사용한다. 순환(rotation)하지 않는다.

> **중요**: 토큰 탐색은 **드롭다운이 닫혀있을 때만** 동작한다. 드롭다운이 열려있으면 `←`/`→`는 탭 전환에 사용된다 (14.4.2 참조).

```
토큰 인덱스:  [-2]  [0] [1] [2] [3] [4] [5]  → [input]
               ↑     ↑                    ↑       ↑
          before-all 첫 토큰            마지막    input (idx = -1)
```

| 현재 위치 | `←` 누름 | `→` 누름 |
|-----------|----------|----------|
| input (`-1`) | 마지막 토큰 (`length - 1`) | 그대로 유지 (`-1`) |
| before-all (`-2`) | 그대로 유지 (`-2`) | 첫 토큰 (`0`) |
| 첫 토큰 (`0`) | before-all (`-2`) | 다음 토큰 (`1`) |
| 마지막 토큰 (`length - 1`) | 이전 토큰 (`length - 2`) | input (`-1`) |
| 중간 토큰 (`n`) | `n - 1` | `n + 1` |

```typescript
// ArrowLeft: 드롭다운 닫힌 상태에서만
setSelectedTokenIdx(prev => {
  if (prev === -2) return -2;                  // before-all에서 멈춤
  if (prev === -1) return visualTokens.length - 1;  // input → 마지막 토큰
  if (prev <= 0) return -2;                    // 첫 토큰 → before-all
  return prev - 1;
});

// ArrowRight: 드롭다운 닫힌 상태에서만
setSelectedTokenIdx(prev => {
  if (prev === -2) return 0;                   // before-all → 첫 토큰
  if (prev < 0) return -1;                     // input에서 멈춤
  if (prev >= visualTokens.length - 1) return -1; // 마지막 → input
  return prev + 1;
});
```

---

## 15. History & Saved Queries

### 15.1 Recent Search History

- `localStorage` 기반 (`argus_recent_dsl_searches`)
- 최대 10개
- 검색 실행(Enter) 시 자동 저장

### 15.2 Saved Queries

- 기존 백엔드 API 활용 (`/discover/saved`)
- 즐겨찾기 + 공유 가능

---

## 16. Formatter

### 16.1 Pretty Print

AST를 정리된 문자열로 변환한다.

```
(country:KR or country:JP) and level:>100
```

### 16.2 Serialize (Compact)

공백 최소화.

```
(country:KR or country:JP) and level:>100
```

---

## 17. AST Inspector

디버그/개발용 실시간 AST Viewer를 제공한다.

- 트리 뷰로 AST 노드 표시
- 토큰 목록 표시
- FSM 상태 표시
- Validation 에러 표시

---

## 18. File Structure

```
src/components/argus/query-dsl/
├── index.ts                        # Barrel exports
├── types.ts                        # TokenType, Token, AST nodes, QueryField, EditorState, CursorContext
├── fields.ts                       # QueryField metadata, operators, aliases
├── lexer.ts                        # Character-by-character tokenizer
├── parser.ts                       # Recursive descent parser
├── validator.ts                    # Type/operator validation
├── editor-fsm.ts                   # Editor state machine
├── cursor-context.ts               # Cursor position analyzer
├── suggestion-engine.ts            # Context-aware suggestions
├── providers.ts                    # SuggestionProvider implementations
├── formatter.ts                    # Pretty print + serialization
├── serializer.ts                   # Frontend DSL → Backend format converter
├── QueryDSLEditor.tsx              # Main React component (contentEditable)
├── QuerySuggestionDropdown.tsx     # Autocomplete dropdown UI
├── QueryASTInspector.tsx           # Debug AST viewer
└── __tests__/
    ├── lexer.test.ts
    ├── parser.test.ts
    ├── editor-fsm.test.ts
    ├── cursor-context.test.ts
    ├── suggestion-engine.test.ts
    ├── validator.test.ts
    ├── formatter.test.ts
    └── serializer.test.ts
```

---

## 19. Testing Strategy

### 19.1 필수 원칙

- **모든 에러 타입은 반드시 유닛테스트로 커버**
- 정상 케이스 + 에러 케이스 + 엣지 케이스 모두 테스트
- 각 테스트는 **입력 → 기대 결과**를 명확히 정의

### 19.2 Lexer Tests (`lexer.test.ts`)

```typescript
describe('Lexer', () => {
  // ── 기본 토큰화 ──
  it('단일 필드:값', () => {
    // "country:KR" → [FIELD(country), COLON, STRING(KR), EOF]
  });
  it('따옴표 문자열', () => {
    // 'message:"hello world"' → [FIELD, COLON, STRING("hello world"), EOF]
  });
  it('숫자 값', () => {
    // "level:100" → [FIELD, COLON, NUMBER(100), EOF]
  });
  it('boolean 값', () => {
    // "active:true" → [FIELD, COLON, BOOLEAN(true), EOF]
  });

  // ── 연산자 ──
  it('비교 연산자 !=', () => {
    // "country:!=CN" → [FIELD, COLON, NE, STRING(CN), EOF]
  });
  it('비교 연산자 >=', () => {
    // "level:>=100" → [FIELD, COLON, GTE, NUMBER(100), EOF]
  });
  it('비교 연산자 >', () => {
    // "level:>100" → [FIELD, COLON, GT, NUMBER(100), EOF]
  });
  it('비교 연산자 <=', () => {
    // "level:<=50" → [FIELD, COLON, LTE, NUMBER(50), EOF]
  });
  it('비교 연산자 <', () => {
    // "level:<50" → [FIELD, COLON, LT, NUMBER(50), EOF]
  });

  // ── 함수형 연산자 (colon 직후에서만) ──
  it('contains는 colon 직후에서만 CONTAINS', () => {
    // 'message:contains("x")' → [FIELD(message), COLON, CONTAINS, LPAREN, STRING(x), RPAREN]
  });
  it('contains가 필드 위치이면 FIELD', () => {
    // "contains:value" → [FIELD(contains), COLON, STRING(value)]
  });
  it('startsWith → STARTS_WITH', () => {
    // 'message:startsWith("err")' → [FIELD, COLON, STARTS_WITH, LPAREN, STRING, RPAREN]
  });
  it('endsWith → ENDS_WITH', () => {
    // 'message:endsWith(".js")' → [FIELD, COLON, ENDS_WITH, LPAREN, STRING, RPAREN]
  });
  it('before → BEFORE', () => {
    // 'timestamp:before("2025")' → [FIELD, COLON, BEFORE, LPAREN, STRING, RPAREN]
  });
  it('after → AFTER', () => {
    // 'timestamp:after("2025")' → [FIELD, COLON, AFTER, LPAREN, STRING, RPAREN]
  });

  // ── 논리 연산자 (case-insensitive) ──
  it('and (소문자)', () => { /* AND 토큰 */ });
  it('AND (대문자)', () => { /* AND 토큰 */ });
  it('Or (혼합)', () => { /* OR 토큰 */ });
  it('NOT', () => { /* NOT 토큰 */ });

  // ── 토큰 위치 정확성 ──
  it('모든 토큰의 start/end가 정확', () => {
    // "country:KR" → FIELD(start=0, end=7), COLON(7,8), STRING(8,10)
  });
  it('공백이 있는 경우 위치 정확성', () => {
    // "country:KR and level:>100"
    // AND 토큰: start=11, end=14
  });

  // ── 미완성 입력 ──
  it('미완성 따옴표 → STRING 토큰으로 처리', () => {
    // 'message:"hello' → [FIELD, COLON, STRING("hello"), EOF]
  });
  it('빈 입력 → EOF만', () => {
    // "" → [EOF]
  });
  it('공백만 → EOF만', () => {
    // "   " → [EOF]
  });

  // ── escape ──
  it('따옴표 내 escape', () => {
    // 'message:"hello \\"world\\""' → STRING('hello "world"')
  });

  // ── 엣지 케이스 ──
  it('연속 colon', () => {
    // "field::value" → [FIELD, COLON, COLON, STRING(value)]
  });
  it('underscore 포함 필드', () => {
    // "logger_name:app" → [FIELD(logger_name), COLON, STRING(app)]
  });
  it('음수', () => {
    // "level:>-50" → [FIELD, COLON, GT, NUMBER(-50)]
  });
  it('소수점', () => {
    // "score:>3.14" → [FIELD, COLON, GT, NUMBER(3.14)]
  });
});
```

### 19.3 Parser Tests (`parser.test.ts`)

```typescript
describe('Parser', () => {
  // ── 정상 파싱 ──
  it('단순 필터: country:KR', () => {
    // → FilterExpression(field=country, op='=', value='KR')
  });
  it('비교 연산자: level:>100', () => {
    // → FilterExpression(field=level, op='>', value=100)
  });
  it('부정: country:!=CN', () => {
    // → FilterExpression(field=country, op='!=', value='CN')
  });
  it('함수형: message:contains("timeout")', () => {
    // → FilterExpression(field=message, op='contains', value='timeout')
  });
  it('AND 조합: country:KR and level:>100', () => {
    // → BinaryExpression(and, Filter(country), Filter(level))
  });
  it('OR 조합: country:KR or country:JP', () => {
    // → BinaryExpression(or, Filter(KR), Filter(JP))
  });
  it('NOT: not country:CN', () => {
    // → NotExpression(FilterExpression(country, =, CN))
  });
  it('괄호: (country:KR or country:JP) and level:>100', () => {
    // → BinaryExpression(and, BinaryExpression(or, ...), Filter(level))
  });
  it('중첩 괄호: ((a:1 or b:2) and c:3)', () => {
    // 정상 파싱
  });
  it('연산자 우선순위: a:1 or b:2 and c:3', () => {
    // → OR(a:1, AND(b:2, c:3))  — and가 or보다 높은 우선순위
  });
  it('이중 부정: not not country:CN', () => {
    // → NotExpression(NotExpression(FilterExpression))
  });

  // ── 부분 파싱 (PartialExpression) ──
  it('미완성 필터: "country:"', () => {
    // → PartialExpression(field='country')
    // errors: [INCOMPLETE_FILTER]
  });
  it('미완성 함수: "message:contains("', () => {
    // → PartialExpression(field='message', operator='contains')
    // errors: [INCOMPLETE_FUNCTION]
  });

  // ── ❌ 문법 오류 감지 ──
  describe('Syntax Errors', () => {
    it('DANGLING_OPERATOR: "country:KR and"', () => {
      // errors: [{ type: 'DANGLING_OPERATOR', start: 11, end: 14 }]
      // severity: 'error'
    });
    it('DANGLING_OPERATOR: "country:KR or"', () => {
      // errors: [{ type: 'DANGLING_OPERATOR', start: 11, end: 13 }]
    });
    it('DANGLING_OPERATOR: "a:1 and b:2 or"', () => {
      // errors: [{ type: 'DANGLING_OPERATOR' }] — 마지막 or
    });
    it('UNEXPECTED_TOKEN: "and country:KR"', () => {
      // errors: [{ type: 'UNEXPECTED_TOKEN', raw: 'and' }]
    });
    it('UNEXPECTED_TOKEN: "or country:KR"', () => {
      // errors: [{ type: 'UNEXPECTED_TOKEN', raw: 'or' }]
    });
    it('UNEXPECTED_TOKEN: "country:KR and or level:100"', () => {
      // errors: [{ type: 'UNEXPECTED_TOKEN', raw: 'or' }]
    });
    it('UNEXPECTED_TOKEN: "country:KR and and level:100"', () => {
      // errors: [{ type: 'UNEXPECTED_TOKEN', raw: 'and' }] — 두번째 and
    });
    it('INCOMPLETE_FILTER: "country:"', () => {
      // errors: [{ type: 'INCOMPLETE_FILTER', field: 'country' }]
    });
    it('UNCLOSED_PAREN: "(country:KR"', () => {
      // errors: [{ type: 'UNCLOSED_PAREN' }]
    });
    it('UNCLOSED_PAREN: "((country:KR)"', () => {
      // errors: [{ type: 'UNCLOSED_PAREN' }] — 외부 괄호
    });
    it('UNCLOSED_QUOTE: \'message:"hello\'', () => {
      // errors: [{ type: 'UNCLOSED_QUOTE' }]
    });
    it('INCOMPLETE_FUNCTION: "message:contains("', () => {
      // errors: [{ type: 'INCOMPLETE_FUNCTION' }]
    });
    it('INCOMPLETE_FUNCTION: \'message:contains("hello\'', () => {
      // errors: [{ type: 'INCOMPLETE_FUNCTION' }, { type: 'UNCLOSED_QUOTE' }]
    });
    it('DANGLING NOT: "country:KR and not"', () => {
      // errors: [{ type: 'DANGLING_OPERATOR', raw: 'not' }]
    });
    it('빈 괄호: "()"', () => {
      // errors: [{ type: 'UNEXPECTED_TOKEN', raw: ')' }]
    });
    it('닫는 괄호만: ")"', () => {
      // errors: [{ type: 'UNEXPECTED_TOKEN', raw: ')' }]
    });
    it('여는 괄호만: "("', () => {
      // errors: [{ type: 'UNCLOSED_PAREN' }]
    });
  });
});
```

### 19.4 Validator Tests (`validator.test.ts`)

```typescript
describe('Validator', () => {
  // ── 정상 조합 ──
  it('string 필드 + = 연산자', () => {
    // country:KR → valid
  });
  it('string 필드 + != 연산자', () => {
    // country:!=CN → valid
  });
  it('string 필드 + contains', () => {
    // message:contains("timeout") → valid
  });
  it('string 필드 + startsWith', () => {
    // message:startsWith("err") → valid
  });
  it('string 필드 + endsWith', () => {
    // message:endsWith(".js") → valid
  });
  it('number 필드 + > 연산자', () => {
    // level:>100 → valid
  });
  it('number 필드 + >= 연산자', () => {
    // level:>=100 → valid
  });
  it('number 필드 + = 연산자', () => {
    // level:100 → valid
  });
  it('datetime 필드 + before', () => {
    // timestamp:before("2025-01-01") → valid
  });
  it('datetime 필드 + after', () => {
    // timestamp:after("2025-01-01") → valid
  });
  it('boolean 필드 + =', () => {
    // active:true → valid
  });

  // ── ❌ 필드-연산자 불일치 ──
  describe('INVALID_OPERATOR errors', () => {
    it('string 필드에 > 사용', () => {
      // message:>100 → INVALID_OPERATOR, severity: 'error'
      // hint: "message"에 사용 가능한 연산자: contains, startsWith, endsWith, =, !=
    });
    it('string 필드에 >= 사용', () => {
      // country:>=100 → INVALID_OPERATOR
    });
    it('string 필드에 < 사용', () => {
      // service:<abc → INVALID_OPERATOR
    });
    it('string 필드에 before 사용', () => {
      // country:before("2025") → INVALID_OPERATOR
    });
    it('number 필드에 contains 사용', () => {
      // level:contains("100") → INVALID_OPERATOR
    });
    it('number 필드에 startsWith 사용', () => {
      // level:startsWith("1") → INVALID_OPERATOR
    });
    it('number 필드에 before 사용', () => {
      // level:before("2025") → INVALID_OPERATOR
    });
    it('datetime 필드에 contains 사용', () => {
      // timestamp:contains("2025") → INVALID_OPERATOR
    });
    it('datetime 필드에 > 사용', () => {
      // timestamp:>"2025" → INVALID_OPERATOR
    });
    it('boolean 필드에 > 사용', () => {
      // active:>true → INVALID_OPERATOR
    });
    it('boolean 필드에 contains 사용', () => {
      // active:contains("true") → INVALID_OPERATOR
    });
  });

  // ── ⚠ 알 수 없는 필드 ──
  describe('UNKNOWN_FIELD warnings', () => {
    it('존재하지 않는 필드', () => {
      // xyzField:value → UNKNOWN_FIELD, severity: 'warning'
    });
    it('오타 필드', () => {
      // mesage:error → UNKNOWN_FIELD (message 아님)
    });
    it('alias는 유효', () => {
      // severity:error → valid (→ level alias)
    });
  });

  // ── 에러 위치 정확성 ──
  describe('Error position accuracy', () => {
    it('에러의 start/end가 해당 토큰 범위와 정확히 일치', () => {
      // "country:KR and" → DANGLING_OPERATOR, start=11, end=14
    });
    it('복합 쿼리에서 두 번째 조건의 에러 위치', () => {
      // "country:KR and message:>100" → INVALID_OPERATOR, start=23, end=24
    });
    it('여러 에러가 동시에 발생하는 경우 각각 올바른 위치', () => {
      // "xyz:>100 and" → [UNKNOWN_FIELD(0,3), DANGLING_OPERATOR(9,12)]
    });
  });

  // ── 에러 메시지 i18n 키 ──
  describe('Error i18n keys', () => {
    it('모든 에러에 messageKey 포함', () => {
      // error.messageKey === 'dsl.error.invalidOperator' 등
    });
    it('모든 에러에 hintKey 포함', () => {
      // error.hintKey === 'dsl.hint.invalidOperator' 등
    });
    it('params에 보간 변수 포함', () => {
      // error.params === { field: 'message', op: '>' }
    });
  });
});
```

### 19.5 Editor FSM Tests (`editor-fsm.test.ts`)

```typescript
describe('Editor FSM', () => {
  it('초기 상태 → EXPECT_FIELD', () => {});
  it('FIELD 입력 → EXPECT_COLON', () => {});
  it('COLON 입력 → EXPECT_OPERATOR_OR_VALUE', () => {});
  it('비교 연산자 입력 → EXPECT_VALUE', () => {});
  it('함수형 연산자 입력 → EXPECT_VALUE', () => {});
  it('값 입력 → EXPECT_LOGICAL_OPERATOR', () => {});
  it('AND 입력 → EXPECT_FIELD', () => {});
  it('OR 입력 → EXPECT_FIELD', () => {});
  it('NOT 입력 → EXPECT_FIELD', () => {});
  it('LPAREN → IN_PARENTHESIS (→ EXPECT_FIELD)', () => {});
  it('따옴표 시작 → IN_QUOTED_STRING', () => {});
  it('따옴표 닫기 → EXPECT_LOGICAL_OPERATOR', () => {});
  it('RPAREN → EXPECT_LOGICAL_OPERATOR', () => {});
  it('EOF 시 EXPECT_FIELD → 정상 완료', () => {});
  it('EOF 시 EXPECT_LOGICAL_OPERATOR → 정상 완료', () => {});
  it('EOF 시 EXPECT_VALUE → 미완성', () => {});
  it('EOF 시 EXPECT_COLON → 미완성', () => {});
});
```

### 19.6 CursorContext Tests (`cursor-context.test.ts`)

```typescript
describe('CursorContextResolver', () => {
  // Section 9.3의 모든 케이스를 빠짐없이 커버

  it('빈 문자열, 커서 0 → FIELD context', () => {});
  it('필드 입력 중: "cou|" → FIELD, prefix="cou"', () => {});
  it('필드 입력 완료: "country|" → FIELD, prefix="country"', () => {});
  it('colon 직후: "country:|" → OPERATOR, field=country', () => {});
  it('값 입력 중: "country:K|" → VALUE, field=country, op="=", prefix="K"', () => {});
  it('비교 연산자 후 빈 값: "country:!=|" → VALUE, field=country, op="!="', () => {});
  it('비교 연산자 + 값: "country:!=C|" → VALUE, op="!=", prefix="C"', () => {});
  it('숫자 연산자 후: "level:>|" → VALUE, field=level, op=">"', () => {});
  it('숫자 값: "level:>10|" → VALUE, field=level, op=">", prefix="10"', () => {});
  it('함수 연산자 중간: "message:cont|" → OPERATOR, field=message, prefix="cont"', () => {});
  it('함수 괄호 후: "message:contains(|" → VALUE, field=message, op=contains', () => {});
  it('함수 따옴표 내: \'message:contains("|\'→ VALUE, inQuotedString=true', () => {});
  it('함수 값 입력 중: \'message:contains("net|\'→ VALUE, prefix="net"', () => {});
  it('직접 따옴표: \'message:"|\'→ VALUE, op="=", inQuotedString=true', () => {});
  it('직접 따옴표 값: \'message:"net|\'→ VALUE, prefix="net"', () => {});
  it('논리 연산자 위치: "country:KR |" → LOGICAL_OPERATOR', () => {});
  it('논리 연산자 입력 중: "country:KR a|" → LOGICAL_OPERATOR, prefix="a"', () => {});
  it('and 뒤 필드 위치: "country:KR and |" → FIELD', () => {});
  it('and 뒤 필드 입력: "country:KR and le|" → FIELD, prefix="le"', () => {});
  it('괄호 직후: "(|" → FIELD', () => {});

  // ── tokenStart/tokenEnd 정확성 ──
  it('tokenStart/tokenEnd로 replace 범위가 정확', () => {
    // "country:KOREA|" → tokenStart=8, tokenEnd=13
  });
  it('공백 후 필드의 tokenStart', () => {
    // "country:KR and |" → tokenStart=15, tokenEnd=15
  });
});
```

### 19.7 Suggestion Engine Tests (`suggestion-engine.test.ts`)

```typescript
describe('SuggestionEngine', () => {
  // ── 상태별 추천 ──
  it('FIELD 상태 → 필드 목록 추천', () => {});
  it('FIELD 상태 + prefix → 필터링된 필드 목록', () => {});
  it('OPERATOR 상태 → 해당 필드의 허용 연산자만', () => {
    // field=message → [contains, startsWith, endsWith, =, !=]
    // field=level → [>, >=, <, <=, =, !=]
  });
  it('VALUE 상태 + string 필드 → facet 값', () => {});
  it('VALUE 상태 + boolean 필드 → [true, false]', () => {});
  it('VALUE 상태 + number 필드 → 빈 배열', () => {});
  it('LOGICAL_OPERATOR 상태 → [and, or]', () => {});

  // ── 오류 예방: 잘못된 추천 금지 ──
  it('EXPECT_FIELD에서 and/or 추천하지 않음', () => {});
  it('EXPECT_FIELD에서 연산자 추천하지 않음', () => {});
  it('EXPECT_OPERATOR_OR_VALUE에서 다른 필드 추천하지 않음', () => {});
  it('EXPECT_VALUE에서 and/or 추천하지 않음', () => {});
  it('IN_QUOTED_STRING에서 필드/연산자 추천하지 않음', () => {});
  it('EXPECT_LOGICAL_OPERATOR에서 연산자/값 추천하지 않음', () => {});

  // ── number 필드에 string 전용 연산자 미추천 ──
  it('level 필드에서 contains 추천하지 않음', () => {});
  it('level 필드에서 startsWith 추천하지 않음', () => {});

  // ── 자동 삽입 ──
  it('필드 선택 → colon 자동 삽입', () => {});
  it('함수형 연산자 선택 → 괄호+따옴표 자동 삽입', () => {});
  it('and/or 선택 → 뒤에 공백 자동 삽입', () => {});
  it('값 선택 → 닫는 따옴표/괄호 자동 삽입', () => {});
});
```

### 19.8 Serializer Tests (`serializer.test.ts`)

```typescript
describe('Serializer (Frontend DSL → Backend)', () => {
  it('단순 필터', () => {
    // country:KR → "country:KR"
  });
  it('부정', () => {
    // country:!=CN → "country!=CN" 또는 "!country:CN"
  });
  it('비교 연산자', () => {
    // level:>100 → "level:>100"
  });
  it('contains → dot notation', () => {
    // message:contains("timeout") → "message.contains:timeout"
  });
  it('startsWith → dot notation', () => {
    // message:startsWith("network") → "message.starts_with:network"
  });
  it('endsWith → dot notation', () => {
    // message:endsWith("error") → "message.ends_with:error"
  });
  it('AND', () => {
    // A and B → "A AND B"
  });
  it('OR', () => {
    // A or B → "A OR B"
  });
  it('NOT', () => {
    // not A → "!A"
  });
  it('괄호 보존', () => {
    // (A or B) and C → "(A OR B) AND C"
  });
  it('alias 변환', () => {
    // severity:error → "severity:error" (백엔드가 alias 처리)
  });

  // ── 에러 상태에서 serialize 시도 ──
  it('에러가 있는 AST는 serialize 거부', () => {
    // parse("country:KR and") → serialize 시 에러 throw
  });
});
```

### 19.9 Formatter Tests (`formatter.test.ts`)

```typescript
describe('Formatter', () => {
  it('pretty print', () => {
    // parse → format → 정리된 문자열
  });
  it('round-trip: parse → format → parse → 동일 AST', () => {});
  it('불필요한 공백 정리', () => {
    // "country:KR  and   level:>100" → "country:KR and level:>100"
  });
  it('괄호 보존', () => {
    // "(a:1 or b:2) and c:3" → 동일
  });
});
```

### 19.10 Edge Case Tests (`edge-cases.test.ts`)

```typescript
describe('Edge Cases', () => {
  // ── 공백 처리 ──
  it('colon 뒤 공백: "country: KR"', () => {
    // "country:" + " KR" → INCOMPLETE_FILTER + 별도 raw search?
    // 또는 공백 무시하고 country:KR 로 파싱? → 스펙 결정 필요
  });
  it('앞뒤 공백: "  country:KR  "', () => {
    // 정상 파싱
  });
  it('탭/줄바꿈', () => {
    // "country:KR\tand\nlevel:>100" → 정상 파싱
  });

  // ── 빈 값 ──
  it('빈 따옴표: message:""', () => {
    // FilterExpression(field=message, op='=', value='') — 유효
  });

  // ── 특수문자 ──
  it('값에 colon 포함: service:"my:service"', () => {
    // 따옴표 내 colon → 문제없음
  });
  it('값에 괄호 포함: message:"hello (world)"', () => {
    // 따옴표 내 괄호 → 문제없음
  });
  it('값에 백슬래시: message:"path\\\\to\\\\file"', () => {
    // escape 처리
  });

  // ── 키워드 충돌 ──
  it('필드명이 and: "and:value"', () => {
    // "and"가 필드 위치 → FIELD? or AND?
    // → context-sensitive: FIELD (colon이 따라오면)
  });
  it('필드명이 or: "or:value"', () => {
    // 마찬가지
  });
  it('필드명이 not: "not:value"', () => {
    // not 뒤에 colon → FIELD(not)
  });
  it('필드명이 true: "true:value"', () => {
    // 필드 위치의 true → FIELD? BOOLEAN?
  });

  // ── 복잡한 조합 ──
  it('3중 AND: "a:1 and b:2 and c:3"', () => {
    // AND(AND(a:1, b:2), c:3)
  });
  it('3중 OR: "a:1 or b:2 or c:3"', () => {
    // OR(OR(a:1, b:2), c:3)
  });
  it('혼합 우선순위: "a:1 or b:2 and c:3"', () => {
    // OR(a:1, AND(b:2, c:3))
  });
  it('깊은 중첩: "((a:1 or b:2) and (c:3 or d:4))"', () => {
    // 정상 파싱
  });
  it('NOT + 괄호: "not (a:1 or b:2)"', () => {
    // NOT(OR(a:1, b:2))
  });

  // ── 매우 긴 입력 ──
  it('100자 이상 입력 성능', () => {
    // 파싱 시간 < 5ms
  });

  // ── URL 동기화 및 포맷 정규화 (Normalization) ──
  it('Query Normalization & State Sync', () => {
    // 최근 검색어의 원본 문자열(예: 'service: "auth"')과 내부 칩 직렬화 문자열('service:"auth"') 간의
    // 공백, 따옴표 차이로 인한 리셋 레이스 컨디션을 방지하기 위해 두 쿼리를 표준화(Normalization)하여 비교해야 함.
    // 표준화 방법: chipsToQuery(queryToChips(query))
  });
});
```

### 19.11 Test Runner

```bash
npx vitest run src/components/argus/query-dsl/__tests__/
```

---

## 20. Extension Points

### 20.1 DomainConfig 기반 확장

`DomainConfig` 객체를 조립하여 새로운 도메인을 추가할 수 있다. 공용 컴포넌트 코드 변경 없이 필드, 별칭, facet endpoint, freeText 필드 등을 선언적으로 정의한다.

```typescript
// 새 도메인 추가 예시
const CUSTOM_CONFIG: DomainConfig = {
  name: 'custom-domain',
  fields: [
    ...pickFields(['environment', 'service', 'timestamp']),
    { key: 'custom_field', label: 'Custom', type: 'string', category: 'custom',
      operators: ['=', '!='], searchable: true, description: 'Custom field',
      staticValues: ['value1', 'value2', 'value3'] },
  ],
  freeTextField: 'custom_field',
};
```

### 20.2 Custom Fields with staticValues

`QueryField`에 `staticValues`를 추가하면 해당 필드의 값 자동완성에 정적 값이 즉시 표시된다. `fetchFieldValues`와 병합되므로, 정적 값 + 동적 값을 동시에 지원한다.

### 20.3 Custom Operators

`QueryOperator` 타입에 새 연산자를 추가하고, Lexer/Parser에 해당 토큰 처리를 추가한다.

### 20.4 Custom Providers

`SuggestionProvider` 인터페이스를 구현하여 새로운 데이터 소스(API, WebSocket 등)를 추가할 수 있다.

### 20.5 Aggregate Functions

향후 `count() > 100`, `avg(duration) >= 500` 같은 집계 함수 지원을 위한 확장 포인트를 제공한다.
