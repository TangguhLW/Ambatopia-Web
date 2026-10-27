import {readdir,readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),rows=[];
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
for(const file of await readdir(new URL('.cache/',root))) {
  if(!/^[a-f0-9]{64}\.json$/.test(file))continue;
  const meta=JSON.parse(await readFile(new URL('.cache/'+file,root)));
  const url=new URL(meta.sourceUrl);
  rows.push('('+[url.pathname+url.search,file.slice(0,-5),meta.sourceUrl,meta.sha256,meta.contentType,meta.bytes,meta.acquiredAt].map(quote).join(',')+')');
}
const sql=`begin;
alter table public.asset_manifest add column if not exists object_key text;
alter table public.asset_manifest add column if not exists source_url text;
insert into public.asset_manifest (path,object_key,source_url,sha256,content_type,bytes,acquired_at) values
${rows.join(',\n')}
on conflict (path) do update set object_key=excluded.object_key,source_url=excluded.source_url,sha256=excluded.sha256,content_type=excluded.content_type,bytes=excluded.bytes,acquired_at=excluded.acquired_at;
alter table public.asset_manifest alter column object_key set not null;
alter table public.asset_manifest alter column source_url set not null;
commit;
select count(*) as cached_assets, sum(bytes) as total_bytes from public.asset_manifest;
`;
await writeFile(new URL('supabase/seed-assets.sql',root),sql);
console.log(`Prepared ${rows.length} public asset metadata records.`);
