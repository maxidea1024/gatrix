import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/fonts.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  // StrictMode는 개발 모드에서 useEffect를 두 번 실행하여 중복 오류 toast 발생
  // 프로덕션에서는 영향 없음
  process.env.NODE_ENV === 'production' ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
);
