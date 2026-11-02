/**
 * Summarise simulation results into compact form for LLM explanation
 */

import { SimResult, AnalysisType, CompactSummary } from '@/shared/types';

/**
 * Extract numeric values from either real or complex array
 */
function extractRealValues(values: number[] | Array<{ real: number; img: number }>): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const first = values[0];
  if (typeof first === 'number') {
    return values as number[];
  }

  // If it's an object with real/img properties
  return (values as Array<{ real: number; img: number }>).map((v) => v.real);
}

/**
 * Estimate time constant (tau) from first-order transient response
 * Assumes exponential approach: V(t) = Vfinal * (1 - exp(-t/tau))
 * Looks for 63.2% point from min/max
 */
function estimateTau(timeValues: number[], voltageValues: number[]): number | null {
  if (timeValues.length < 2 || voltageValues.length < 2) {
    return null;
  }

  const vMin = Math.min(...voltageValues);
  const vMax = Math.max(...voltageValues);
  const vRange = vMax - vMin;

  if (vRange < 1e-10) {
    return null; // No variation
  }

  // For step response starting from vMin, 63.2% point is at 0.632 * vRange + vMin
  const target63 = vMin + 0.632 * vRange;

  // Find crossing point
  for (let i = 0; i < timeValues.length - 1; i++) {
    const v1 = voltageValues[i];
    const v2 = voltageValues[i + 1];
    const t1 = timeValues[i];
    const t2 = timeValues[i + 1];

    if ((v1 <= target63 && v2 >= target63) || (v1 >= target63 && v2 <= target63)) {
      // Linear interpolation
      const tau = t1 + ((target63 - v1) / (v2 - v1)) * (t2 - t1);
      return tau > 0 ? tau : null;
    }
  }

  return null;
}

/**
 * Estimate 10%-90% rise time
 */
function estimateRiseTime(timeValues: number[], voltageValues: number[]): number | null {
  if (timeValues.length < 2 || voltageValues.length < 2) {
    return null;
  }

  const vMin = Math.min(...voltageValues);
  const vMax = Math.max(...voltageValues);
  const vRange = vMax - vMin;

  if (vRange < 1e-10) {
    return null;
  }

  const target10 = vMin + 0.1 * vRange;
  const target90 = vMin + 0.9 * vRange;

  let t10: number | null = null;
  let t90: number | null = null;

  for (let i = 0; i < timeValues.length - 1; i++) {
    const v1 = voltageValues[i];
    const v2 = voltageValues[i + 1];
    const t1 = timeValues[i];
    const t2 = timeValues[i + 1];

    if (
      t10 === null &&
      ((v1 <= target10 && v2 >= target10) || (v1 >= target10 && v2 <= target10))
    ) {
      t10 = t1 + ((target10 - v1) / (v2 - v1)) * (t2 - t1);
    }

    if (
      t90 === null &&
      ((v1 <= target90 && v2 >= target90) || (v1 >= target90 && v2 <= target90))
    ) {
      t90 = t1 + ((target90 - v1) / (v2 - v1)) * (t2 - t1);
    }

    if (t10 !== null && t90 !== null) {
      break;
    }
  }

  if (t10 !== null && t90 !== null && t90 > t10) {
    return t90 - t10;
  }

  return null;
}

/**
 * Detect overshoot: find if max exceeds final by > 2%
 */
function detectOvershoot(voltageValues: number[]): boolean {
  if (voltageValues.length < 2) {
    return false;
  }

  const vMax = Math.max(...voltageValues);
  const vFinal = voltageValues[voltageValues.length - 1];

  return vMax > vFinal * 1.02;
}

/**
 * Find max absolute value and its frequency (for AC analysis)
 */
function findPeakGain(
  frequencyValues: number[],
  magnitudeDb: number[]
): { gain: number; frequency: number } | null {
  if (magnitudeDb.length === 0) {
    return null;
  }

  let maxGain = magnitudeDb[0];
  let maxIdx = 0;

  for (let i = 1; i < magnitudeDb.length; i++) {
    if (magnitudeDb[i] > maxGain) {
      maxGain = magnitudeDb[i];
      maxIdx = i;
    }
  }

  return {
    gain: maxGain,
    frequency: frequencyValues[maxIdx] || 0,
  };
}

/**
 * Find –3dB point relative to max gain
 */
function find3dbPoint(magnitudeDb: number[]): number | null {
  if (magnitudeDb.length < 2) {
    return null;
  }

  const maxGain = Math.max(...magnitudeDb);
  const target = maxGain - 3;

  // Find first crossing below max – 3 dB
  for (let i = 0; i < magnitudeDb.length - 1; i++) {
    if (magnitudeDb[i] >= target && magnitudeDb[i + 1] < target) {
      return i;
    }
  }

  return null;
}

/**
 * Summarise transient analysis (.tran)
 */
function summariseTransient(result: SimResult): CompactSummary {
  if (!result.data || result.data.length === 0) {
    return {
      analysisType: 'tran',
      analysisTime: undefined,
      minValue: undefined,
      maxValue: undefined,
      finalValue: undefined,
      riseTime: undefined,
      tau: undefined,
      overshoot: false,
      notes: 'No data returned',
    };
  }

  // Time is first channel
  const timeData = result.data[0];
  const timeValues = extractRealValues(timeData.values);

  // Get voltage data (usually second channel or first non-time channel)
  const voltageData = result.data.length > 1 ? result.data[1] : result.data[0];
  const voltageValues = extractRealValues(voltageData.values);

  const minVal = Math.min(...voltageValues);
  const maxVal = Math.max(...voltageValues);
  const finalVal = voltageValues[voltageValues.length - 1];
  const tau = estimateTau(timeValues, voltageValues);
  const riseTime = estimateRiseTime(timeValues, voltageValues);
  const overshoot = detectOvershoot(voltageValues);

  return {
    analysisType: 'tran',
    analysisTime: timeValues[timeValues.length - 1],
    minValue: minVal,
    maxValue: maxVal,
    finalValue: finalVal,
    riseTime: riseTime !== null ? riseTime : undefined,
    tau: tau !== null ? tau : undefined,
    overshoot,
    notes: overshoot ? 'Ringing detected' : undefined,
  };
}

/**
 * Summarise AC analysis (.ac)
 */
function summariseAc(result: SimResult): CompactSummary {
  if (!result.data || result.data.length < 2) {
    return {
      analysisType: 'ac',
      notes: 'Insufficient data',
    };
  }

  // Frequency is first channel
  const freqData = result.data[0];
  const freqValues = extractRealValues(freqData.values);

  // Magnitude is usually second channel; convert to dB if needed
  const magData = result.data[1];
  let magDb = extractRealValues(magData.values);

  // If values are linear (not dB), convert to dB
  if (magDb.length > 0 && Math.max(...magDb) < 100) {
    magDb = magDb.map((m) => 20 * Math.log10(Math.max(m, 1e-10)));
  }

  const peak = findPeakGain(freqValues, magDb);
  const db3idx = find3dbPoint(magDb);
  const db3freq = db3idx !== null ? freqValues[db3idx] : undefined;

  return {
    analysisType: 'ac',
    peakGain: peak?.gain,
    peakFrequency: peak?.frequency,
    db3Frequency: db3freq,
    notes: `Peak gain ${peak?.gain?.toFixed(2)}dB at ${peak?.frequency?.toExponential(2)}Hz`,
  };
}

/**
 * Summarise DC sweep analysis (.dc)
 */
function summariseDc(result: SimResult): CompactSummary {
  if (!result.data || result.data.length < 2) {
    return {
      analysisType: 'dc',
      notes: 'Insufficient data',
    };
  }

  const yData = result.data[1];
  const yValues = extractRealValues(yData.values);

  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  return {
    analysisType: 'dc',
    minValue: yMin,
    maxValue: yMax,
    notes: `DC sweep range: ${yMin.toFixed(3)} to ${yMax.toFixed(3)}`,
  };
}

/**
 * Summarise operating point (.op)
 */
function summariseOp(result: SimResult): CompactSummary {
  const summary: CompactSummary = {
    analysisType: 'op',
  };

  if (result.data && result.data.length > 0) {
    // Collect node voltages
    const nodeVoltages: Record<string, number> = {};
    for (let i = 0; i < result.data.length; i++) {
      const name = result.variableNames[i] || `node${i}`;
      const values = extractRealValues(result.data[i].values);
      if (values.length > 0) {
        nodeVoltages[name] = values[0];
      }
    }
    summary.nodeVoltages = nodeVoltages;
    summary.notes = `${Object.keys(nodeVoltages).length} node voltages computed`;
  }

  return summary;
}

/**
 * Main summarisation function
 */
export function summariseResult(result: SimResult, analysisType?: AnalysisType): CompactSummary {
  let summary: CompactSummary;

  if (analysisType === 'ac' || (result.dataType === 'complex' && !analysisType)) {
    summary = summariseAc(result);
  } else if (analysisType === 'dc') {
    summary = summariseDc(result);
  } else if (analysisType === 'op') {
    summary = summariseOp(result);
  } else {
    // Default to transient
    summary = summariseTransient(result);
  }

  return summary;
}

/**
 * Trim summary to stay under token budget
 */
export function trimSummary(summary: CompactSummary): CompactSummary {
  const json = JSON.stringify(summary);
  if (json.length <= 2000) {
    return summary;
  }

  // Trim decimal places progressively
  const trimmed = JSON.parse(JSON.stringify(summary)) as CompactSummary;
  let decimals = 3;

  while (JSON.stringify(trimmed).length > 2000 && decimals >= 0) {
    decimals--;
    // Recursively trim all numbers in the summary
    const trimNumeric = (obj: unknown): void => {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }
      const record = obj as Record<string, unknown>;
      Object.keys(record).forEach((key) => {
        const val = record[key];
        if (typeof val === 'number' && !Number.isInteger(val)) {
          record[key] = decimals >= 0 ? parseFloat(val.toFixed(decimals)) : Math.round(val);
        } else if (typeof val === 'object' && val !== null) {
          trimNumeric(val);
        }
      });
    };

    trimNumeric(trimmed);
  }

  // If still too long, remove optional fields
  if (JSON.stringify(trimmed).length > 2000) {
    if (trimmed.notes) {
      trimmed.notes = trimmed.notes.slice(0, 50) + '...';
    }
  }

  return trimmed;
}
