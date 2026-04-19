/**
 * Seed/update master_primary_data_checklist for Green Supply Chain (GSC).
 * Matches GreenSupplyChainLibrary.php / GSCImport requirement keys.
 *
 * Usage:
 *   node scripts/seed-gsc-master-rows.js
 *   node scripts/seed-gsc-master-rows.js --list
 *   node scripts/seed-gsc-master-rows.js --keep-extra
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

/** All rows are pass-through in GreenSupplyChainLibrary (is_calculate: 0). */
const GSC_ROWS = [
  {
    checklist_order: 58,
    parameter: 'No. of Critical Suppliers Identified for Working on Green Supply Chain',
    reference_unit: 'nos',
    is_calculate: 0,
  },
  {
    checklist_order: 59,
    parameter: 'No.of Critical Suppliers Worked on Green Supply Chain',
    reference_unit: 'nos',
    is_calculate: 0,
  },
  {
    checklist_order: 60,
    parameter: 'Environmental Impact Reduction in Suppliers - Energy',
    reference_unit: 'kWh',
    is_calculate: 0,
  },
  {
    checklist_order: 61,
    parameter: 'Environmental Impact Reduction in Suppliers - Water',
    reference_unit: 'KL',
    is_calculate: 0,
  },
  {
    checklist_order: 62,
    parameter: 'Environmental Impact Reduction in Suppliers - GHG',
    reference_unit: 'TCO2e',
    is_calculate: 0,
  },
  {
    checklist_order: 63,
    parameter: 'Environmental Impact Reduction in Suppliers - Material',
    reference_unit: 'tons',
    is_calculate: 0,
  },
  {
    checklist_order: 96,
    parameter: 'Environmental Impact Reduction in Suppliers - Hazardous Waste',
    reference_unit: 'tons',
    is_calculate: 0,
  },
  {
    checklist_order: 64,
    parameter: 'Number of SMEs Encouraged for GreenCo Implementation',
    reference_unit: 'nos',
    is_calculate: 0,
  },
  {
    checklist_order: 65,
    parameter: 'Reduction in Logistics Emissions (Upstream and Downstream)',
    reference_unit: 'TCO2/Unit',
    is_calculate: 0,
  },
  {
    checklist_order: 66,
    parameter: 'Reduction in Incoming Packaging Material (Weighted Average)',
    reference_unit: 'kg/unit',
    is_calculate: 0,
  },
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
  const rows = await db.collection(COLL).find({ info_type: 'gsc' }).sort({ checklist_order: 1 }).toArray();
  console.log('Current GSC master rows:');
  for (const row of rows) {
    console.log(
      `- gsc order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
        `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const gscOrders = GSC_ROWS.map((r) => r.checklist_order);
  for (const row of GSC_ROWS) {
    await upsertRow(
      db,
      { info_type: 'gsc', checklist_order: row.checklist_order },
      { info_type: 'gsc', checklist_name: 'Green Supply Chain', ...row },
    );
    console.log(`  ✓ GSC order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra GSC rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 'gsc', is_active: 1, checklist_order: { $nin: gscOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra GSC rows: ${r.modifiedCount}`);
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
      console.log('\nVerify with: node scripts/seed-gsc-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
