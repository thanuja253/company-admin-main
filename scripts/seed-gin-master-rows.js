/**
 * Seed/update master_primary_data_checklist for Green Infrastructure (GIN).
 * Matches GreenInfrastructureLibrary.php / GreenInfraImport requirement keys.
 *
 * Usage:
 *   node scripts/seed-gin-master-rows.js
 *   node scripts/seed-gin-master-rows.js --list
 *   node scripts/seed-gin-master-rows.js --keep-extra
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

/** Pass-through only in GreenInfrastructureLibrary (is_calculate: 0). */
const GIN_ROWS = [
  {
    checklist_order: 78,
    parameter: 'Additional trees planted year on year (within and beyond the fence as separate items)',
    reference_unit: 'nos',
    is_calculate: 0,
  },
  {
    checklist_order: 79,
    parameter: 'Greenbelt',
    reference_unit: 'nos',
    is_calculate: 0,
  },
  {
    checklist_order: 140,
    parameter: 'Number of green professionals',
    reference_unit: 'nos',
    is_calculate: 0,
  },
  {
    checklist_order: 141,
    parameter: 'Number of environmental projects beyond the fence',
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
  const rows = await db.collection(COLL).find({ info_type: 'gin' }).sort({ checklist_order: 1 }).toArray();
  console.log('Current GIN master rows:');
  for (const row of rows) {
    console.log(
      `- gin order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
        `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const ginOrders = GIN_ROWS.map((r) => r.checklist_order);
  for (const row of GIN_ROWS) {
    await upsertRow(
      db,
      { info_type: 'gin', checklist_order: row.checklist_order },
      { info_type: 'gin', checklist_name: 'Green Infrastructure', ...row },
    );
    console.log(`  ✓ GIN order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra GIN rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 'gin', is_active: 1, checklist_order: { $nin: ginOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra GIN rows: ${r.modifiedCount}`);
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
      console.log('\nVerify with: node scripts/seed-gin-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
