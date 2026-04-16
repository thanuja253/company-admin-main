type FyKeys = 'fy1' | 'fy2' | 'fy3' | 'fy4' | 'fy5';

const FY_KEYS: FyKeys[] = ['fy1', 'fy2', 'fy3', 'fy4', 'fy5'];
export const EE_CALCULATED_CHECKLIST_ORDERS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 142] as const;
const ORDER_TO_CALC_KEY: Record<number, string> = {
  8: 'thermal_energy_converted_to_kwh',
  9: 'total_energy_consumption',
  10: 'share_of_electrical_energy_percent',
  11: 'share_of_thermal_energy_percent',
  12: 'specific_electrical_energy_kwh_per_unit',
  13: 'specific_thermal_energy_kwh_per_unit',
  14: 'specific_total_energy_kwh_per_unit',
  15: 'specific_total_energy_gj_per_unit',
  16: 'reduction_in_specific_energy_percent',
  142: 'reduction_in_specific_energy_percent',
};

function normalizeText(v: unknown): string {
  const s = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
  return s
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function toFiniteNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundTo(v: number, decimals = 4): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function thermalToKwh(unit: unknown, quantity: unknown): number {
  const qty = toFiniteNumber(quantity);
  const u = typeof unit === 'string' ? unit.trim() : '';
  if (u === 'GJ') return 277.778 * qty;
  if (u === 'Kcal') return 0.00116222 * qty;
  if (u === 'MTOE') return 11630 * qty;
  if (u === 'kWh') return qty;
  return 0;
}

function fyValues(row: any): Record<FyKeys, number> {
  return {
    fy1: toFiniteNumber(row?.fy1),
    fy2: toFiniteNumber(row?.fy2),
    fy3: toFiniteNumber(row?.fy3),
    fy4: toFiniteNumber(row?.fy4),
    fy5: toFiniteNumber(row?.fy5),
  };
}

export function sanitizeUnit(value: unknown): string {
  const raw = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!raw) return '-';
  // Keep one canonical token for comma-delimited user inputs (e.g. "MT,MT" -> "MT").
  const firstToken = raw
    .split(',')
    .map((x) => x.trim())
    .find(Boolean);
  const normalizedRaw = firstToken || raw;
  const low = normalizedRaw.toLowerCase();
  if (low === 'kwh') return 'kWh';
  if (low === 'gj') return 'GJ';
  if (low === 'kcal') return 'Kcal';
  if (low === 'mtoe') return 'MTOE';
  return normalizedRaw;
}

export function latestByDataId(savedRows: any[]): Map<string, any> {
  const latest = new Map<string, any>();
  for (const row of savedRows || []) {
    const id = row?.data_id?.toString?.() ?? String(row?.data_id ?? '');
    if (!id) continue;
    const prev = latest.get(id);
    if (!prev) {
      latest.set(id, row);
      continue;
    }
    const prevTs = new Date(prev?.updatedAt ?? prev?.createdAt ?? 0).getTime();
    const curTs = new Date(row?.updatedAt ?? row?.createdAt ?? 0).getTime();
    if (curTs >= prevTs) latest.set(id, row);
  }
  return latest;
}

function findByKeywords(rows: any[], keywords: string[]) {
  const keySet = keywords.map((k) => normalizeText(k));
  return (rows || []).find((r) => {
    const text = normalizeText(`${r?.parameter ?? ''} ${r?.checklist_name ?? ''}`);
    return keySet.every((k) => text.includes(k));
  });
}

export function findGiEquivalent(giRows: any[]) {
  return (
    findByKeywords(giRows || [], ['equivalent', 'product']) ||
    (giRows || []).find((r) => Number(r?.checklist_order) === 4)
  );
}

export function findEeInputs(eeRows: any[]): { electrical?: any; thermal?: any } {
  const electrical =
    (eeRows || []).find((r) => Number(r?.checklist_order) === 6) ||
    findByKeywords(eeRows || [], ['electrical', 'energy', 'consumption']);
  const thermal =
    (eeRows || []).find((r) => Number(r?.checklist_order) === 7) ||
    findByKeywords(eeRows || [], ['thermal', 'energy', 'consumption']);
  return { electrical, thermal };
}

export function buildEeCalculatedRows(input: {
  electrical?: any;
  thermal?: any;
  giEq?: any;
  templateEeRows?: any[];
}): any[] {
  const electrical = fyValues(input.electrical);
  const thermal = fyValues(input.thermal);
  const giEq = fyValues(input.giEq);
  const thermalUnit = sanitizeUnit(input.thermal?.reference_unit || 'kWh');

  const thermalKwh: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };
  const totalEnergy: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };
  const shareElectrical: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };
  const shareThermal: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };
  const specificElectrical: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };
  const specificThermal: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };
  const specificTotalKwh: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };
  const specificTotalGj: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };
  const reductionSpecific: Record<FyKeys, number> = { fy1: 0, fy2: 0, fy3: 0, fy4: 0, fy5: 0 };

  for (const fy of FY_KEYS) {
    thermalKwh[fy] = thermalToKwh(thermalUnit, thermal[fy]);
    totalEnergy[fy] = electrical[fy] + thermalKwh[fy];
    shareElectrical[fy] = totalEnergy[fy] > 0 ? (electrical[fy] / totalEnergy[fy]) * 100 : 0;
    shareThermal[fy] = totalEnergy[fy] > 0 ? (thermalKwh[fy] / totalEnergy[fy]) * 100 : 0;

    const base = giEq[fy];
    specificElectrical[fy] = base > 0 ? electrical[fy] / base : 0;
    specificThermal[fy] = base > 0 ? thermalKwh[fy] / base : 0;
    specificTotalKwh[fy] = base > 0 ? totalEnergy[fy] / base : 0;
    specificTotalGj[fy] = specificTotalKwh[fy] / 277.778;
  }

  const baseline = specificTotalKwh.fy1;
  for (const fy of FY_KEYS) {
    reductionSpecific[fy] = baseline > 0 ? ((baseline - specificTotalKwh[fy]) / baseline) * 100 : 0;
  }

  const calcValuesByKey: Record<string, Record<FyKeys, number>> = {
    thermal_energy_converted_to_kwh: thermalKwh,
    total_energy_consumption: totalEnergy,
    share_of_electrical_energy_percent: shareElectrical,
    share_of_thermal_energy_percent: shareThermal,
    specific_electrical_energy_kwh_per_unit: specificElectrical,
    specific_thermal_energy_kwh_per_unit: specificThermal,
    specific_total_energy_kwh_per_unit: specificTotalKwh,
    specific_total_energy_gj_per_unit: specificTotalGj,
    reduction_in_specific_energy_percent: reductionSpecific,
  };

  const rows: any[] = [];
  for (const [orderRaw, key] of Object.entries(ORDER_TO_CALC_KEY)) {
    const order = Number(orderRaw);
    const template = (input.templateEeRows || []).find((r) => Number(r?.checklist_order) === order);
    const value = calcValuesByKey[key];
    const templateBase = template ? { ...template } : {};
    rows.push({
      ...templateBase,
      data_id: template?.data_id ?? `ee_calc_${order}`,
      info_type: 'ee',
      checklist_order: template?.checklist_order ?? order,
      parameter: template?.parameter ?? key.replaceAll('_', ' '),
      reference_unit: sanitizeUnit(template?.reference_unit ?? '-'),
      reference_unit_display: sanitizeUnit(template?.reference_unit ?? '-'),
      details: template?.details ?? '',
      fy1: roundTo(value.fy1),
      fy2: roundTo(value.fy2),
      fy3: roundTo(value.fy3),
      fy4: roundTo(value.fy4),
      fy5: roundTo(value.fy5),
      extrapolated: template?.extrapolated ?? 0,
      document_status: template?.document_status ?? 0,
      final_submit: template?.final_submit ?? 0,
      is_calculated: 1,
    });
  }
  return rows;
}

function byOrder(rows: any[], order: number) {
  return (rows || []).find((r) => Number(r?.checklist_order) === Number(order));
}

function setUnit(row: any | undefined, unit: string) {
  if (!row) return;
  row.reference_unit = unit;
  row.reference_unit_display = unit;
}

/**
 * Calculate EE rows in-place using strict checklist_order mapping.
 * Returns issues when prerequisites are missing instead of throwing.
 */
export function applyEeCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const ee = rows.ee || [];
  const gi = rows.gi || [];
  const issues: string[] = [];

  const eec = byOrder(ee, 6); // electrical input
  const tec = byOrder(ee, 7); // thermal input
  const giEq = byOrder(gi, 4); // GI equivalent product

  if (!eec || !tec) {
    issues.push('Both Electrical energy consumption and Thermal energy consumption rows are required for EE calculations.');
    return { rows, issues };
  }
  if (!giEq) {
    issues.push('GI equivalent product row (checklist_order 4) is required for EE calculations.');
    return { rows, issues };
  }

  const r8 = byOrder(ee, 8);
  const r9 = byOrder(ee, 9);
  const r10 = byOrder(ee, 10);
  const r11 = byOrder(ee, 11);
  const r12 = byOrder(ee, 12);
  const r13 = byOrder(ee, 13);
  const r14 = byOrder(ee, 14);
  const r15 = byOrder(ee, 15);
  const r16 = byOrder(ee, 16);
  const r142 = byOrder(ee, 142);

  const years: Array<FyKeys | 'extrapolated'> = ['fy1', 'fy2', 'fy3', 'fy4', 'fy5', 'extrapolated'];
  for (const y of years) {
    const e = toFiniteNumber(eec?.[y]);
    const t = toFiniteNumber(tec?.[y]);
    const d = toFiniteNumber(giEq?.[y]);
    const tk = thermalToKwh(tec?.reference_unit || tec?.details, t);
    const total = e + tk;

    if (r8) r8[y] = roundTo(tk);
    if (r9) r9[y] = roundTo(total);
    // Guard by total only: if total exists, shares are always computable.
    if (r10) r10[y] = total > 0 ? roundTo((e * 100) / total) : 0;
    if (r11) r11[y] = total > 0 ? roundTo((tk * 100) / total) : 0;
    if (r12) r12[y] = e && d ? roundTo(e / d) : 0;

    // Consistent thermal basis: converted thermal kWh / denominator for all FYs.
    if (r13) r13[y] = tk && d ? roundTo(tk / d) : 0;

    if (r14) r14[y] = total && d ? roundTo(total / d) : 0;
    if (r15) r15[y] = total && d ? roundTo((total / d) / 277.778) : 0;
  }

  // Row 16: N/A for fy1, then year-over-year reduction; extrapolated uses fy4->extrapolated.
  if (r16 && r14) {
    r16.fy1 = 'N/A';
    const r14fy1 = toFiniteNumber(r14.fy1);
    const r14fy2 = toFiniteNumber(r14.fy2);
    const r14fy3 = toFiniteNumber(r14.fy3);
    const r14fy4 = toFiniteNumber(r14.fy4);
    const r14fy5 = toFiniteNumber(r14.fy5);
    const r14Exp = toFiniteNumber(r14.extrapolated);
    r16.fy2 = r14fy1 ? roundTo(((r14fy1 - r14fy2) * 100) / r14fy1) : 0;
    r16.fy3 = r14fy2 ? roundTo(((r14fy2 - r14fy3) * 100) / r14fy2) : 0;
    r16.fy4 = r14fy3 ? roundTo(((r14fy3 - r14fy4) * 100) / r14fy3) : 0;
    r16.fy5 = r14fy4 ? roundTo(((r14fy4 - r14fy5) * 100) / r14fy4) : 0;
    r16.extrapolated = r14fy4 ? roundTo(((r14fy4 - r14Exp) * 100) / r14fy4) : 0;
  }

  // Row 142: N/A markers except baseline-vs-fy4 comparison.
  if (r142 && r15) {
    r142.fy1 = 'N/A';
    r142.fy2 = 'N/A';
    r142.fy3 = 'N/A';
    const r15fy1 = toFiniteNumber(r15.fy1);
    const r15fy4 = toFiniteNumber(r15.fy4);
    r142.fy4 = r15fy1 ? roundTo(((r15fy1 - r15fy4) * 100) / r15fy1) : 0;
    r142.fy5 = 'N/A';
    r142.extrapolated = 'N/A';
  }

  setUnit(r8, 'kWh');
  setUnit(r9, 'kWh');
  setUnit(r10, '%');
  setUnit(r11, '%');
  setUnit(r12, 'kWh/unit');
  setUnit(r13, 'kWh/unit');
  setUnit(r14, 'kWh/unit');
  setUnit(r15, 'GJ/unit');
  setUnit(r16, '%');
  setUnit(r142, '%');

  return { rows, issues };
}

export const WC_CALCULATED_CHECKLIST_ORDERS = [18, 19, 25, 102] as const;

function yearValue(row: any, key: 'fy1' | 'fy2' | 'fy3' | 'fy4' | 'fy5' | 'exp' | 'extrapolated'): number {
  if (!row) return 0;
  if (key === 'exp' || key === 'extrapolated') {
    return toFiniteNumber(row.extrapolated ?? row.exp ?? row.fy5);
  }
  return toFiniteNumber(row[key]);
}

function setYearValue(
  row: any,
  key: 'fy1' | 'fy2' | 'fy3' | 'fy4' | 'fy5' | 'exp' | 'extrapolated',
  value: number | string,
) {
  if (!row) return;
  if (key === 'exp' || key === 'extrapolated') {
    row.extrapolated = value;
    row.fy5 = typeof value === 'number' ? value : row.fy5;
    return;
  }
  row[key] = value;
}

/**
 * Calculate WC rows in-place by checklist_order (17..25,102).
 * Mirrors WaterConservationLibrary behavior and returns issues without throwing.
 */
export function applyWcCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const wc = rows.wc || [];
  const gi = rows.gi || [];
  const issues: string[] = [];

  const r17 = byOrder(wc, 17); // Total fresh water
  const r18 = byOrder(wc, 18); // Specific fresh water
  const r19 = byOrder(wc, 19); // Reduction specific fresh water
  const r20 = byOrder(wc, 20); // Specific process water input
  const r21 = byOrder(wc, 21); // Specific domestic water input
  const r22 = byOrder(wc, 22); // Specific gardening water input
  const r23 = byOrder(wc, 23); // Rain water harvesting potential
  const r24 = byOrder(wc, 24); // Beyond the fence
  const r25 = byOrder(wc, 25); // Water neutral/positive ratio
  const r102 = byOrder(wc, 102); // Baseline reduction
  const giEq = byOrder(gi, 4); // GI equivalent product

  if (!r17) {
    issues.push('WC calculation requires checklist row 17 (Total fresh water consumption).');
    return { rows, issues };
  }
  if (!giEq) {
    issues.push('WC calculation requires GI equivalent product row (checklist_order 4).');
    return { rows, issues };
  }

  // Carry input rows with units from details (legacy behavior).
  if (r17) setUnit(r17, sanitizeUnit(r17.details || r17.reference_unit || '-'));
  if (r20) setUnit(r20, sanitizeUnit(r20.details || r20.reference_unit || '-'));
  if (r21) setUnit(r21, sanitizeUnit(r21.details || r21.reference_unit || '-'));
  if (r22) setUnit(r22, sanitizeUnit(r22.details || r22.reference_unit || '-'));
  if (r23) setUnit(r23, sanitizeUnit(r23.details || r23.reference_unit || '-'));
  if (r24) setUnit(r24, sanitizeUnit(r24.details || r24.reference_unit || '-'));

  for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
    const fresh = yearValue(r17, y);
    const denom = yearValue(giEq, y === 'exp' ? 'extrapolated' : y);
    const beyond = yearValue(r24, y);

    if (r18) {
      const v = fresh !== 0 && denom !== 0 ? roundTo(fresh / denom) : 0;
      setYearValue(r18, y, v);
    }

    if (r25) {
      const v = fresh !== 0 && beyond !== 0 ? roundTo(beyond / fresh) : 0;
      setYearValue(r25, y, v);
    }
  }

  if (r18 && r19) {
    r19.fy1 = 'N/A';
    const r18fy1 = yearValue(r18, 'fy1');
    const r18fy2 = yearValue(r18, 'fy2');
    const r18fy3 = yearValue(r18, 'fy3');
    const r18fy4 = yearValue(r18, 'fy4');
    const r18Exp = yearValue(r18, 'exp');
    r19.fy2 = r18fy1 !== 0 ? roundTo(((r18fy1 - r18fy2) / r18fy1) * 100) : 0;
    r19.fy3 = r18fy2 !== 0 ? roundTo(((r18fy2 - r18fy3) / r18fy2) * 100) : 0;
    r19.fy4 = r18fy3 !== 0 ? roundTo(((r18fy3 - r18fy4) / r18fy3) * 100) : 0;
    setYearValue(r19, 'exp', r18fy3 !== 0 ? roundTo(((r18fy3 - r18Exp) / r18fy3) * 100) : 0);
    setUnit(r19, '%');
  }

  if (r18 && r102) {
    r102.fy1 = 'N/A';
    r102.fy2 = 'N/A';
    r102.fy3 = 'N/A';
    const r18fy1 = yearValue(r18, 'fy1');
    const r18fy4 = yearValue(r18, 'fy4');
    r102.fy4 = r18fy1 !== 0 && r18fy4 !== 0 ? roundTo(((r18fy1 - r18fy4) * 100) / r18fy1) : 0;
    setYearValue(r102, 'exp', 'N/A');
    setUnit(r102, '%');
  }

  if (r18) setUnit(r18, 'KL/unit');
  if (r25) setUnit(r25, '');

  return { rows, issues };
}

export const RE_CALCULATED_CHECKLIST_ORDERS = [106, 107, 108, 109, 110] as const;

/**
 * Calculate RE rows in-place by checklist_order (26,103,27,104,105 inputs -> 106..110 calculated).
 * Mirrors RenewableEnergyLibrary behavior and returns issues without throwing.
 */
export function applyReCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const re = rows.re || [];
  const ee = rows.ee || [];
  const issues: string[] = [];

  const r26 = byOrder(re, 26); // Total Installed Capacity - Onsite
  const r103 = byOrder(re, 103); // Total Installed Capacity - Offsite
  const r27 = byOrder(re, 27); // Actual Electrical Energy Generated - Onsite
  const r104 = byOrder(re, 104); // Actual Electrical Energy Generated - Offsite
  const r105 = byOrder(re, 105); // Actual Renewable Thermal Energy Substituted
  const r106 = byOrder(re, 106); // Total Electrical Energy Generated
  const r107 = byOrder(re, 107); // Total Renewable Energy Generated
  const r108 = byOrder(re, 108); // % Substitution with Renewable Energy (Electrical)
  const r109 = byOrder(re, 109); // % Substitution with Renewable Energy (Thermal)
  const r110 = byOrder(re, 110); // RE Share in Overall Energy Mix

  const ee6 = byOrder(ee, 6); // Electrical energy consumption
  const ee7 = byOrder(ee, 7); // Thermal energy consumption
  const ee9 = byOrder(ee, 9); // Total energy consumption

  if (!r26 || !r103 || !r27 || !r104 || !r105) {
    issues.push('RE calculation requires checklist rows 26, 103, 27, 104, and 105.');
    return { rows, issues };
  }

  if (!ee6) issues.push('RE row 108 depends on EE checklist row 6.');
  if (!ee7) issues.push('RE row 109 depends on EE checklist row 7.');
  if (!ee9) issues.push('RE row 110 depends on EE checklist row 9.');

  for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
    const onsiteElectrical = yearValue(r27, y);
    const offsiteElectrical = yearValue(r104, y);
    const substitutedThermal = yearValue(r105, y);

    const totalElectrical = onsiteElectrical + offsiteElectrical;
    const totalRenewable = totalElectrical + substitutedThermal * 277.78;

    if (r106) setYearValue(r106, y, roundTo(totalElectrical));
    if (r107) setYearValue(r107, y, roundTo(totalRenewable));

    if (r108) {
      const den = yearValue(ee6, y);
      const v = onsiteElectrical !== 0 && den !== 0 ? roundTo((onsiteElectrical * 100) / den) : 0;
      setYearValue(r108, y, v);
    }

    if (r109) {
      const den = yearValue(ee7, y);
      const v = substitutedThermal !== 0 && den !== 0 ? roundTo((substitutedThermal * 100) / den) : 0;
      setYearValue(r109, y, v);
    }

    if (r110) {
      const den = yearValue(ee9, y);
      const v = totalRenewable !== 0 && den !== 0 ? roundTo((totalRenewable * 100) / den) : 0;
      setYearValue(r110, y, v);
    }
  }

  if (r26) setUnit(r26, sanitizeUnit(r26.details || r26.reference_unit || '-'));
  if (r103) setUnit(r103, sanitizeUnit(r103.details || r103.reference_unit || '-'));
  if (r27) setUnit(r27, sanitizeUnit(r27.details || r27.reference_unit || '-'));
  if (r104) setUnit(r104, sanitizeUnit(r104.details || r104.reference_unit || '-'));
  if (r105) setUnit(r105, sanitizeUnit(r105.details || r105.reference_unit || '-'));
  if (r106) setUnit(r106, 'kWh');
  if (r107) setUnit(r107, 'kWh');
  if (r108) setUnit(r108, '%');
  if (r109) setUnit(r109, '%');
  if (r110) setUnit(r110, '%');

  return { rows, issues };
}
