import { describe, it, expect } from 'vitest';
import { summariseResult, trimSummary } from '@/features/simulate';

function generateRcTransientFixture() {
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
    dataType: 'real' as const,
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

function generateRlcRingingFixture() {
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
    const phase = Math.cos(wd * t) + ((zeta * wn) / wd) * Math.sin(wd * t);
    const v = 5 * (1 - envelope * phase);
    timeValues.push(t);
    voltageValues.push(v);
  }

  return {
    header: 'RLC Ringing Transient',
    numVariables: 2,
    variableNames: ['time', 'v(out)'],
    numPoints: npoints,
    dataType: 'real' as const,
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

describe('result-summariser', () => {
  describe('summariseResult - transient', () => {
    it('should summarise RC transient with correct tau', () => {
      const result = generateRcTransientFixture();
      const summary = summariseResult(result, 'tran');

      expect(summary.analysisType).toBe('tran');
      expect(summary.finalValue).toBeCloseTo(5, 1); // Should approach 5V
      expect(summary.minValue).toBeCloseTo(0, 1); // Should start near 0V
      expect(summary.tau).toBeDefined();
      expect(summary.tau!).toBeCloseTo(0.001, 4); // tau = 1ms ±1%
    });

    it('should estimate rise time for RC transient', () => {
      const result = generateRcTransientFixture();
      const summary = summariseResult(result, 'tran');

      expect(summary.riseTime).toBeDefined();
      // 10-90% rise time should be roughly 2.2 * tau
      const expectedRiseTime = 2.2 * 0.001;
      expect(summary.riseTime!).toBeCloseTo(expectedRiseTime, 2);
    });

    it('should detect overshoot in RLC ringing', () => {
      const result = generateRlcRingingFixture();
      const summary = summariseResult(result, 'tran');

      expect(summary.analysisType).toBe('tran');
      expect(summary.overshoot).toBe(true);
      expect(summary.maxValue).toBeGreaterThan(summary.finalValue! * 1.02);
    });

    it('should return final value correctly', () => {
      const result = generateRcTransientFixture();
      const summary = summariseResult(result, 'tran');

      // Last point should be close to final value
      expect(summary.finalValue).toBeCloseTo(5, 1);
    });
  });

  describe('summariseResult - AC', () => {
    it('should summarise AC result with peak gain', () => {
      const acResult = {
        header: 'AC analysis',
        numVariables: 2,
        variableNames: ['frequency', 'vdb(out)'],
        numPoints: 100,
        dataType: 'real' as const,
        data: [
          {
            name: 'frequency',
            type: 'frequency',
            values: Array.from({ length: 100 }, (_, i) => 10 ** (i * 0.04)), // 10 Hz to 100 kHz
          },
          {
            name: 'vdb(out)',
            type: 'voltage',
            values: Array.from({ length: 100 }, (_, i) => {
              // Simulated low-pass: peak at low freq, -3dB at ~1kHz
              const f = 10 ** (i * 0.04);
              return 0 - 20 * Math.log10(Math.sqrt(1 + (f / 1000) ** 2));
            }),
          },
        ],
      };

      const summary = summariseResult(acResult, 'ac');
      expect(summary.analysisType).toBe('ac');
      expect(summary.peakGain).toBeDefined();
      expect(summary.peakFrequency).toBeDefined();
    });
  });

  describe('summariseResult - DC', () => {
    it('should summarise DC sweep result', () => {
      const dcResult = {
        header: 'DC sweep',
        numVariables: 2,
        variableNames: ['v1', 'v(out)'],
        numPoints: 50,
        dataType: 'real' as const,
        data: [
          {
            name: 'v1',
            type: 'voltage',
            values: Array.from({ length: 50 }, (_, i) => (i / 50) * 5),
          },
          {
            name: 'v(out)',
            type: 'voltage',
            values: Array.from({ length: 50 }, (_, i) => ((i / 50) * 5) / 2), // Half of input
          },
        ],
      };

      const summary = summariseResult(dcResult, 'dc');
      expect(summary.analysisType).toBe('dc');
      expect(summary.minValue).toBeCloseTo(0, 1);
      expect(summary.maxValue).toBeCloseTo(2.5, 1);
    });
  });

  describe('summariseResult - OP', () => {
    it('should summarise operating point', () => {
      const opResult = {
        header: 'Operating point',
        numVariables: 3,
        variableNames: ['v(1)', 'v(2)', 'v(3)'],
        numPoints: 1,
        dataType: 'real' as const,
        data: [
          { name: 'v(1)', type: 'voltage', values: [5.0] },
          { name: 'v(2)', type: 'voltage', values: [2.5] },
          { name: 'v(3)', type: 'voltage', values: [0.0] },
        ],
      };

      const summary = summariseResult(opResult, 'op');
      expect(summary.analysisType).toBe('op');
      expect(summary.nodeVoltages).toBeDefined();
      expect(summary.nodeVoltages!['v(1)']).toBe(5.0);
      expect(summary.nodeVoltages!['v(2)']).toBe(2.5);
      expect(summary.nodeVoltages!['v(3)']).toBe(0.0);
    });
  });

  describe('trimSummary', () => {
    it('should keep summary under 2000 chars', () => {
      const summary = {
        analysisType: 'transient' as const,
        tau: 0.0009999999999999,
        riseTime: 0.0021999999999999,
        minValue: 0.1234567890123456789,
        maxValue: 4.9876543210987654321,
        finalValue: 4.9999999999999,
        overshoot: false,
        notes: 'This is a very long note that should be included in the summary. '.repeat(50),
      };

      const trimmed = trimSummary(summary);
      const json = JSON.stringify(trimmed);
      expect(json.length).toBeLessThanOrEqual(2000);
    });

    it('should preserve key structure', () => {
      const summary = {
        analysisType: 'transient' as const,
        tau: 0.001234567890123456,
      };

      const trimmed = trimSummary(summary);
      expect(trimmed.analysisType).toBe('transient');
      expect(trimmed.tau).toBeDefined();
      expect(typeof trimmed.tau).toBe('number');
    });
  });

  describe('edge cases', () => {
    it('should handle empty data array', () => {
      const emptyResult = {
        header: 'Empty',
        numVariables: 0,
        variableNames: [],
        numPoints: 0,
        dataType: 'real' as const,
        data: [],
      };

      const summary = summariseResult(emptyResult, 'tran');
      expect(summary.analysisType).toBe('tran');
      expect(summary.notes).toContain('No data');
    });

    it('should handle complex values by extracting real part', () => {
      const complexResult = {
        header: 'Complex',
        numVariables: 2,
        variableNames: ['time', 'v(out)'],
        numPoints: 10,
        dataType: 'complex' as const,
        data: [
          {
            name: 'time',
            type: 'time',
            values: Array.from({ length: 10 }, (_, i) => i * 0.001),
          },
          {
            name: 'v(out)',
            type: 'voltage',
            values: Array.from({ length: 10 }, (_, i) => ({
              real: i * 0.5,
              img: i * 0.1,
            })),
          },
        ],
      };

      const summary = summariseResult(complexResult, 'ac');
      expect(summary).toBeDefined();
    });
  });
});
