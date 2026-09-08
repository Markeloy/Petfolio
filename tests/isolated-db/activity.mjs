import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=await PGlite.create();
try {
  for(const path of ['./bootstrap.sql','../../db/family-module.sql','../../db/activity-module.sql','../activity-database.sql']) {
    const results=await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
    for(const result of results)for(const row of result.rows??[])if(row.result)console.log(row.result);
  }
  console.log('Isolated PostgreSQL checks passed. No production connection was used.');
} finally {await db.close();}
