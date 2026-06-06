import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import './App.css';

// ─── Toast helper ───
function useToast() {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);

  const show = useCallback((text: string) => {
    setMsg(text);
    setVisible(true);
    setTimeout(() => setVisible(false), 2200);
  }, []);

  const el = (
    <div className={`toast ${visible ? 'show' : ''}`}>{msg}</div>
  );

  return { show, el };
}

// ═══════════════════════════════════════
//  홈 — 에러 & 브레드크럼
// ═══════════════════════════════════════
function HomePage() {
  const { show, el } = useToast();
  const [autoLogEnabled, setAutoLogEnabled] = useState(false);

  const triggerUnhandledError = () => {
    Sentry.addBreadcrumb({ category: 'test', message: '처리되지 않은 에러 발생 버튼 클릭', level: 'warning' });
    // @ts-ignore
    nonExistentFunction();
  };

  const triggerCaptureException = () => {
    try {
      throw new Error("사용자가 직접 발생시킨 수동 예외(Exception)입니다!");
    } catch (error) {
      Sentry.captureException(error);
      show("✅ 수동 에러가 Sentry로 전송되었습니다");
    }
  };

  const triggerTypeError = () => {
    try {
      const obj: any = null;
      obj.someMethod();
    } catch (error) {
      Sentry.captureException(error);
      show("✅ TypeError가 Sentry로 전송되었습니다");
    }
  };

  const addNavigationBreadcrumb = () => {
    Sentry.addBreadcrumb({ category: 'navigation', message: '사용자가 메뉴 A → 메뉴 B로 이동함', level: 'info' });
    show("🍞 네비게이션 브레드크럼 추가 완료");
  };

  const addUserActionBreadcrumb = () => {
    Sentry.addBreadcrumb({ category: 'ui.click', message: '"결제하기" 버튼을 클릭함', level: 'info', data: { 버튼ID: 'btn-payment', 페이지: '/checkout' } });
    show("🍞 UI 액션 브레드크럼 추가 완료");
  };

  const addHttpBreadcrumb = () => {
    Sentry.addBreadcrumb({ category: 'http', message: 'GET /api/users - 200', level: 'info', data: { method: 'GET', url: '/api/users', status_code: 200 } });
    show("🍞 HTTP 브레드크럼 추가 완료");
  };

  const sendInfoMessage = () => {
    Sentry.captureMessage("홈 화면에서 전송된 정보(Info) 메시지입니다.", "info");
    show("📨 Info 메시지 전송 완료");
  };

  const sendWarningMessage = () => {
    Sentry.captureMessage("경고: 메모리 사용량이 85%를 초과했습니다!", "warning");
    show("📨 Warning 메시지 전송 완료");
  };

  const sendErrorMessage = () => {
    Sentry.captureMessage("에러: 결제 모듈 응답 시간 초과", "error");
    show("📨 Error 메시지 전송 완료");
  };

  useEffect(() => {
    let interval: number | undefined;
    if (autoLogEnabled) {
      interval = window.setInterval(() => {
        Sentry.captureMessage(`자동 로그: ${new Date().toLocaleTimeString()} — 상태 정상`, 'log');
        console.log("자동 로그가 Sentry로 전송되었습니다.");
      }, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [autoLogEnabled]);

  return (
    <div>
      <h2 className="page-title">에러 트리거 & 브레드크럼</h2>
      <p className="page-desc">Sentry에 에러를 전송하고 브레드크럼(행동 이력)을 남겨 에러 진단 시 맥락을 풍부하게 합니다.</p>

      <div className="card">
        <div className="card-title">에러 발생</div>
        <div className="card-desc">처리되지 않은 에러, 수동 captureException, TypeError 등 다양한 에러를 발생시킵니다.</div>
        <div className="btn-row">
          <button className="btn btn-red" onClick={triggerUnhandledError}>💥 Unhandled Error</button>
          <button className="btn btn-orange" onClick={triggerCaptureException}>🎯 captureException</button>
          <button className="btn btn-pink" onClick={triggerTypeError}>🐛 TypeError</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">메시지 전송 (captureMessage)</div>
        <div className="card-desc">Info, Warning, Error 레벨의 메시지를 Sentry Issues에 기록합니다.</div>
        <div className="btn-row">
          <button className="btn btn-blue" onClick={sendInfoMessage}>ℹ️ Info</button>
          <button className="btn btn-yellow" onClick={sendWarningMessage}>⚠️ Warning</button>
          <button className="btn btn-red" onClick={sendErrorMessage}>🚨 Error</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">커스텀 브레드크럼 (addBreadcrumb)</div>
        <div className="card-desc">브레드크럼을 남긴 후 에러를 발생시키면, 에러 상세 화면에서 이 이력이 함께 표시됩니다.</div>
        <div className="btn-row">
          <button className="btn btn-cyan" onClick={addNavigationBreadcrumb}>🧭 네비게이션</button>
          <button className="btn btn-purple" onClick={addUserActionBreadcrumb}>👆 UI 액션</button>
          <button className="btn btn-dark" onClick={addHttpBreadcrumb}>🌐 HTTP 요청</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">자동 로깅</div>
        <div className="card-desc">5초 간격으로 captureMessage를 반복 전송합니다.</div>
        <div className="toggle-row">
          <label className="toggle-label">
            <input type="checkbox" className="toggle-switch" checked={autoLogEnabled} onChange={(e) => setAutoLogEnabled(e.target.checked)} />
            자동 로깅 활성화
          </label>
          {autoLogEnabled && <span className="active-badge">● 전송 중</span>}
        </div>
      </div>

      {el}
    </div>
  );
}

// ═══════════════════════════════════════
//  성능 — Spans & Tracing
// ═══════════════════════════════════════
function SpansPage() {
  const { show, el } = useToast();
  const [loading, setLoading] = useState(false);

  const runSimpleSpan = () => {
    setLoading(true);
    Sentry.startSpan({ name: "간단한 작업 처리", op: "task" }, () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setLoading(false);
          show("✅ 간단한 Span 완료 — Performance에서 확인하세요");
          resolve();
        }, 800);
      });
    });
  };

  const runNestedSpan = () => {
    setLoading(true);
    Sentry.startSpan({ name: "복합 작업 트랜잭션", op: "task.complex" }, async () => {
      await Sentry.startSpan({ name: "1단계: 데이터 조회", op: "db.query" }, () => {
        return new Promise<void>((resolve) => setTimeout(resolve, 500));
      });
      await Sentry.startSpan({ name: "2단계: 데이터 가공", op: "serialize" }, () => {
        return new Promise<void>((resolve) => setTimeout(resolve, 300));
      });
      await Sentry.startSpan({ name: "3단계: API 전송", op: "http.client" }, () => {
        return new Promise<void>((resolve) => setTimeout(resolve, 400));
      });
      setLoading(false);
      show("✅ 중첩 Span 3단계 완료 — Trace 상세에서 워터폴 확인");
    });
  };

  const runErrorSpan = () => {
    Sentry.startSpan({ name: "실패하는 작업", op: "task.fail" }, () => {
      try {
        throw new Error("Span 내부에서 발생한 에러입니다!");
      } catch (e) {
        Sentry.captureException(e);
        show("💥 에러가 Span에 연결되어 Sentry로 전송됨");
      }
    });
  };

  return (
    <div>
      <h2 className="page-title">성능 측정 (Spans & Tracing)</h2>
      <p className="page-desc">커스텀 Span을 생성하여 특정 로직의 소요 시간을 측정합니다. Sentry Performance → Traces에서 워터폴(Waterfall) 형태로 확인할 수 있습니다.</p>

      <div className="card">
        <div className="card-title">커스텀 Span 실행</div>
        <div className="card-desc">각 버튼은 서로 다른 구조의 Span 트랜잭션을 생성합니다.</div>
        <div className="btn-row">
          <button className="btn btn-green" onClick={runSimpleSpan} disabled={loading}>{loading ? '⏳ 처리 중...' : '▶️ 단일 Span'}</button>
          <button className="btn btn-blue" onClick={runNestedSpan} disabled={loading}>📦 중첩 Span (3단계)</button>
          <button className="btn btn-red" onClick={runErrorSpan}>💥 에러 포함 Span</button>
        </div>
      </div>

      {el}
    </div>
  );
}

// ═══════════════════════════════════════
//  메트릭 (Metrics)
// ═══════════════════════════════════════
function MetricsPage() {
  const { show, el } = useToast();

  const incrementCounter = () => {
    Sentry.metrics.count('버튼_클릭_수', 1, { attributes: { button: '테스트_카운터' } });
    show("📊 Counter +1 증가");
  };

  const recordDistribution = () => {
    const value = Math.random() * 100;
    Sentry.metrics.distribution('API_응답시간', value, { unit: 'millisecond', attributes: { endpoint: '/api/test' } });
    show(`📊 Distribution 기록: ${value.toFixed(1)}ms`);
  };

  const recordGauge = () => {
    const val = Math.floor(Math.random() * 100);
    Sentry.metrics.gauge('메모리_사용률', val, { unit: 'percent' });
    show(`📊 Gauge 기록: ${val}%`);
  };

  return (
    <div>
      <h2 className="page-title">메트릭 (Metrics)</h2>
      <p className="page-desc">카운터, 분포, 게이지 등 메트릭 타입을 수집합니다. Sentry → Metrics 탭에서 시계열 차트로 확인하세요.</p>

      <div className="card">
        <div className="card-title">메트릭 전송</div>
        <div className="card-desc">각 버튼을 여러 번 클릭하면 시간 흐름에 따른 변화를 그래프에서 확인할 수 있습니다.</div>
        <div className="btn-row">
          <button className="btn btn-purple" onClick={incrementCounter}>📈 Counter 증가</button>
          <button className="btn btn-pink" onClick={recordDistribution}>📉 Distribution</button>
          <button className="btn btn-yellow" onClick={recordGauge}>📏 Gauge</button>
        </div>
      </div>

      {el}
    </div>
  );
}

// ═══════════════════════════════════════
//  유저 피드백
// ═══════════════════════════════════════
function FeedbackPage() {
  const { show, el } = useToast();

  const triggerCrashReport = () => {
    try {
      throw new Error("유저 피드백 창을 테스트하기 위한 의도적인 에러입니다!");
    } catch (error) {
      const eventId = Sentry.captureException(error);
      Sentry.showReportDialog({
        eventId,
        title: "앗! 에러가 발생했습니다.",
        subtitle: "어떤 작업을 하던 중이었는지 알려주시면 신속하게 수정하겠습니다.",
        subtitle2: "",
        labelName: "이름",
        labelEmail: "이메일 주소",
        labelComments: "어떤 상황이었나요?",
        labelSubmit: "피드백 보내기",
        labelClose: "닫기",
        errorGeneric: "의견을 전송하는 중 문제가 발생했습니다.",
        errorFormEntry: "양식을 올바르게 채워주세요.",
        successMessage: "의견이 성공적으로 전송되었습니다!",
      });
    }
  };

  const captureManualFeedback = () => {
    Sentry.captureFeedback({
      name: "테스트 유저",
      email: "test@example.com",
      message: "API를 통해 백그라운드에서 조용히 전송된 유저 피드백입니다.",
    });
    show("✅ API 피드백이 전송되었습니다");
  };

  return (
    <div>
      <h2 className="page-title">유저 피드백 (User Feedback)</h2>
      <p className="page-desc">에러 발생 후 사용자에게 직접 피드백을 받거나, 우측 하단 위젯 또는 API로 의견을 수집합니다.</p>

      <div className="card">
        <div className="card-title">1. 플로팅 위젯</div>
        <div className="card-desc">우측 하단의 "버그 신고" 버튼을 클릭하여 의견을 보낼 수 있습니다. (feedbackIntegration으로 활성화)</div>
      </div>

      <div className="card">
        <div className="card-title">2. 크래시 리포트 다이얼로그</div>
        <div className="card-desc">에러가 발생한 직후 팝업창을 띄워 사용자에게 상황을 묻습니다. (showReportDialog)</div>
        <button className="btn btn-pink" onClick={triggerCrashReport}>🗯️ 에러 발생 + 다이얼로그</button>
      </div>

      <div className="card">
        <div className="card-title">3. API 수동 피드백</div>
        <div className="card-desc">개발자가 만든 커스텀 UI에서 수집한 내용을 코드로 전송합니다. (captureFeedback)</div>
        <button className="btn btn-purple" onClick={captureManualFeedback}>📝 조용히 피드백 전송</button>
      </div>

      {el}
    </div>
  );
}

// ═══════════════════════════════════════
//  로그 (Logs)
// ═══════════════════════════════════════
function LogsPage() {
  const { show, el } = useToast();

  const sendLog = (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') => {
    const messages: Record<string, string> = {
      trace: "가장 상세한 추적(trace) 레벨 로그입니다.",
      debug: "디버그 레벨 로그: 변수 count = 42",
      info: "정보(Info): 주문이 성공적으로 생성되었습니다.",
      warn: "경고(Warn): API 응답 시간이 느려지고 있습니다.",
      error: "에러(Error): DB 연결이 실패했습니다.",
      fatal: "치명적(Fatal): 시스템이 복구 불가능한 상태입니다.",
    };
    const attrs = { 모듈: "LogsPage", 레벨: level, 타임스탬프: new Date().toISOString() };
    Sentry.logger[level](messages[level], attrs);
    show(`📋 ${level.toUpperCase()} 로그 전송 완료`);
  };

  const triggerConsoleLog = () => { console.log("console.log: 이 메시지는 consoleLoggingIntegration에 의해 자동 수집됩니다."); show("📋 console.log 호출됨 (자동 수집)"); };
  const triggerConsoleWarn = () => { console.warn("console.warn: 경고 메시지가 자동 수집됩니다."); show("📋 console.warn 호출됨 (자동 수집)"); };
  const triggerConsoleError = () => { console.error("console.error: 에러 메시지가 자동 수집됩니다."); show("📋 console.error 호출됨 (자동 수집)"); };

  return (
    <div>
      <h2 className="page-title">로그 (Structured Logs)</h2>
      <p className="page-desc">Sentry.logger API로 구조화된 로그를 전송합니다. 속성(Attribute)을 함께 보내 Sentry Logs에서 필터링할 수 있습니다.</p>

      <div className="card">
        <div className="card-title">Sentry.logger.* API</div>
        <div className="card-desc">6단계 레벨별로 구조화된 로그를 전송합니다.</div>
        <div className="level-grid">
          <button className="btn btn-gray btn-sm" onClick={() => sendLog('trace')}>Trace</button>
          <button className="btn btn-dark btn-sm" onClick={() => sendLog('debug')}>Debug</button>
          <button className="btn btn-blue btn-sm" onClick={() => sendLog('info')}>Info</button>
          <button className="btn btn-yellow btn-sm" onClick={() => sendLog('warn')}>Warn</button>
          <button className="btn btn-red btn-sm" onClick={() => sendLog('error')}>Error</button>
          <button className="btn btn-pink btn-sm" onClick={() => sendLog('fatal')}>Fatal</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">console.* 자동 수집</div>
        <div className="card-desc">consoleLoggingIntegration에 의해 console.log/warn/error 호출이 자동으로 Sentry Logs에 전달됩니다.</div>
        <div className="btn-row">
          <button className="btn btn-green btn-sm" onClick={triggerConsoleLog}>console.log</button>
          <button className="btn btn-yellow btn-sm" onClick={triggerConsoleWarn}>console.warn</button>
          <button className="btn btn-red btn-sm" onClick={triggerConsoleError}>console.error</button>
        </div>
      </div>

      {el}
    </div>
  );
}

// ═══════════════════════════════════════
//  Context & Scope 관리
// ═══════════════════════════════════════
function ContextPage() {
  const { show, el } = useToast();

  const updateUser = () => {
    Sentry.setUser({
      id: "user-" + Math.floor(Math.random() * 1000),
      username: "변경된유저",
      email: "changed@example.com",
      ip_address: "{{auto}}",
    });
    show("👤 사용자 정보가 변경되었습니다");
  };

  const clearUser = () => {
    Sentry.setUser(null);
    show("🚫 사용자 정보가 초기화되었습니다");
  };

  const setCustomTag = () => {
    const tags = ['프리미엄', '무료체험', 'VIP', '기업용'];
    const pick = tags[Math.floor(Math.random() * tags.length)];
    Sentry.setTag("회원등급", pick);
    show(`🏷️ 태그 설정: 회원등급 = ${pick}`);
  };

  const setCustomContext = () => {
    Sentry.setContext("주문 정보", {
      주문번호: "ORD-" + Math.floor(Math.random() * 10000),
      상품명: "프리미엄 플랜",
      금액: "₩59,000",
      결제수단: "신용카드",
    });
    show("📦 커스텀 컨텍스트(주문 정보)가 설정되었습니다");
  };

  const setExtra = () => {
    Sentry.setExtra("디버그_데이터", {
      lastAction: "button_click",
      timestamp: Date.now(),
      randomPayload: Array.from({ length: 5 }, () => Math.random().toFixed(3)),
    });
    show("📎 Extra 데이터가 설정되었습니다");
  };

  const captureWithScope = () => {
    Sentry.withScope((scope) => {
      scope.setTag("scope_테스트", "격리된_태그");
      scope.setLevel("warning");
      scope.setFingerprint(["custom-scope-test"]);
      scope.setContext("Scope 전용 정보", {
        설명: "이 컨텍스트는 이 이벤트에만 첨부됩니다",
        시간: new Date().toLocaleTimeString(),
      });
      Sentry.captureMessage("Scope를 이용해 격리된 태그와 컨텍스트로 전송된 메시지입니다.");
    });
    show("🔒 withScope로 격리된 이벤트가 전송되었습니다");
  };

  const captureWithFingerprint = () => {
    Sentry.captureException(
      new Error("커스텀 핑거프린트 테스트 에러"),
      { fingerprint: ["custom-fingerprint-group"] }
    );
    show("🔑 커스텀 핑거프린트로 그룹화된 에러 전송");
  };

  return (
    <div>
      <h2 className="page-title">Context & Scope 관리</h2>
      <p className="page-desc">사용자 정보, 태그, 커스텀 컨텍스트, Extra 데이터를 설정하여 에러 진단 시 풍부한 맥락을 제공합니다.</p>

      <div className="card">
        <div className="card-title">사용자 정보 (setUser)</div>
        <div className="card-desc">사용자 식별 정보를 설정하면 에러 발생 시 어떤 사용자에게 영향을 미쳤는지 추적할 수 있습니다.</div>
        <div className="btn-row">
          <button className="btn btn-blue" onClick={updateUser}>👤 사용자 변경</button>
          <button className="btn btn-dark" onClick={clearUser}>🚫 사용자 초기화</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">태그 & 컨텍스트 (setTag / setContext / setExtra)</div>
        <div className="card-desc">태그는 이벤트 검색/필터에, 컨텍스트는 에러 상세 화면에, Extra는 추가 디버그 데이터로 활용됩니다.</div>
        <div className="btn-row">
          <button className="btn btn-purple" onClick={setCustomTag}>🏷️ 태그 설정</button>
          <button className="btn btn-cyan" onClick={setCustomContext}>📦 컨텍스트 설정</button>
          <button className="btn btn-gray" onClick={setExtra}>📎 Extra 설정</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Scope 격리 & 핑거프린트</div>
        <div className="card-desc">withScope로 특정 이벤트에만 태그/컨텍스트를 첨부하거나, fingerprint로 이슈 그룹을 커스터마이징합니다.</div>
        <div className="btn-row">
          <button className="btn btn-green" onClick={captureWithScope}>🔒 withScope 전송</button>
          <button className="btn btn-orange" onClick={captureWithFingerprint}>🔑 커스텀 핑거프린트</button>
        </div>
      </div>

      {el}
    </div>
  );
}

// ═══════════════════════════════════════
//  Error Boundary
// ═══════════════════════════════════════
function BuggyComponent() {
  const [crash, setCrash] = useState(false);
  if (crash) { throw new Error("React Error Boundary에 의해 잡힌 렌더링 에러입니다!"); }
  return (
    <button className="btn btn-red" onClick={() => setCrash(true)}>💣 렌더링 에러 발생</button>
  );
}

function ErrorBoundaryPage() {
  return (
    <div>
      <h2 className="page-title">Error Boundary</h2>
      <p className="page-desc">React 렌더링 중 발생하는 에러를 Sentry.ErrorBoundary가 자동으로 캡처합니다. 에러 발생 시 Fallback UI가 표시됩니다.</p>

      <div className="card">
        <div className="card-title">Sentry.ErrorBoundary 데모</div>
        <div className="card-desc">버튼 클릭 시 컴포넌트 렌더링 중 에러가 발생하며, Fallback UI로 대체되고 에러가 Sentry로 전송됩니다.</div>
        <Sentry.ErrorBoundary
          fallback={({ resetError }) => (
            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--accent-red)', fontWeight: 600, marginBottom: '0.5rem' }}>⛔ 렌더링 에러가 발생했습니다!</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>이 에러는 Sentry.ErrorBoundary에 의해 자동으로 Sentry에 전송되었습니다.</p>
              <button className="btn btn-dark btn-sm" onClick={resetError}>🔄 다시 시도</button>
            </div>
          )}
          showDialog
          dialogOptions={{ title: "렌더링 에러가 발생했습니다!", subtitle: "어떤 작업을 하고 있었는지 알려주세요." }}
        >
          <BuggyComponent />
        </Sentry.ErrorBoundary>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════
//  메인 App 레이아웃
// ═══════════════════════════════════════
const tabs = [
  { path: '/', label: '에러 & 브레드크럼', icon: '💥' },
  { path: '/spans', label: '성능 (Spans)', icon: '⚡' },
  { path: '/metrics', label: '메트릭', icon: '📊' },
  { path: '/logs', label: '로그', icon: '📋' },
  { path: '/context', label: 'Context & Scope', icon: '🔧' },
  { path: '/feedback', label: '유저 피드백', icon: '💬' },
  { path: '/error-boundary', label: 'Error Boundary', icon: '🛡️' },
];

function App() {
  const location = useLocation();

  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `${location.pathname} 페이지로 이동`,
      level: 'info',
    });
  }, [location]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>🔭 <span>Sentry</span> 테스트 대시보드</h1>
        <p className="app-subtitle">Sentry SDK의 다양한 기능들을 직접 테스트해 보세요. 라우팅 추적 & Session Replay 활성화됨.</p>
      </header>

      <div className="status-bar">
        <div className="status-chip"><span className="dot"></span> SDK v10.56.0</div>
        <div className="status-chip">🧑 서정현</div>
        <div className="status-chip">🏷️ env: development</div>
        <div className="status-chip">📦 release: 1.0.0</div>
        <div className="status-chip">🎬 Replay: ON</div>
      </div>

      <nav className="nav-tabs">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            {tab.icon} {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="page-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/spans" element={<SpansPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/context" element={<ContextPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/error-boundary" element={<ErrorBoundaryPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
