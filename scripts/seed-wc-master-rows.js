/**
 * Seed/update master_primary_data_checklist for Water Conservation (WC).
 *
 * Usage:
 *   node scripts/seed-wc-master-rows.js
 *   node scripts/seed-wc-master-rows.js --list
 *   node scripts/seed-wc-master-rows.js --keep-extra
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

const GI_EQUIVALENT_ROW = {
  info_type: 'gi',
  checklist_name: 'General Information',
  checklist_order: 4,
  parameter: 'Equivalent product',
  reference_unit: 'MT/Nos/KL',
  is_calculate: 0,
  is_active: 1,
};

const WC_ROWS = [
  { checklist_order: 17, parameter: 'Total fresh water consumption', reference_unit: 'KL', is_calculate: 0 },
  { checklist_order: 18, parameter: 'Specific fresh water consumption', reference_unit: 'KL/unit', is_calculate: 1 },
  { checklist_order: 19, parameter: 'Reduction in specific fresh water consumption', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 20, parameter: 'Specific process water consumption', reference_unit: 'L/unit', is_calculate: 0 },
  { checklist_order: 21, parameter: 'Specific domestic water consumption', reference_unit: 'L/Person/Day', is_calculate: 0 },
  { checklist_order: 22, parameter: 'Specific gardening water consumption', reference_unit: 'L/Sq.m/day', is_calculate: 0 },
  { checklist_order: 23, parameter: 'Rain water harvesting potential captured', reference_unit: '%', is_calculate: 0 },
  { checklist_order: 24, parameter: 'Beyond the fence water conservation', reference_unit: 'KL/Annum', is_calculate: 0 },
  { checklist_order: 25, parameter: 'Water neutral / positive / water offset ratio', reference_unit: '', is_calculate: 1 },
  { checklist_order: 102, parameter: 'Baseline reduction in specific fresh water consumption', reference_unit: '%', is_calculate: 1 },
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
  const rows = await db.collection(COLL).find({ info_type: { $in: ['gi', 'wc'] } }).sort({ info_type: 1, checklist_order: 1 }).toArray();
  console.log('Current GI/WC master rows:');
  for (const row of rows) {
    console.log(
      `- ${row.info_type} order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
      `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function seed(db, keepExtra) {
  const wcOrders = WC_ROWS.map((r) => r.checklist_order);

  await upsertRow(db, { info_type: 'gi', checklist_order: GI_EQUIVALENT_ROW.checklist_order }, GI_EQUIVALENT_ROW);
  console.log('Upserted GI equivalent-product row (order 4).');

  for (const row of WC_ROWS) {
    await upsertRow(
      db,
      { info_type: 'wc', checklist_order: row.checklist_order },
      { info_type: 'wc', checklist_name: 'Water Conservation', ...row },
    );
    console.log(`  ✓ WC order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}"`);
  }

  if (keepExtra) {
    console.log('Keeping extra WC rows active (--keep-extra).');
  } else {
    const r = await db.collection(COLL).updateMany(
      { info_type: 'wc', is_active: 1, checklist_order: { $nin: wcOrders } },
      { $set: { is_active: 0 }, $currentDate: { updatedAt: true } },
    );
    console.log(`Deactivated extra WC rows: ${r.modifiedCount}`);
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
      console.log('\nVerify with: node scripts/seed-wc-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});

