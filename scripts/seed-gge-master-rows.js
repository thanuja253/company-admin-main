/**
 * Seed/update master_primary_data_checklist for Greenhouse Gases Emissions (GGE).
 * Matches GreenhouseGasesEmissionsLibrary.php checklist_order keys.
 *
 * Usage:
 *   node scripts/seed-gge-master-rows.js
 *   node scripts/seed-gge-master-rows.js --list
 *   node scripts/seed-gge-master-rows.js --keep-extra
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

/** is_calculate: 0 = user/import input, 1 = derived in GreenhouseGasesEmissionsLibrary */
const GGE_ROWS = [
  { checklist_order: 111, parameter: 'Scope 1 Emissions', reference_unit: 'TCO2e', is_calculate: 0 },
  { checklist_order: 112, parameter: 'Scope 2 Emissions', reference_unit: 'TCO2e', is_calculate: 0 },
  { checklist_order: 113, parameter: 'Scope 3 Emissions', reference_unit: 'TCO2e', is_calculate: 0 },
  { checklist_order: 114, parameter: 'No of Scope-3 categories covered', reference_unit: 'No', is_calculate: 0 },
  { checklist_order: 139, parameter: 'GHG Emission Intensity', reference_unit: 'TCO2e/unit', is_calculate: 1 },
  { checklist_order: 116, parameter: 'Reduction in GHG Emission Intensity (YoY)', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 117, parameter: 'Reduction in GHG Emission Intensity w.r.t. Baseline', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 118, parameter: 'GHG Emission Intensity Scope 3', reference_unit: 'KL/unit', is_calculate: 1 },
  { checklist_order: 119, parameter: 'Reduction in GHG Emission Intensity Scope 3 (YoY)', reference_unit: '%', is_calculate: 1 },
  {
    checklist_order: 120,
    parameter: 'Reduction in GHG Emission Intensity Scope 3 w.r.t. Baseline',
    reference_unit: '%',
    is_calculate: 1,
  },
  {
    checklist_order: 121,
    parameter: 'Scope-1 (Include total energy both non-renewable and renewable energy)',
    reference_unit: 'TCO2e',
    is_calculate: 0,
  },
  {
    checklist_order: 122,
    parameter: 'Scope-2 (Include total energy consumed including Renewable Energy)',
    reference_unit: 'TCO2e',
    is_calculate: 0,
  },
  { checklist_order: 123, parameter: 'Carbon neutral approach — Scope 3 (aligned to Scope 3 emissions)', reference_unit: 'TCO2e', is_calculate: 1 },
  { checklist_order: 124, parameter: 'Total Emissions', reference_unit: 'TCO2e', is_calculate: 1 },
  { checklist_order: 125, parameter: 'Emissions offset due to onsite renewable energy', reference_unit: 'TCO2e', is_calculate: 0 },
  { checklist_order: 126, parameter: 'Emissions offset due to offsite renewable energy', reference_unit: 'TCO2e', is_calculate: 0 },
  { checklist_order: 127, parameter: 'Carbon sequestration from trees', reference_unit: 'TCO2e', is_calculate: 0 },
  { checklist_order: 128, parameter: 'Total Emissions Offset', reference_unit: 'TCO2e', is_calculate: 1 },
  { checklist_order: 129, parameter: 'Net Emissions', reference_unit: 'TCO2e', is_calculate: 1 },
  { checklist_order: 130, parameter: 'Carbon Emission Offset (vs Scope 1+2)', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 131, parameter: 'Carbon Emission Offset (vs Total Emissions)', reference_unit: '%', is_calculate: 1 },
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
  const rows = await db
    .collection(COLL)
    .find({ info_type: 'gge' })
    .sort({ checklist_order: 1 })
    .toArray();
  console.log('Current GGE master rows:');
  for (const row of rows) {
    console.log(
      `- gge order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
        `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const ggeOrders = GGE_ROWS.map((r) => r.checklist_order);
  for (const row of GGE_ROWS) {
    await upsertRow(
      db,
      { info_type: 'gge', checklist_order: row.checklist_order },
      { info_type: 'gge', checklist_name: 'Greenhouse Gases Emissions', ...row },
    );
    console.log(`  ✓ GGE order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra GGE rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 'gge', is_active: 1, checklist_order: { $nin: ggeOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra GGE rows: ${r.modifiedCount}`);
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
      console.log('\nVerify with: node scripts/seed-gge-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
