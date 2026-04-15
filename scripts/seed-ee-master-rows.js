/**
 * Seed/update master_primary_data_checklist for Energy Efficiency (EE).
 *
 * What it does:
 * 1) Upserts required EE input + calculated rows by checklist_order
 * 2) Upserts GI equivalent-product row (order 4) used as denominator base
 * 3) Deactivates extra active EE rows not in the required definition (unless --keep-extra is passed)
 *
 * Usage:
 *   node scripts/seed-ee-master-rows.js
 *   node scripts/seed-ee-master-rows.js --list
 *   node scripts/seed-ee-master-rows.js --keep-extra
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function loadEnvFileIfPresent() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
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

const EE_ROWS = [
  { checklist_order: 6, parameter: 'Electrical energy consumption', reference_unit: 'kWh', is_calculate: 0 },
  { checklist_order: 7, parameter: 'Thermal energy consumption', reference_unit: 'GJ', is_calculate: 0 },
  { checklist_order: 8, parameter: 'Thermal energy converted to kWh', reference_unit: 'kWh', is_calculate: 1 },
  { checklist_order: 9, parameter: 'Total energy consumption', reference_unit: 'kWh', is_calculate: 1 },
  { checklist_order: 10, parameter: 'Electrical energy share (%)', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 11, parameter: 'Thermal energy share (%)', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 12, parameter: 'Specific electrical energy consumption (kWh/unit)', reference_unit: 'kWh/unit', is_calculate: 1 },
  { checklist_order: 13, parameter: 'Specific thermal energy consumption (kWh/unit)', reference_unit: 'kWh/unit', is_calculate: 1 },
  { checklist_order: 14, parameter: 'Specific total energy consumption (kWh/unit)', reference_unit: 'kWh/unit', is_calculate: 1 },
  { checklist_order: 15, parameter: 'Specific total energy consumption (GJ/unit)', reference_unit: 'GJ/unit', is_calculate: 1 },
  { checklist_order: 16, parameter: 'Reduction in specific energy consumption (%)', reference_unit: '%', is_calculate: 1 },
  { checklist_order: 142, parameter: 'Baseline reduction in specific energy consumption (%)', reference_unit: '%', is_calculate: 1 },
];

async function list(db) {
  const rows = await db
    .collection(COLL)
    .find({ info_type: { $in: ['gi', 'ee'] } })
    .sort({ info_type: 1, checklist_order: 1 })
    .toArray();

  console.log('Current GI/EE master rows:');
  for (const row of rows) {
    console.log(
      `- ${row.info_type} order=${row.checklist_order} is_calc=${row.is_calculate} active=${row.is_active} ` +
      `parameter="${row.parameter || '-'}" unit="${row.reference_unit || '-'}" id=${row._id}`,
    );
  }
}

async function upsertRow(db, filter, setDoc) {
  const result = await db.collection(COLL).updateOne(
    filter,
    {
      $set: {
        ...setDoc,
        is_active: 1,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
      $currentDate: {
        updatedAt: true,
      },
    },
    { upsert: true },
  );

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount,
  };
}

async function seed(db, keepExtra) {
  const eeOrders = EE_ROWS.map((r) => r.checklist_order);

  console.log('Upserting GI equivalent-product row (order 4)...');
  await upsertRow(
    db,
    { info_type: 'gi', checklist_order: GI_EQUIVALENT_ROW.checklist_order },
    GI_EQUIVALENT_ROW,
  );

  console.log('Upserting EE rows...');
  for (const row of EE_ROWS) {
    const full = {
      info_type: 'ee',
      checklist_name: 'Energy Efficiency',
      ...row,
    };
    await upsertRow(db, { info_type: 'ee', checklist_order: row.checklist_order }, full);
    console.log(
      `  ✓ EE order=${row.checklist_order} is_calc=${row.is_calculate} parameter="${row.parameter}" unit="${row.reference_unit}"`,
    );
  }

  if (keepExtra) {
    console.log('Keeping extra EE rows active (--keep-extra).');
  } else {
    const deactivateResult = await db.collection(COLL).updateMany(
      {
        info_type: 'ee',
        is_active: 1,
        checklist_order: { $nin: eeOrders },
      },
      {
        $set: { is_active: 0 },
        $currentDate: { updatedAt: true },
      },
    );
    console.log(
      `Deactivated extra EE rows not in required definition: ${deactivateResult.modifiedCount}`,
    );
  }

  console.log('Done.');
}

async function run() {
  const args = new Set(process.argv.slice(2));
  const doList = args.has('--list') || args.has('list');
  const keepExtra = args.has('--keep-extra');

  await mongoose.connect(MONGODB_URI);
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not available.');
    }
    if (doList) {
      await list(db);
    } else {
      await seed(db, keepExtra);
      console.log('\nVerify with: node scripts/seed-ee-master-rows.js --list');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});

