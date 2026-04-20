/**
 * Seed/update master_primary_data_checklist for Product Stewardship (PS).
 * Matches ProductStewardshipLibrary.php / ProductImport requirement keys.
 *
 * Usage:
 *   node scripts/seed-ps-master-rows.js
 *   node scripts/seed-ps-master-rows.js --list
 *   node scripts/seed-ps-master-rows.js --keep-extra
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

/** Pass-through only in ProductStewardshipLibrary (is_calculate: 0). */
const PS_ROWS = [
  {
    checklist_order: 67,
    parameter: 'Percentage Reduction in Chemicals of Concern',
    reference_unit: '%',
    is_calculate: 0,
  },
  {
    checklist_order: 68,
    parameter: 'No of LCA Studies Conducted',
    reference_unit: 'nos',
    is_calculate: 0,
  },
  {
    checklist_order: 69,
    parameter: 'No of Products Covered Under Environment Product Declaration',
    reference_unit: 'nos',
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
  const rows = await db.collection(COLL).find({ info_type: 'ps' }).sort({ checklist_order: 1 }).toArray();
  console.log('Current PS master rows:');
  for (const row of rows) {
    console.log(
      `- ps order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
        `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const psOrders = PS_ROWS.map((r) => r.checklist_order);
  for (const row of PS_ROWS) {
    await upsertRow(
      db,
      { info_type: 'ps', checklist_order: row.checklist_order },
      { info_type: 'ps', checklist_name: 'Product Stewardship', ...row },
    );
    console.log(`  ✓ PS order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra PS rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 'ps', is_active: 1, checklist_order: { $nin: psOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra PS rows: ${r.modifiedCount}`);
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
      console.log('\nVerify with: node scripts/seed-ps-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
