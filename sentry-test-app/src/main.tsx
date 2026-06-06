import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router-dom";
import * as Sentry from "@sentry/react";
import './index.css'
import App from './App.tsx'

Sentry.init({
  dsn: "https://c29ee852df97d382712b30f9fba928e7@o4511465917513728.ingest.de.sentry.io/4511465921970256",
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    Sentry.feedbackIntegration({
      colorScheme: "dark",
      isNameRequired: true,
      isEmailRequired: true,
      enableScreenshot: true,
      buttonLabel: "버그 신고",
      submitButtonLabel: "의견 보내기",
      messagePlaceholder: "어떤 문제가 발생했나요? 자세히 알려주세요.",
      formTitle: "사용자 피드백",
      nameLabel: "이름",
      namePlaceholder: "이름을 입력해주세요",
      emailLabel: "이메일",
      emailPlaceholder: "이메일 주소를 입력해주세요",
      messageLabel: "내용",
      cancelButtonLabel: "취소",
      successMessageText: "소중한 의견 감사합니다!",
      addScreenshotButtonLabel: "스크린샷 첨부",
      removeScreenshotButtonLabel: "스크린샷 제거",
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserProfilingIntegration(),
  ],
  enableLogs: true,
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  profileSessionSampleRate: 1.0,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  environment: "development",
  release: "sentry-test-app@1.0.0",
});

// --- Set User Context ---
Sentry.setUser({
  id: "test-user-001",
  username: "서정현",
  email: "jhseo@example.com",
  ip_address: "{{auto}}",
});

// --- Set Global Tags ---
Sentry.setTag("app.name", "sentry-test-app");
Sentry.setTag("app.version", "1.0.0");
Sentry.setTag("team", "platform");

// --- Set Custom Context ---
Sentry.setContext("앱 설정", {
  테마: "다크",
  언어: "한국어",
  시작시간: new Date().toISOString(),
});

Sentry.setContext("장치 정보", {
  화면크기: `${window.innerWidth}x${window.innerHeight}`,
  브라우저언어: navigator.language,
  플랫폼: navigator.platform,
  온라인: navigator.onLine,
});

const router = createBrowserRouter([
  {
    path: "*",
    element: <App />,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
