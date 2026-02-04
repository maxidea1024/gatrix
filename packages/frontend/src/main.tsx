import React from 'react';
import ReactDOM from 'react-dom/client';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import App from './App';
import './styles/fonts.css';
import './styles/global.css';

// Create Emotion cache with explicit insertion point to guarantee init order
const emotionInsertionPoint = document.querySelector<HTMLMetaElement>(
  'meta[name="emotion-insertion-point"]'
);
const emotionCache = createCache({
  key: 'mui',
  insertionPoint: emotionInsertionPoint ?? undefined,
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <CacheProvider value={emotionCache}>
    <App />
  </CacheProvider>
);
