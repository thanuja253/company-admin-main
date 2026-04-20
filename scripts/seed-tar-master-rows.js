/**
 * Seed/update master_primary_data_checklist for Targets (TAR).
 * Matches TargetLibrary.php / TargetImport requirement keys.
 *
 * Usage:
 *   node scripts/seed-tar-master-rows.js
 *   node scripts/seed-tar-master-rows.js --list
 *   node scripts/seed-tar-master-rows.js --keep-extra
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

/** Pass-through only in TargetLibrary (is_calculate: 0). */
const TAR_ROWS = [
  { checklist_order: 80, parameter: 'Specific Energy Consumption', reference_unit: 'kWh/eq.unit', is_calculate: 0 },
  { checklist_order: 81, parameter: 'Specific fresh water consumption', reference_unit: 'KL/eq unit', is_calculate: 0 },
  { checklist_order: 82, parameter: 'Specific Domestic Water Consumption', reference_unit: 'Liters/person/day', is_calculate: 0 },
  { checklist_order: 83, parameter: 'Substitution with Renewable Energy - Electrical', reference_unit: '%', is_calculate: 0 },
  { checklist_order: 84, parameter: 'Substitution with Renewable Energy - Thermal', reference_unit: '%', is_calculate: 0 },
  {
    checklist_order: 85,
    parameter: 'RE Share in the Overall Energy Mix (Electrical & Thermal)',
    reference_unit: '%',
    is_calculate: 0,
  },
  { checklist_order: 86, parameter: 'GHG emission intensity (scope 1 & 2)', reference_unit: 'TCO2e/unit', is_calculate: 0 },
  { checklist_order: 87, parameter: 'GHG emission intensity (scope 3)', reference_unit: 'TCO2e/unit', is_calculate: 0 },
  { checklist_order: 88, parameter: 'Carbon Neutral % (Scope 1 & Scope 2)', reference_unit: '%', is_calculate: 0 },
  { checklist_order: 89, parameter: 'Specific Hazardous Waste Generation', reference_unit: 'Tons/Units', is_calculate: 0 },
  { checklist_order: 90, parameter: 'Specific Non- Hazardous Waste Generation', reference_unit: 'Kg/Units', is_calculate: 0 },
  {
    checklist_order: 91,
    parameter: 'Specific Raw Material Consumption (Weighted Average)',
    reference_unit: 'kg/unit',
    is_calculate: 0,
  },
  {
    checklist_order: 92,
    parameter: 'Specific Consumables Consumption (Weighted Average)',
    reference_unit: 'kg/unit',
    is_calculate: 0,
  },
  {
    checklist_order: 93,
    parameter: 'Reduction in Packaging Material (Weighted Average)',
    reference_unit: 'kg/unit',
    is_calculate: 0,
  },
  {
    checklist_order: 94,
    parameter: 'No.of Critical Suppliers Worked on Green Supply Chain',
    reference_unit: 'nos',
    is_calculate: 0,
  },
  { checklist_order: 95, parameter: 'Greenbelt', reference_unit: 'nos', is_calculate: 0 },
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
  const rows = await db.collection(COLL).find({ info_type: 'tar' }).sort({ checklist_order: 1 }).toArray();
  console.log('Current TAR master rows:');
  for (const row of rows) {
    console.log(
      `- tar order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
        `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const tarOrders = TAR_ROWS.map((r) => r.checklist_order);
  for (const row of TAR_ROWS) {
    await upsertRow(
      db,
      { info_type: 'tar', checklist_order: row.checklist_order },
      { info_type: 'tar', checklist_name: 'Targets', ...row },
    );
    console.log(`  ✓ TAR order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra TAR rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 'tar', is_active: 1, checklist_order: { $nin: tarOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra TAR rows: ${r.modifiedCount}`);
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
      console.log('\nVerify with: node scripts/seed-tar-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
