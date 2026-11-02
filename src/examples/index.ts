/**
 * Bundled example circuits
 * Netlists are imported as raw strings via Vite's ?raw query
 */
import rcLowpassNet from './rc-lowpass.net?raw';
import rlNet from './rl.net?raw';
import rlcRingingNet from './rlc-ringing.net?raw';
import diodeRectifierNet from './diode-rectifier.net?raw';
import bjtCommonEmitterNet from './bjt-common-emitter.net?raw';
import opampInvertingNet from './opamp-inverting.net?raw';
import type { SampleAsset } from '@/shared/types';

export const EXAMPLE_CIRCUITS: SampleAsset[] = [
  {
    id: 'rc-lowpass',
    svgPath: '/samples/rc-lowpass.svg',
    netlistText: rcLowpassNet,
  },
  {
    id: 'rl',
    svgPath: '/samples/rl.svg',
    netlistText: rlNet,
  },
  {
    id: 'rlc-ringing',
    svgPath: '/samples/rlc-ringing.svg',
    netlistText: rlcRingingNet,
  },
  {
    id: 'diode-rectifier',
    svgPath: '/samples/diode-rectifier.svg',
    netlistText: diodeRectifierNet,
  },
  {
    id: 'bjt-common-emitter',
    svgPath: '/samples/bjt-common-emitter.svg',
    netlistText: bjtCommonEmitterNet,
  },
  {
    id: 'opamp-inverting',
    svgPath: '/samples/opamp-inverting.svg',
    netlistText: opampInvertingNet,
  },
];
