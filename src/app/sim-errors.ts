/**
 * Turn raw ngspice / worker errors into a friendly, translated title + hint,
 * keeping the raw text for the "Show ngspice output" disclosure.
 */
import type { SimulateError } from '@/shared/types';
import type { LocaleKey } from './i18n';

export interface FriendlyError {
  title: string;
  hint?: string;
  detail: string;
}

export function friendlySimError(e: SimulateError, t: (k: LocaleKey) => string): FriendlyError {
  const raw = [...(e.rawErrors ?? []), e.rawInfo ?? ''].join('\n').trim();
  const lower = `${e.message}\n${raw}`.toLowerCase();
  const pick = (k: LocaleKey, h?: LocaleKey): FriendlyError => ({ title: t(k), hint: h ? t(h) : undefined, detail: raw });
  if (e.message === 'timeout') return pick('err.timeout', 'err.timeoutHint');
  if (e.message === 'worker-crashed') return pick('err.crash');
  if (/singular matrix|gmin stepping failed|source stepping failed.*\n.*singular/.test(lower)) return pick('err.singular', 'err.singularHint');
  if (/timestep too small|convergence|iteration limit|no convergence/.test(lower)) return pick('err.converge', 'err.convergeHint');
  if (/unknown model|could not find.*model|model .* not found|undefined model/.test(lower)) return pick('err.model', 'err.modelHint');
  if (/no simulations run|no analysis|nothing to simulate/.test(lower)) return pick('err.noAnalysis', 'err.noAnalysisHint');
  if (/unknown|parse|syntax|unrecognized|circuit not parsed|too few|cannot/.test(lower)) return pick('err.parse', 'err.parseHint');
  return { title: t('err.generic'), detail: raw || e.message };
}
