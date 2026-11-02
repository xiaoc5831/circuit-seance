/**
 * RC transient fixture: tau = 1ms, simulated step response
 * V(t) = 5 * (1 - exp(-t/tau))
 * Time range: 0 to 8ms
 */

import { SimResult } from '@/shared/types';

export function generateRcTransientFixture(): SimResult {
  const tau = 0.001; // 1 ms
  const tmax = 0.008; // 8 ms
  const npoints = 1000;

  const timeValues: number[] = [];
  const voltageValues: number[] = [];

  for (let i = 0; i < npoints; i++) {
    const t = (i / (npoints - 1)) * tmax;
    const v = 5 * (1 - Math.exp(-t / tau));
    timeValues.push(t);
    voltageValues.push(v);
  }

  return {
    header: 'RC Low-Pass Transient',
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
