import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile} from 'node:fs/promises';
const db=await PGlite.create({extensions:{pgcrypto}});
try {
  for(const path of ['./bootstrap.sql','../../db/family-module.sql','../../db/activity-module.sql','../../db/stock-module.sql','../../db/feeding-module.sql','../../db/documents-module.sql','../../db/health-module.sql','../../db/health-followup.sql','./medication-baseline.sql','../../db/functions/record_medication_dose.sql','../../db/functions/revise_medication_schedule.sql','../../db/medication-dose-guard.sql','../medication-database.sql','../medication-edit-database.sql','../calendar-database.sql','../../db/avatar-storage-policies.sql','../avatar-database.sql','../family-database.sql','../activity-database.sql','../stock-database.sql','../feeding-database.sql','../documents-database.sql','../health-database.sql']) {
    console.log(`Checking ${path}`);
    const results=await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
    for(const result of results)for(const row of result.rows??[])if(row.result)console.log(row.result);
  }
  console.log('Isolated PostgreSQL checks passed. No production connection was used.');
} finally {await db.close();}
