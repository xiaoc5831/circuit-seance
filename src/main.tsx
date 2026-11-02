import React from 'react';
import ReactDOM from 'react-dom/client';
// self-hosted fonts: Google Fonts is slow/blocked in some regions (incl. mainland China)
import '@fontsource/vt323/400.css';
import '@fontsource/share-tech-mono/400.css';
import App from '@/app/App';
import '@/app/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
