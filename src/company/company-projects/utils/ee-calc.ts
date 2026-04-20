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

    // Legacy behavior: fy1 uses converted thermal (kWh), later periods use raw thermal input basis.
    const thermalSpecificBase = y === 'fy1' ? tk : t;
    if (r13) r13[y] = thermalSpecificBase && d ? roundTo(thermalSpecificBase / d) : 0;

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

/** Legacy Laravel UI used master row ids 41–48 for some RE rows; canonical checklist_order is 26–110. */
export const RE_LEGACY_ORDER_TO_CANONICAL: Record<number, number> = {
  41: 26,
  43: 105,
  44: 27,
  45: 104,
  46: 109,
  47: 108,
  48: 110,
};

/** GJ → kWh for RE total renewable line (matches RenewableEnergyLibrary.php). */
const RE_THERMAL_GJ_TO_KWH = 277.78;

function reRowByCanonicalOrder(re: any[], canonicalOrder: number): any {
  const legacyOrders = Object.entries(RE_LEGACY_ORDER_TO_CANONICAL)
    .filter(([, c]) => Number(c) === Number(canonicalOrder))
    .map(([k]) => Number(k));
  return (re || []).find((r) => {
    const o = Number(r?.checklist_order);
    return o === canonicalOrder || legacyOrders.includes(o);
  });
}

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

  const r26 = reRowByCanonicalOrder(re, 26); // Total Installed Capacity - Onsite
  const r103 = reRowByCanonicalOrder(re, 103); // Total Installed Capacity - Offsite
  const r27 = reRowByCanonicalOrder(re, 27); // Actual Electrical Energy Generated - Onsite
  const r104 = reRowByCanonicalOrder(re, 104); // Actual Electrical Energy Generated - Offsite
  const r105 = reRowByCanonicalOrder(re, 105); // Actual Renewable Thermal Energy Substituted
  const r106 = reRowByCanonicalOrder(re, 106); // Total Electrical Energy Generated
  const r107 = reRowByCanonicalOrder(re, 107); // Total Renewable Energy Generated
  const r108 = reRowByCanonicalOrder(re, 108); // % Substitution with Renewable Energy (Electrical)
  const r109 = reRowByCanonicalOrder(re, 109); // % Substitution with Renewable Energy (Thermal)
  const r110 = reRowByCanonicalOrder(re, 110); // RE Share in Overall Energy Mix

  const ee6 = byOrder(ee, 6); // Electrical energy consumption
  const ee7 = byOrder(ee, 7); // Thermal energy consumption
  const ee9 = byOrder(ee, 9); // Total energy consumption

  if (!r26) issues.push('RE: missing input row for Total Installed Capacity - Onsite (order 26 or legacy 41).');
  if (!r103) issues.push('RE: missing input row for Total Installed Capacity - Offsite (order 103).');
  if (!r27) issues.push('RE: missing input row for Actual Electrical Energy Generated - Onsite (order 27 or legacy 44).');
  if (!r104) issues.push('RE: missing input row for Actual Electrical Energy Generated - Offsite (order 104 or legacy 45).');
  if (!r105) issues.push('RE: missing input row for Actual Renewable Thermal Energy Substituted (order 105 or legacy 43).');

  if (!ee6) issues.push('RE row 108 depends on EE checklist row 6 (electrical energy consumption).');
  if (!ee7) issues.push('RE row 109 depends on EE checklist row 7 (thermal energy consumption).');
  if (!ee9) issues.push('RE row 110 depends on EE checklist row 9 (total energy consumption).');

  for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
    const onsiteElectrical = r27 ? yearValue(r27, y) : 0;
    const offsiteElectrical = r104 ? yearValue(r104, y) : 0;
    const substitutedThermal = r105 ? yearValue(r105, y) : 0;

    const totalElectrical = onsiteElectrical + offsiteElectrical;
    const totalRenewable = totalElectrical + substitutedThermal * RE_THERMAL_GJ_TO_KWH;

    if (r106) setYearValue(r106, y, roundTo(totalElectrical));
    if (r107) setYearValue(r107, y, roundTo(totalRenewable));

    // Match PHP: only compute % rows when corresponding EE row exists.
    if (r108 && ee6) {
      const den = yearValue(ee6, y);
      const v = onsiteElectrical !== 0 && den !== 0 ? roundTo((onsiteElectrical * 100) / den) : 0;
      setYearValue(r108, y, v);
    }

    if (r109 && ee7) {
      const den = yearValue(ee7, y);
      const v = substitutedThermal !== 0 && den !== 0 ? roundTo((substitutedThermal * 100) / den) : 0;
      setYearValue(r109, y, v);
    }

    if (r110 && ee9) {
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

/** Calculated GGE rows (GreenhouseGasesEmissionsLibrary.php). */
export const GGE_CALCULATED_CHECKLIST_ORDERS = [
  139, 116, 117, 118, 119, 120, 123, 124, 128, 129, 130, 131,
] as const;

/**
 * Greenhouse gas / emissions tab: inputs 111–114, 121–122, 125–127; derived 139, 116–120, 123–124, 128–131.
 * Depends on GI row 4 (equivalent product). Mirrors GreenhouseGasesEmissionsLibrary.php.
 */
export function applyGgeCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const gge = rows.gge || [];
  const gi = rows.gi || [];
  const issues: string[] = [];

  const gi4 = byOrder(gi, 4);
  if (!gi4) {
    issues.push('GGE calculations require GI equivalent product (checklist_order 4).');
  }

  const r111 = byOrder(gge, 111);
  const r112 = byOrder(gge, 112);
  const r113 = byOrder(gge, 113);
  const r114 = byOrder(gge, 114);
  const r121 = byOrder(gge, 121);
  const r122 = byOrder(gge, 122);
  const r125 = byOrder(gge, 125);
  const r126 = byOrder(gge, 126);
  const r127 = byOrder(gge, 127);

  const r139 = byOrder(gge, 139);
  const r116 = byOrder(gge, 116);
  const r117 = byOrder(gge, 117);
  const r118 = byOrder(gge, 118);
  const r119 = byOrder(gge, 119);
  const r120 = byOrder(gge, 120);
  const r123 = byOrder(gge, 123);
  const r124 = byOrder(gge, 124);
  const r128 = byOrder(gge, 128);
  const r129 = byOrder(gge, 129);
  const r130 = byOrder(gge, 130);
  const r131 = byOrder(gge, 131);

  const passUnitFromDetails = (row: any) => {
    if (!row) return;
    setUnit(row, sanitizeUnit(row.details || row.reference_unit || '-'));
  };

  passUnitFromDetails(r111);
  passUnitFromDetails(r112);
  passUnitFromDetails(r113);
  passUnitFromDetails(r114);
  passUnitFromDetails(r121);
  passUnitFromDetails(r122);
  passUnitFromDetails(r125);
  passUnitFromDetails(r126);
  passUnitFromDetails(r127);

  // 139 GHG emission intensity (TCO2e/unit)
  if (r139 && gi4 && r111 && r112) {
    setUnit(r139, 'TCO2e/unit');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const s1 = y === 'exp' ? yearValue(r111, 'exp') : yearValue(r111, y);
      const s2 = y === 'exp' ? yearValue(r112, 'exp') : yearValue(r112, y);
      const g = y === 'exp' ? yearValue(gi4, 'exp') : yearValue(gi4, y);
      const ok = s1 !== 0 && s2 !== 0 && g !== 0;
      const v = ok ? roundTo((s1 + s2) / g) : 0;
      setYearValue(r139, y, v);
    }
  }

  // 116 reduction in intensity YoY (%)
  if (r116 && r139) {
    r116.fy1 = 'N/A';
    setUnit(r116, '');
    const y139 = (k: 'fy1' | 'fy2' | 'fy3' | 'fy4' | 'exp') => yearValue(r139, k === 'exp' ? 'exp' : k);
    r116.fy2 =
      y139('fy1') !== 0 ? roundTo(((y139('fy1') - y139('fy2')) / y139('fy1')) * 100) : 0;
    r116.fy3 =
      y139('fy2') !== 0 ? roundTo(((y139('fy2') - y139('fy3')) / y139('fy2')) * 100) : 0;
    r116.fy4 =
      y139('fy3') !== 0 ? roundTo(((y139('fy3') - y139('fy4')) / y139('fy3')) * 100) : 0;
    const r139fy3 = y139('fy3');
    const r139exp = y139('exp');
    setYearValue(
      r116,
      'exp',
      r139fy3 !== 0 && r139exp !== 0 ? roundTo(((r139fy3 - r139exp) / r139fy3) * 100) : 0,
    );
  }

  // 117 reduction w.r.t. baseline (%)
  if (r117 && r139) {
    r117.fy1 = 'N/A';
    r117.fy2 = 'N/A';
    r117.fy3 = 'N/A';
    setUnit(r117, '');
    const y139 = (k: 'fy1' | 'fy2' | 'fy3' | 'fy4') => yearValue(r139, k);
    r117.fy4 =
      y139('fy1') !== 0
        ? roundTo(((y139('fy1') - y139('fy4')) * 100) / y139('fy1'))
        : 0;
    setYearValue(r117, 'exp', 'N/A');
  }

  // 118 Scope 3 intensity — PHP unit label KL/unit
  if (r118 && gi4 && r113) {
    setUnit(r118, 'KL/unit');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const s3 = y === 'exp' ? yearValue(r113, 'exp') : yearValue(r113, y);
      const g = y === 'exp' ? yearValue(gi4, 'exp') : yearValue(gi4, y);
      const ok = s3 !== 0 && g !== 0;
      setYearValue(r118, y, ok ? roundTo(s3 / g) : 0);
    }
  }

  // 119 reduction scope 3 intensity YoY
  if (r119 && r118) {
    r119.fy1 = 'N/A';
    setUnit(r119, '');
    const y118 = (k: 'fy1' | 'fy2' | 'fy3' | 'fy4' | 'exp') => yearValue(r118, k === 'exp' ? 'exp' : k);
    r119.fy2 =
      y118('fy1') !== 0 && y118('fy2') !== 0
        ? roundTo(((y118('fy1') - y118('fy2')) / y118('fy1')) * 100)
        : 0;
    r119.fy3 =
      y118('fy2') !== 0 && y118('fy3') !== 0
        ? roundTo(((y118('fy2') - y118('fy3')) / y118('fy2')) * 100)
        : 0;
    r119.fy4 =
      y118('fy3') !== 0 && y118('fy4') !== 0
        ? roundTo(((y118('fy3') - y118('fy4')) / y118('fy3')) * 100)
        : 0;
    const fy3 = y118('fy3');
    const ex = y118('exp');
    setYearValue(
      r119,
      'exp',
      fy3 !== 0 && ex !== 0 ? roundTo(((fy3 - ex) / fy3) * 100) : 0,
    );
  }

  // 120 scope 3 baseline reduction
  if (r120 && r118) {
    r120.fy1 = 'N/A';
    r120.fy2 = 'N/A';
    r120.fy3 = 'N/A';
    setUnit(r120, '');
    const y118 = (k: 'fy1' | 'fy4') => yearValue(r118, k);
    r120.fy4 =
      y118('fy1') !== 0 && y118('fy4') !== 0
        ? roundTo(((y118('fy1') - y118('fy4')) * 100) / y118('fy1'))
        : 0;
    setYearValue(r120, 'exp', 'N/A');
  }

  // 123 = copy scope 3 emissions row (113)
  if (r123 && r113) {
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const v = y === 'exp' ? yearValue(r113, 'exp') : yearValue(r113, y);
      setYearValue(r123, y, v);
    }
    setUnit(r123, sanitizeUnit(r113.details || r113.reference_unit || '-'));
  }

  // 121–122 already pass-through; 124 = 121+122+123
  if (r124 && r121 && r122 && r123) {
    setUnit(r124, 'TCO2e');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const a = y === 'exp' ? yearValue(r121, 'exp') : yearValue(r121, y);
      const b = y === 'exp' ? yearValue(r122, 'exp') : yearValue(r122, y);
      const c = y === 'exp' ? yearValue(r123, 'exp') : yearValue(r123, y);
      setYearValue(r124, y, roundTo(a + b + c));
    }
  }

  // 128 = 125+126+127
  if (r128 && r125 && r126 && r127) {
    setUnit(r128, 'TCO2e');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const a = y === 'exp' ? yearValue(r125, 'exp') : yearValue(r125, y);
      const b = y === 'exp' ? yearValue(r126, 'exp') : yearValue(r126, y);
      const c = y === 'exp' ? yearValue(r127, 'exp') : yearValue(r127, y);
      setYearValue(r128, y, roundTo(a + b + c));
    }
  }

  // 129 net = 124 - 128
  if (r129 && r124 && r128) {
    setUnit(r129, '');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const t = y === 'exp' ? yearValue(r124, 'exp') : yearValue(r124, y);
      const o = y === 'exp' ? yearValue(r128, 'exp') : yearValue(r128, y);
      setYearValue(r129, y, roundTo(t - o));
    }
  }

  // 130 % offset vs scope 1+2
  if (r130 && r128 && r121 && r122) {
    setUnit(r130, '%');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const off = y === 'exp' ? yearValue(r128, 'exp') : yearValue(r128, y);
      const x = y === 'exp' ? yearValue(r121, 'exp') : yearValue(r121, y);
      const z = y === 'exp' ? yearValue(r122, 'exp') : yearValue(r122, y);
      const den = x + z;
      const ok = off !== 0 && x !== 0 && z !== 0;
      setYearValue(r130, y, ok ? roundTo((off * 100) / den) : 0);
    }
  }

  // 131 % offset vs total 124
  if (r131 && r128 && r124) {
    setUnit(r131, '%');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const off = y === 'exp' ? yearValue(r128, 'exp') : yearValue(r128, y);
      const tot = y === 'exp' ? yearValue(r124, 'exp') : yearValue(r124, y);
      const ok = off !== 0 && tot !== 0;
      setYearValue(r131, y, ok ? roundTo((off * 100) / tot) : 0);
    }
  }

  return { rows, issues };
}

/** Derived WM rows (WastManagementLibrary.php). */
export const WM_CALCULATED_CHECKLIST_ORDERS = [138, 132, 133, 134, 135, 136, 47] as const;

/**
 * Waste management: inputs 44, 46, 137, 49–53; derived 138, 132, 133, 134, 135, 136, 47.
 * Depends on GI equivalent product (checklist_order 4). Mirrors WastManagementLibrary.php.
 */
export function applyWmCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const wm = rows.wm || [];
  const gi = rows.gi || [];
  const issues: string[] = [];

  const gi4 = byOrder(gi, 4);
  if (!gi4) {
    issues.push('WM calculations require GI equivalent product (checklist_order 4).');
  }

  const r44 = byOrder(wm, 44);
  const r46 = byOrder(wm, 46);
  const r137 = byOrder(wm, 137);
  const r49 = byOrder(wm, 49);
  const r50 = byOrder(wm, 50);
  const r51 = byOrder(wm, 51);
  const r52 = byOrder(wm, 52);
  const r53 = byOrder(wm, 53);

  const r138 = byOrder(wm, 138);
  const r132 = byOrder(wm, 132);
  const r133 = byOrder(wm, 133);
  const r134 = byOrder(wm, 134);
  const r135 = byOrder(wm, 135);
  const r136 = byOrder(wm, 136);
  const r47 = byOrder(wm, 47);

  const passDetails = (row: any) => {
    if (!row) return;
    setUnit(row, sanitizeUnit(row.details || row.reference_unit || '-'));
  };

  passDetails(r44);
  passDetails(r46);
  passDetails(r137);
  passDetails(r49);
  passDetails(r50);
  passDetails(r51);
  passDetails(r52);
  passDetails(r53);

  // 138 Specific hazardous waste (Tons/unit)
  if (r138 && gi4 && r44) {
    setUnit(r138, 'Tons/unit');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const w = y === 'exp' ? yearValue(r44, 'exp') : yearValue(r44, y);
      const g = y === 'exp' ? yearValue(gi4, 'exp') : yearValue(gi4, y);
      const ok = w !== 0 && g !== 0;
      setYearValue(r138, y, ok ? roundTo(w / g) : 0);
    }
  }

  // 132 Reduction hazardous YoY — PHP unit string is 'Tons/unit'
  if (r132 && r138) {
    r132.fy1 = 'N/A';
    setUnit(r132, 'Tons/unit');
    const v = (k: 'fy1' | 'fy2' | 'fy3' | 'fy4' | 'exp') =>
      yearValue(r138, k === 'exp' ? 'exp' : k);
    r132.fy2 =
      v('fy1') !== 0 && v('fy2') !== 0 ? roundTo(((v('fy1') - v('fy2')) / v('fy1')) * 100) : 0;
    r132.fy3 =
      v('fy2') !== 0 && v('fy3') !== 0 ? roundTo(((v('fy2') - v('fy3')) / v('fy2')) * 100) : 0;
    r132.fy4 =
      v('fy3') !== 0 && v('fy4') !== 0 ? roundTo(((v('fy3') - v('fy4')) / v('fy3')) * 100) : 0;
    const fy4 = v('fy4');
    const ex = v('exp');
    setYearValue(r132, 'exp', fy4 !== 0 && ex !== 0 ? roundTo(((fy4 - ex) / fy4) * 100) : 0);
  }

  // 133 Hazardous baseline WRT
  if (r133 && r138) {
    r133.fy1 = 'N/A';
    r133.fy2 = 'N/A';
    r133.fy3 = 'N/A';
    setUnit(r133, 'Tons/unit');
    const v = (k: 'fy1' | 'fy4') => yearValue(r138, k);
    r133.fy4 =
      v('fy1') !== 0 && v('fy4') !== 0
        ? roundTo((100 * (v('fy1') - v('fy4'))) / v('fy1'))
        : 0;
    setYearValue(r133, 'exp', 'N/A');
  }

  // 134 Specific non-hazardous (KG/unit)
  if (r134 && gi4 && r46) {
    setUnit(r134, 'KG/unit');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const w = y === 'exp' ? yearValue(r46, 'exp') : yearValue(r46, y);
      const g = y === 'exp' ? yearValue(gi4, 'exp') : yearValue(gi4, y);
      const ok = w !== 0 && g !== 0;
      setYearValue(r134, y, ok ? roundTo(w / g) : 0);
    }
  }

  // 135 Reduction non-hazardous YoY (only if 134 computed — isset in PHP)
  if (r135 && r134) {
    r135.fy1 = 'N/A';
    setUnit(r135, 'KG/unit');
    const v = (k: 'fy1' | 'fy2' | 'fy3' | 'fy4' | 'exp') =>
      yearValue(r134, k === 'exp' ? 'exp' : k);
    r135.fy2 =
      v('fy1') !== 0 && v('fy2') !== 0 ? roundTo(((v('fy1') - v('fy2')) / v('fy1')) * 100) : 0;
    r135.fy3 =
      v('fy2') !== 0 && v('fy3') !== 0 ? roundTo(((v('fy2') - v('fy3')) / v('fy2')) * 100) : 0;
    r135.fy4 =
      v('fy3') !== 0 && v('fy4') !== 0 ? roundTo(((v('fy3') - v('fy4')) / v('fy3')) * 100) : 0;
    const fy4 = v('fy4');
    const ex = v('exp');
    setYearValue(r135, 'exp', fy4 !== 0 && ex !== 0 ? roundTo(((fy4 - ex) / fy4) * 100) : 0);
  }

  // 136 Non-hazardous baseline WRT
  if (r136 && r134) {
    r136.fy1 = 'N/A';
    r136.fy2 = 'N/A';
    r136.fy3 = 'N/A';
    setUnit(r136, 'KG/unit');
    const v = (k: 'fy1' | 'fy4') => yearValue(r134, k);
    r136.fy4 =
      v('fy1') !== 0 && v('fy4') !== 0
        ? roundTo((100 * (v('fy1') - v('fy4'))) / v('fy1'))
        : 0;
    setYearValue(r136, 'exp', 'N/A');
  }

  // 47 Specific process effluent generated = 137 / GI
  if (r47 && gi4 && r137) {
    setUnit(r47, 'KG/unit');
    for (const y of ['fy1', 'fy2', 'fy3', 'fy4', 'exp'] as const) {
      const p = y === 'exp' ? yearValue(r137, 'exp') : yearValue(r137, y);
      const g = y === 'exp' ? yearValue(gi4, 'exp') : yearValue(gi4, y);
      const ok = p !== 0 && g !== 0;
      setYearValue(r47, y, ok ? roundTo(p / g) : 0);
    }
  }

  return { rows, issues };
}

/** Derived MCR rows (MaterialCalculationLibrary.php): 54, 55, 56 from 99, 98, 97. */
export const MCR_CALCULATED_CHECKLIST_ORDERS = [54, 55, 56] as const;

/**
 * Material conservation / recycling: inputs 101, 100, 99, 98, 97, 57; derived 54–56 (YoY % on specific rows).
 * Mirrors MaterialCalculationLibrary.php (pass-through copies unit from details → reference_unit).
 */
export function applyMcrCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const mcr = rows.mcr || [];
  const issues: string[] = [];

  const passFromDetails = (row: any) => {
    if (!row) return;
    setUnit(row, sanitizeUnit(row.details || row.reference_unit || '-'));
  };

  passFromDetails(byOrder(mcr, 101));
  passFromDetails(byOrder(mcr, 100));
  passFromDetails(byOrder(mcr, 99));
  passFromDetails(byOrder(mcr, 98));
  passFromDetails(byOrder(mcr, 97));
  passFromDetails(byOrder(mcr, 57));

  const r99 = byOrder(mcr, 99);
  const r98 = byOrder(mcr, 98);
  const r97 = byOrder(mcr, 97);
  const r54 = byOrder(mcr, 54);
  const r55 = byOrder(mcr, 55);
  const r56 = byOrder(mcr, 56);

  const fillReduction = (target: any, source: any) => {
    if (!target || !source) return;
    target.fy1 = 'N/A';
    setUnit(target, 'KL/unit');
    const v = (k: 'fy1' | 'fy2' | 'fy3' | 'fy4' | 'exp') =>
      yearValue(source, k === 'exp' ? 'exp' : k);
    target.fy2 =
      v('fy1') !== 0 && v('fy2') !== 0 ? roundTo(((v('fy1') - v('fy2')) / v('fy1')) * 100) : 0;
    target.fy3 =
      v('fy2') !== 0 && v('fy3') !== 0 ? roundTo(((v('fy2') - v('fy3')) / v('fy2')) * 100) : 0;
    target.fy4 =
      v('fy3') !== 0 && v('fy4') !== 0 ? roundTo(((v('fy3') - v('fy4')) / v('fy3')) * 100) : 0;
    const fy4 = v('fy4');
    const ex = v('exp');
    setYearValue(target, 'exp', fy4 !== 0 && ex !== 0 ? roundTo(((fy4 - ex) / fy4) * 100) : 0);
  };

  fillReduction(r54, r99);
  fillReduction(r55, r98);
  fillReduction(r56, r97);

  if (r54 && !r99) issues.push('MCR row 54 requires checklist row 99 (specific raw material consumption).');
  if (r55 && !r98) issues.push('MCR row 55 requires checklist row 98 (specific consumables consumption).');
  if (r56 && !r97) issues.push('MCR row 56 requires checklist row 97 (specific packaging material consumption).');

  return { rows, issues };
}

/** GSC checklist orders: pass-through only (GreenSupplyChainLibrary.php). No derived rows. */
export const GSC_PASS_THROUGH_CHECKLIST_ORDERS = [58, 59, 60, 61, 62, 63, 64, 65, 66, 96] as const;

/** No calculated rows in PHP library; kept for symmetry with GET merge logic. */
export const GSC_CALCULATED_CHECKLIST_ORDERS = [] as readonly number[];

/**
 * Green supply chain: copy unit from details → reference_unit for rows 58–66, 96.
 * Mirrors GreenSupplyChainLibrary.php (no numeric formulas).
 */
export function applyGscCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const gsc = rows.gsc || [];
  const issues: string[] = [];

  const passFromDetails = (order: number) => {
    const row = byOrder(gsc, order);
    if (!row) return;
    setUnit(row, sanitizeUnit(row.details || row.reference_unit || '-'));
  };

  for (const order of GSC_PASS_THROUGH_CHECKLIST_ORDERS) {
    passFromDetails(order);
  }

  return { rows, issues };
}

/** PS checklist orders: pass-through only (ProductStewardshipLibrary.php). */
export const PS_PASS_THROUGH_CHECKLIST_ORDERS = [67, 68, 69] as const;

export const PS_CALCULATED_CHECKLIST_ORDERS = [] as readonly number[];

/**
 * Product stewardship: copy unit from details → reference_unit for rows 67–69.
 * Mirrors ProductStewardshipLibrary.php (no numeric formulas).
 */
export function applyPsCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const ps = rows.ps || [];
  const issues: string[] = [];

  const passFromDetails = (order: number) => {
    const row = byOrder(ps, order);
    if (!row) return;
    setUnit(row, sanitizeUnit(row.details || row.reference_unit || '-'));
  };

  for (const order of PS_PASS_THROUGH_CHECKLIST_ORDERS) {
    passFromDetails(order);
  }

  return { rows, issues };
}

/** GIN checklist orders: pass-through only (GreenInfrastructureLibrary.php). */
export const GIN_PASS_THROUGH_CHECKLIST_ORDERS = [78, 79, 140, 141] as const;

export const GIN_CALCULATED_CHECKLIST_ORDERS = [] as readonly number[];

/**
 * Green infrastructure: copy unit from details → reference_unit for rows 78, 79, 140, 141.
 * Mirrors GreenInfrastructureLibrary.php (no numeric formulas).
 */
export function applyGinCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const gin = rows.gin || [];
  const issues: string[] = [];

  const passFromDetails = (order: number) => {
    const row = byOrder(gin, order);
    if (!row) return;
    setUnit(row, sanitizeUnit(row.details || row.reference_unit || '-'));
  };

  for (const order of GIN_PASS_THROUGH_CHECKLIST_ORDERS) {
    passFromDetails(order);
  }

  return { rows, issues };
}

/** TAR checklist orders: pass-through only (TargetLibrary.php). */
export const TAR_PASS_THROUGH_CHECKLIST_ORDERS = [
  80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,
] as const;

export const TAR_CALCULATED_CHECKLIST_ORDERS = [] as readonly number[];

/**
 * Targets: copy unit from details → reference_unit for rows 80–95.
 * Mirrors TargetLibrary.php (no numeric formulas).
 */
export function applyTarCalculationsByOrder(
  primaryDataRows: Record<string, any[]>,
): { rows: Record<string, any[]>; issues: string[] } {
  const rows = primaryDataRows || {};
  const tar = rows.tar || [];
  const issues: string[] = [];

  const passFromDetails = (order: number) => {
    const row = byOrder(tar, order);
    if (!row) return;
    setUnit(row, sanitizeUnit(row.details || row.reference_unit || '-'));
  };

  for (const order of TAR_PASS_THROUGH_CHECKLIST_ORDERS) {
    passFromDetails(order);
  }

  return { rows, issues };
}
