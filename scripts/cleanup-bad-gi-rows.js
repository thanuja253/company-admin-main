/**
 * One-time cleanup for corrupted GI rows in primary_data_form.
 *
 * Removes rows where:
 * - info_type = 'gi' but data_id is not an active GI master row id, OR
 * - info_type = 'gi' and reference_unit/details look like EE thermal/electrical rows (kWh/GJ)
 *
 * Usage:
 *   node scripts/cleanup-bad-gi-rows.js --project <projectId>
 *   node scripts/cleanup-bad-gi-rows.js --project <projectId> --apply
 *   node scripts/cleanup-bad-gi-rows.js --apply   // all projects
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

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const projectIdx = args.indexOf('--project');
  const projectId = projectIdx >= 0 ? args[projectIdx + 1] : null;

  await mongoose.connect(MONGODB_URI);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection is not available.');

    const giMasters = await db
      .collection('master_primary_data_checklist')
      .find({ info_type: 'gi', is_active: 1 })
      .project({ _id: 1 })
      .toArray();
    const giMasterIds = new Set(giMasters.map((x) => String(x._id)));

    const filter = { info_type: 'gi' };
    if (projectId) {
      const oid = mongoose.Types.ObjectId.isValid(projectId) ? new mongoose.Types.ObjectId(projectId) : null;
      filter.$or = oid ? [{ project_id: oid }, { project_id: projectId }] : [{ project_id: projectId }];
    }

    const rows = await db.collection('primary_data_form').find(filter).toArray();
    const bad = rows.filter((row) => {
      const dataId = String(row?.data_id ?? '');
      const unit = String(row?.reference_unit ?? '').trim().toLowerCase();
      const details = String(row?.details ?? '').trim().toLowerCase();
      const nonGiMaster = !giMasterIds.has(dataId);
      const eeLikeUnit = ['kwh', 'gj'].includes(unit) || ['kwh', 'gj'].includes(details);
      return nonGiMaster || eeLikeUnit;
    });

    console.log(JSON.stringify({
      projectId: projectId || 'ALL',
      totalGiRows: rows.length,
      badGiRows: bad.length,
      apply,
      sample: bad.slice(0, 10).map((r) => ({
        _id: String(r._id),
        project_id: String(r.project_id),
        data_id: String(r.data_id),
        reference_unit: r.reference_unit ?? null,
        details: r.details ?? null,
        parameter: r.parameter ?? null,
      })),
    }, null, 2));

    if (apply && bad.length) {
      const ids = bad.map((r) => r._id);
      const result = await db.collection('primary_data_form').deleteMany({ _id: { $in: ids } });
      console.log(JSON.stringify({ deleted: result.deletedCount }, null, 2));
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});

