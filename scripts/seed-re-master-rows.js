/**
 * Seed/update master_primary_data_checklist for Renewable Energy (RE).
 *
 * Usage:
 *   node scripts/seed-re-master-rows.js
 *   node scripts/seed-re-master-rows.js --list
 *   node scripts/seed-re-master-rows.js --keep-extra
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

// Legacy Laravel UI also referenced rows 41–48; map: 41→26, 43→105, 44→27, 45→104, 46→109, 47→108, 48→110 (backend resolves these).
const RE_ROWS = [
  { checklist_order: 26, parameter: 'Total Installed Capacity - Onsite', reference_unit: 'MW', is_calculate: 0 },
  { checklist_order: 103, parameter: 'Total Installed Capacity - Offsite', reference_unit: 'MW', is_calculate: 0 },
  { checklist_order: 27, parameter: 'Actual Electrical Energy Generated - Onsite', reference_unit: 'kWh', is_calculate: 0 },
  {
    checklist_order: 104,
    parameter: 'Actual Electrical Energy Generated - Offsite (including RE purchased)',
    reference_unit: 'kWh',
    is_calculate: 0,
  },
  { checklist_order: 105, parameter: 'Actual Renewable Thermal Energy Substituted', reference_unit: 'GJ', is_calculate: 0 },
  { checklist_order: 106, parameter: 'Total Electrical Energy Generated', reference_unit: 'kWh', is_calculate: 1 },
  { checklist_order: 107, parameter: 'Total Renewable Energy Generated', reference_unit: 'kWh', is_calculate: 1 },
  { checklist_order: 108, parameter: '% Substitution with Renewable Energy (Electrical)', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 109, parameter: '% Substitution with Renewable Energy (Thermal)', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 110, parameter: 'RE share in overall energy mix', reference_unit: '%', is_calculate: 1 },
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
    .find({ info_type: 're' })
    .sort({ checklist_order: 1 })
    .toArray();
  console.log('Current RE master rows:');
  for (const row of rows) {
    console.log(
      `- re order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
      `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const reOrders = RE_ROWS.map((r) => r.checklist_order);
  for (const row of RE_ROWS) {
    await upsertRow(
      db,
      { info_type: 're', checklist_order: row.checklist_order },
      { info_type: 're', checklist_name: 'Renewable Energy', ...row },
    );
    console.log(`  ✓ RE order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra RE rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 're', is_active: 1, checklist_order: { $nin: reOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra RE rows: ${r.modifiedCount}`);
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
      console.log('\nVerify with: node scripts/seed-re-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});

