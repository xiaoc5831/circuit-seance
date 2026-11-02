/**
 * Circuit Séance - Main application shell
 */
import { useEffect, useState } from 'react';
import type { AppSettings, AnalysisType } from '@/shared/types';
import { LanguageContext, getLocale } from './i18n';
import { NetlistEditor } from '@/features/netlist';
import { useSimulation } from '@/features/simulate';
import { ScopeCanvas, ScopeControls, type ScopeViewState } from '@/features/scope';
import { EXAMPLE_CIRCUITS } from '@/examples';
import './app.css';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>({
    llm: null,
    storageMode: 'session',
    language: 'en',
  });

  const [netlistText, setNetlistText] = useState('');
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('tran');
  const [viewState, setViewState] = useState<ScopeViewState>({
    voltsPerDiv: 1,
    timePerDiv: 0.1,
    channels: [
      { enabled: true, variableIndex: 1, color: '#39ff14' },
      { enabled: false, variableIndex: 2, color: '#00ff00' },
      { enabled: false, variableIndex: 3, color: '#00aa00' },
      { enabled: false, variableIndex: 4, color: '#005500' },
    ],
    analysisType,
  });

  const { state: simState, result: simResult, error: simError, simulate } = useSimulation();
  const locale = getLocale(settings.language);

  // Extract analysis type from netlist
  useEffect(() => {
    const match = netlistText.match(/\.(tran|ac|dc|op)\b/i);
    if (match) {
      const newType = (match[1].toLowerCase() as AnalysisType) || 'tran';
      setAnalysisType(newType);
      setViewState((v) => ({ ...v, analysisType: newType }));
    }
  }, [netlistText]);

  // Update sim result in scope
  useEffect(() => {
    if (simResult?.data.length && simResult.data.length > 1) {
      // Auto-scale: find a voltsPerDiv that fits ~80% of screen
      const oneTwoFive = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
      const voltData = simResult.data.slice(1).flatMap((ch) => {
        if (typeof ch.values[0] === 'number') return ch.values as number[];
        return [];
      });
      const maxVolt = Math.max(...voltData, 1);
      const minVolt = Math.min(...voltData, 0);
      const voltRange = Math.abs(maxVolt - minVolt) || 1;
      for (let vpd of oneTwoFive) {
        if (voltRange / vpd <= 6.4) {
          setViewState((v) => ({ ...v, voltsPerDiv: vpd }));
          break;
        }
      }
    }
  }, [simResult]);

  const handleSetLanguage = (lang: AppSettings['language']) => {
    setSettings((s) => ({ ...s, language: lang }));
  };

  const handleLoadExample = (exampleId: string) => {
    const example = EXAMPLE_CIRCUITS.find((e) => e.id === exampleId);
    const text = example?.netlistText;
    if (text) {
      setNetlistText(text);
      setSelectedExampleId(exampleId);
      // Automatically simulate
      setTimeout(() => {
        simulate(text);
      }, 0);
    }
  };

  const handleSimulate = () => {
    simulate(netlistText);
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

  const errorMessage: string = (simError?.message) || locale['status.error'];

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
            <p className="subtitle">{locale['app.subtitle']}</p>
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
            <h2>{locale['examples.title']}</h2>
            <div className="examples-list">
              {EXAMPLE_CIRCUITS.map((ex) => (
                <button
                  key={ex.id}
                  className={`example-button ${selectedExampleId === ex.id ? 'active' : ''}`}
                  onClick={() => handleLoadExample(ex.id)}
                  aria-label={ex.id}
                >
                  {ex.id}
                </button>
              ))}
            </div>

            <h2 style={{ marginTop: '24px' }}>{locale['netlist.title']}</h2>
            <NetlistEditor
              value={netlistText}
              onChange={setNetlistText}
              onSimulate={handleSimulate}
              className="netlist-editor"
            />
            <button className="simulate-button" onClick={handleSimulate} aria-label="Simulate">
              {locale['netlist.simulate']}
            </button>
          </section>

          <section className="panel panel-right">
            <h2>{locale['scope.title']}</h2>
            <div
              className="scope-display"
              data-testid="sim-status"
              aria-live="polite"
              aria-atomic="true"
            >
              <ScopeCanvas
                simResult={simResult}
                locale={locale}
                analysisType={analysisType}
                voltsPerDiv={viewState.voltsPerDiv}
                timePerDiv={viewState.timePerDiv}
                channels={viewState.channels}
              />
            </div>
            <ScopeControls
              viewState={viewState}
              simResult={simResult}
              locale={locale}
              onViewStateChange={setViewState}
            />
          </section>
        </main>

        <footer className="app-status-bar">
          <div className="status-message">
            {simState === 'idle' && locale['status.idle']}
            {simState === 'loading' && locale['status.loading']}
            {simState === 'running' && locale['status.running']}
            {simState === 'complete' && locale['status.complete']}
            {simState === 'error' && errorMessage}
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

          .app-title {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .app-title h1 {
            margin: 0;
            font-size: var(--font-size-xl);
            color: var(--crt-phosphor-green);
            text-shadow: 0 0 8px rgba(57, 255, 20, 0.3);
          }

          .subtitle {
            margin: 0;
            font-size: var(--font-size-sm);
            color: rgba(57, 255, 20, 0.6);
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
            display: flex;
            flex-direction: column;
            gap: var(--space-md);
          }

          .panel h2 {
            margin: 0;
            font-size: var(--font-size-lg);
            color: var(--crt-phosphor-green);
            text-shadow: 0 0 8px rgba(57, 255, 20, 0.2);
          }

          .panel-left {
            flex-direction: column;
          }

          .panel-right {
            flex: 1;
            overflow: hidden;
          }

          .examples-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
          }

          .example-button {
            padding: 8px 12px;
            background-color: transparent;
            border: 1px solid var(--crt-phosphor-green);
            color: var(--crt-phosphor-green);
            font-family: var(--font-mono);
            font-size: 11px;
            cursor: pointer;
            transition: all 200ms;
            text-transform: uppercase;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .example-button:hover {
            background-color: rgba(57, 255, 20, 0.1);
            box-shadow: 0 0 8px rgba(57, 255, 20, 0.2);
          }

          .example-button.active {
            background-color: rgba(57, 255, 20, 0.3);
            box-shadow: inset 0 0 8px rgba(57, 255, 20, 0.3);
          }

          .netlist-editor {
            flex: 1;
            min-height: 200px;
            overflow: auto;
          }

          .simulate-button {
            min-width: 100px;
            min-height: 44px;
            padding: 8px 16px;
            background-color: transparent;
            border: 1px solid var(--crt-phosphor-green);
            color: var(--crt-phosphor-green);
            font-family: var(--font-mono);
            font-size: var(--font-size-sm);
            font-weight: bold;
            cursor: pointer;
            transition: all 200ms;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .simulate-button:hover {
            background-color: rgba(57, 255, 20, 0.15);
            box-shadow: 0 0 12px rgba(57, 255, 20, 0.4);
            text-shadow: 0 0 8px rgba(57, 255, 20, 0.3);
          }

          .simulate-button:focus-visible {
            outline: 2px solid var(--crt-phosphor-green);
            outline-offset: 1px;
          }

          .scope-display {
            flex: 1;
            min-height: 0;
            display: flex;
            overflow: hidden;
          }

          .app-status-bar {
            padding: var(--space-md) var(--space-lg);
            border-top: 1px solid var(--crt-phosphor-green);
            background-color: rgba(57, 255, 20, 0.02);
            font-size: var(--font-size-sm);
            color: var(--crt-phosphor-green);
            font-family: var(--font-mono);
            min-height: 1.5em;
          }

          .status-message {
            min-height: 1.5em;
          }
        `}</style>
      </div>
    </LanguageContext.Provider>
  );
}
