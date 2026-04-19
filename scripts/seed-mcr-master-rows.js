/**
 * Seed/update master_primary_data_checklist for Material Conservation & Recycling (MCR).
 * Matches MaterialCalculationLibrary.php / MCRRImport requirement keys.
 *
 * Usage:
 *   node scripts/seed-mcr-master-rows.js
 *   node scripts/seed-mcr-master-rows.js --list
 *   node scripts/seed-mcr-master-rows.js --keep-extra
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

/** is_calculate: 0 = input/import; 1 = derived in MaterialCalculationLibrary */
const MCR_ROWS = [
  { checklist_order: 101, parameter: 'Raw Material Absolute Consumption', reference_unit: 'MT', is_calculate: 0 },
  { checklist_order: 100, parameter: 'Consumables Absolute Consumption', reference_unit: 'MT', is_calculate: 0 },
  {
    checklist_order: 99,
    parameter: 'Specific Raw Material Consumption (Weighted Average)',
    reference_unit: 'kg/unit',
    is_calculate: 0,
  },
  {
    checklist_order: 98,
    parameter: 'Specific Consumables Consumption (Weighted Average)',
    reference_unit: 'kg/unit',
    is_calculate: 0,
  },
  {
    checklist_order: 97,
    parameter: 'Specific Packaging Material Consumption',
    reference_unit: 'kg/unit',
    is_calculate: 0,
  },
  {
    checklist_order: 57,
    parameter: 'Percentage of Recycled Content in Packaging',
    reference_unit: '%',
    is_calculate: 0,
  },
  {
    checklist_order: 54,
    parameter: 'Reduction in Specific Raw Material Consumption (YoY)',
    reference_unit: 'KL/unit',
    is_calculate: 1,
  },
  {
    checklist_order: 55,
    parameter: 'Reduction in Specific Consumables Consumption (YoY)',
    reference_unit: 'KL/unit',
    is_calculate: 1,
  },
  {
    checklist_order: 56,
    parameter: 'Reduction in Specific Packaging Material Consumption (YoY)',
    reference_unit: 'KL/unit',
    is_calculate: 1,
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
  const rows = await db.collection(COLL).find({ info_type: 'mcr' }).sort({ checklist_order: 1 }).toArray();
  console.log('Current MCR master rows:');
  for (const row of rows) {
    console.log(
      `- mcr order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
        `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const mcrOrders = MCR_ROWS.map((r) => r.checklist_order);
  for (const row of MCR_ROWS) {
    await upsertRow(
      db,
      { info_type: 'mcr', checklist_order: row.checklist_order },
      { info_type: 'mcr', checklist_name: 'Material Conservation, Recycling and Recyclables', ...row },
    );
    console.log(`  ✓ MCR order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra MCR rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 'mcr', is_active: 1, checklist_order: { $nin: mcrOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra MCR rows: ${r.modifiedCount}`);
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
      console.log('\nVerify with: node scripts/seed-mcr-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
