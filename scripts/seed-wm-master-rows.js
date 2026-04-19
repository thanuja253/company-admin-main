/**
 * Seed/update master_primary_data_checklist for Waste Management (WM).
 * Matches WastManagementLibrary.php / WasteManagementImport requirement keys.
 *
 * Usage:
 *   node scripts/seed-wm-master-rows.js
 *   node scripts/seed-wm-master-rows.js --list
 *   node scripts/seed-wm-master-rows.js --keep-extra
 */

const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFileIfPresent() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFileIfPresent();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/greenco_db';
const COLL = 'master_primary_data_checklist';

/** is_calculate: 0 = input/import; 1 = derived in WastManagementLibrary */
const WM_ROWS = [
  { checklist_order: 44, parameter: 'Hazardous Waste Generation - Absolute', reference_unit: 'Tons', is_calculate: 0 },
  { checklist_order: 46, parameter: 'Non-Hazardous Waste Generation - Absolute', reference_unit: 'Tons', is_calculate: 0 },
  { checklist_order: 137, parameter: 'Process Effluent Generated', reference_unit: 'KL', is_calculate: 0 },
  {
    checklist_order: 49,
    parameter: 'Percentage of Treated Process Effluent Reused in Process',
    reference_unit: '%',
    is_calculate: 0,
  },
  { checklist_order: 50, parameter: 'Domestic Effluent Generated', reference_unit: 'KL', is_calculate: 0 },
  {
    checklist_order: 51,
    parameter: 'Percentage of Treated Domestic Effluent Reused in Process',
    reference_unit: '%',
    is_calculate: 0,
  },
  { checklist_order: 52, parameter: 'Zero Effluent Discharge', reference_unit: 'Yes/No', is_calculate: 0 },
  { checklist_order: 53, parameter: 'Zero Waste to Landfill', reference_unit: 'Yes/No', is_calculate: 0 },
  { checklist_order: 138, parameter: 'Specific Hazardous Waste Generation', reference_unit: 'Tons/unit', is_calculate: 1 },
  {
    checklist_order: 132,
    parameter: 'Reduction in Specific Hazardous Waste Generation (YoY)',
    reference_unit: 'Tons/unit',
    is_calculate: 1,
  },
  {
    checklist_order: 133,
    parameter: 'Reduction in Specific Hazardous Waste Generation w.r.t. Baseline',
    reference_unit: 'Tons/unit',
    is_calculate: 1,
  },
  { checklist_order: 134, parameter: 'Specific Non-Hazardous Waste Generation', reference_unit: 'KG/unit', is_calculate: 1 },
  {
    checklist_order: 135,
    parameter: 'Reduction in Specific Non-Hazardous Waste Generation (YoY)',
    reference_unit: 'KG/unit',
    is_calculate: 1,
  },
  {
    checklist_order: 136,
    parameter: 'Reduction in Specific Non-Hazardous Waste Generation w.r.t. Baseline',
    reference_unit: 'KG/unit',
    is_calculate: 1,
  },
  { checklist_order: 47, parameter: 'Specific Process Effluent Generated', reference_unit: 'KG/unit', is_calculate: 1 },
];

async function upsertRow(db, filter, setDoc) {
  return db.collection(COLL).updateOne(
    filter,
    {
      $set: { ...setDoc, is_active: 1 },
      $setOnInsert: { createdAt: new Date() },
      $currentDate: { updatedAt: true },
    },
    { upsert: true },
  );
}

async function list(db) {
  const rows = await db.collection(COLL).find({ info_type: 'wm' }).sort({ checklist_order: 1 }).toArray();
  console.log('Current WM master rows:');
  for (const row of rows) {
    console.log(
      `- wm order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
        `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const wmOrders = WM_ROWS.map((r) => r.checklist_order);
  for (const row of WM_ROWS) {
    await upsertRow(
      db,
      { info_type: 'wm', checklist_order: row.checklist_order },
      { info_type: 'wm', checklist_name: 'Waste Management', ...row },
    );
    console.log(`  ✓ WM order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra WM rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 'wm', is_active: 1, checklist_order: { $nin: wmOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra WM rows: ${r.modifiedCount}`);
  }
}

async function run() {
  const args = new Set(process.argv.slice(2));
  const doList = args.has('--list') || args.has('list');
  const keepExtra = args.has('--keep-extra');

  await mongoose.connect(MONGODB_URI);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection is not available.');

    if (doList) {
      await list(db);
    } else {
      await seed(db, keepExtra);
      console.log('\nVerify with: node scripts/seed-wm-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
