/**
 * Circuit Séance - Main application shell
 */
import { useEffect, useState } from 'react';
import type { AppSettings } from '@/shared/types';
import { LanguageContext, getLocale } from './i18n';
import './app.css';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>({
    llm: null,
    storageMode: 'session',
    language: 'en',
  });

  const locale = getLocale(settings.language);

  const handleSetLanguage = (lang: AppSettings['language']) => {
    setSettings((s) => ({ ...s, language: lang }));
  };

  useEffect(() => {
    // Load settings from sessionStorage/localStorage on mount
    const stored =
      sessionStorage.getItem('seance-settings') || localStorage.getItem('seance-settings');
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {
        // Silently fail if stored settings are invalid
      }
    }
  }, []);

  useEffect(() => {
    // Persist settings to sessionStorage or localStorage
    const target = settings.storageMode === 'local' ? localStorage : sessionStorage;
    target.setItem('seance-settings', JSON.stringify(settings));
  }, [settings]);

  return (
    <LanguageContext.Provider
      value={{
        language: settings.language,
        setLanguage: handleSetLanguage,
        locale,
        t: (key) => locale[key] ?? key,
      }}
    >
      <div className="app-container">
        <header className="app-header">
          <div className="app-title">
            <h1>{locale['app.title']}</h1>
          </div>
          <div className="app-controls">
            <button
              className="nav-button"
              onClick={() => handleSetLanguage(settings.language === 'en' ? 'zh-CN' : 'en')}
              aria-label={locale['nav.language']}
            >
              {settings.language === 'en' ? locale['nav.languageZh'] : locale['nav.languageEn']}
            </button>
            <button className="nav-button" aria-label={locale['nav.settings']}>
              ⚙️
            </button>
          </div>
        </header>

        <main className="app-main">
          <section className="panel panel-left">
            <h2>{locale['capture.title']}</h2>
            <p>{locale['app.tagline']}</p>
          </section>

          <section className="panel panel-right">
            <h2>{locale['scope.title']}</h2>
            <canvas
              data-testid="scope-canvas"
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--crt-bg)',
                border: '1px solid var(--crt-phosphor-green)',
              }}
            />
          </section>
        </main>

        <footer className="app-status-bar">
          <div className="status-message" aria-live="polite" aria-atomic="true">
            {locale['status.idle']}
          </div>
        </footer>

        <style>{`
          .app-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background-color: var(--crt-bg);
        }

        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-md) var(--space-lg);
          border-bottom: 1px solid var(--crt-phosphor-green);
          background-color: rgba(57, 255, 20, 0.02);
        }

        .app-title h1 {
          margin: 0;
          font-size: var(--font-size-xl);
          color: var(--crt-phosphor-green);
          text-shadow: 0 0 8px rgba(57, 255, 20, 0.3);
        }

        .app-controls {
          display: flex;
          gap: var(--space-md);
        }

        .nav-button {
          min-width: 44px;
          min-height: 44px;
          padding: var(--space-sm) var(--space-md);
          background-color: transparent;
          border: 1px solid var(--crt-phosphor-green);
          color: var(--crt-phosphor-green);
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .nav-button:hover {
          background-color: rgba(57, 255, 20, 0.1);
          box-shadow: 0 0 8px rgba(57, 255, 20, 0.2);
        }

        .nav-button:focus-visible {
          outline: 2px solid var(--crt-phosphor-green);
          outline-offset: 1px;
        }

        .app-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-md);
          flex: 1;
          padding: var(--space-lg);
          overflow: hidden;
        }

        @media (max-width: 1023px) {
          .app-main {
            grid-template-columns: 1fr;
            gap: var(--space-md);
          }
        }

        .panel {
          border: 1px solid var(--crt-phosphor-green);
          background-color: rgba(57, 255, 20, 0.02);
          padding: var(--space-md);
          overflow: auto;
        }

        .panel h2 {
          margin: 0 0 var(--space-md) 0;
          font-size: var(--font-size-lg);
          color: var(--crt-phosphor-green);
          text-shadow: 0 0 8px rgba(57, 255, 20, 0.2);
        }

        .panel-left {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .panel-right {
          display: flex;
          flex-direction: column;
        }

        .app-status-bar {
          padding: var(--space-md) var(--space-lg);
          border-top: 1px solid var(--crt-phosphor-green);
          background-color: rgba(57, 255, 20, 0.02);
          font-size: var(--font-size-sm);
          color: var(--crt-phosphor-green);
        }

        .status-message {
          min-height: 1.5em;
        }
        `}</style>
      </div>
    </LanguageContext.Provider>
  );
}
