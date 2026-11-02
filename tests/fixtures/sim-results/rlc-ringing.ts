/**
 * RLC ringing fixture: damped sine with overshoot
 * V(t) = 5 * (1 - exp(-zeta*wn*t) * (cos(wd*t) + (zeta*wn/wd)*sin(wd*t)))
 * where wn = sqrt(1/(L*C)), zeta = R/(2*sqrt(L/C)) ~ 0.5 (underdamped)
 */

import { SimResult } from '@/shared/types';

export function generateRlcRingingFixture(): SimResult {
  // Parameters for underdamped response with overshoot
  const wn = 2000; // natural frequency
  const zeta = 0.4; // damping ratio (< 1 for oscillation)
  const wd = wn * Math.sqrt(1 - zeta * zeta); // damped frequency
  const tmax = 0.02; // 20 ms
  const npoints = 800;

  const timeValues: number[] = [];
  const voltageValues: number[] = [];

  for (let i = 0; i < npoints; i++) {
    const t = (i / (npoints - 1)) * tmax;
    const envelope = Math.exp(-zeta * wn * t);
    const phase = Math.cos(wd * t) + (zeta * wn) / wd * Math.sin(wd * t);
    const v = 5 * (1 - envelope * phase);
    timeValues.push(t);
    voltageValues.push(v);
  }

  return {
    header: 'RLC Ringing Transient',
    numVariables: 2,
    variableNames: ['time', 'v(out)'],
    numPoints: npoints,
    dataType: 'real',
    data: [
      {
        name: 'time',
        type: 'time',
        values: timeValues,
      },
      {
        name: 'v(out)',
        type: 'voltage',
        values: voltageValues,
      },
    ],
  };
}
