import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const source = ['senior-full-stack-76-wordpress-wordpress-postgres-1', 'lhl76', 'lhl76_import_test'];
const target = ['lhl76-safety-20261028-191346', 'audit_restore', 'lhl76_safety_restored'];
if (source[0] === target[0] || source[2] === target[2]) throw new Error('Source and restore target must be distinct');
function query(connection, sql) {
  return execFileSync('docker', ['exec', connection[0], 'psql', '-U', connection[1], '-d', connection[2], '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], {encoding:'utf8'}).trim();
}
const tables = query(source, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").split('\n').map(s=>s.trim());
const results = tables.map(table => {
  if (!/^\w+$/.test(table)) throw new Error('Unexpected table identifier');
  const sql = `SELECT count(*) || ':' || coalesce(md5(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text)), 'empty') FROM public."${table}" t`;
  const before = query(source, sql);
  const restored = query(target, sql);
  return {table, count:Number(before.split(':')[0]), fingerprint:before.split(':')[1], matches:before===restored};
});
const constraintSql = "SELECT md5(string_agg(conrelid::regclass::text || ':' || conname || ':' || pg_get_constraintdef(oid), E'\\n' ORDER BY conrelid::regclass::text,conname)) FROM pg_constraint WHERE connamespace='public'::regnamespace";
const constraintsMatch = query(source,constraintSql) === query(target,constraintSql);
const report = {checkedAt:new Date().toISOString(),sourceDatabase:source[2],restoredDatabase:target[2],constraintsMatch,results,ok:constraintsMatch && results.every(r=>r.matches)};
writeFileSync('backups/final-safety-20261028-191346/verification.json',JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify(report,null,2));
if (!report.ok) process.exitCode=1;
