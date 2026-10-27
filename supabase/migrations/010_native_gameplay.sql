begin;
create function public.game_generate_world(p_name text) returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare seed bigint:=2166136261;n integer;y integer;door_x integer;fg integer[]:=array_fill(0,array[6000]);bg integer[]:=array_fill(0,array[6000]);c text;
begin
 foreach c in array regexp_split_to_array(upper(p_name),'') loop seed:=((seed # ascii(c))*16777619)&4294967295;end loop;
 door_x:=2+seed%96;
 for n in 0..5999 loop
  seed:=(seed*1664525+1013904223)&4294967295;y:=n/100;
  fg[n+1]:=case when y>=54 then 3 when y<24 then 0 when y>=25 and seed%50=0 then 4 when y>=51 and seed%8<3 then 16 else 1 end;
  bg[n+1]:=case when y>=24 then 8 else 0 end;
 end loop;
 fg[2301+door_x]:=15;fg[2401+door_x]:=3;
 return jsonb_build_object('schema',1,'width',100,'height',60,'foreground',to_jsonb(fg),'background',to_jsonb(bg),'spawn',jsonb_build_object('x',door_x,'y',23));
end $$;
revoke all on function public.game_generate_world(text) from public,anon,authenticated;

create or replace function public.game_create_world(p_name text,p_request_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();world uuid;
begin
 if p_name is null or p_name !~ '^[A-Za-z0-9]{1,24}$' or p_request_id is null then raise exception 'INVALID_WORLD_NAME';end if;
 select id into world from public.game_worlds where name=upper(p_name);if found then return world;end if;
 select id into world from public.game_worlds where created_by=actor and request_id=p_request_id;if found then return world;end if;
 if not public.game_rate('create:'||actor,60,5) then raise exception 'RATE_LIMITED';end if;
 insert into public.game_worlds(name,created_by,request_id,snapshot) values(upper(p_name),actor,p_request_id,public.game_generate_world(p_name)) on conflict(name) do nothing returning id into world;
 if world is null then select id into world from public.game_worlds where name=upper(p_name);end if;
 return world;
end $$;

create function public.game_with_entrance(p_snapshot jsonb) returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare n integer;x integer;y integer;sx numeric:=(p_snapshot->'spawn'->>'x')::numeric;sy numeric:=(p_snapshot->'spawn'->>'y')::numeric;
begin
 if exists(select 1 from jsonb_array_elements(p_snapshot->'foreground') t where t='15'::jsonb) then return p_snapshot;end if;
 select tx,ty into x,y from generate_series(0,99) tx cross join generate_series(0,57) ty
 where power(tx-sx,2)+power(ty-sy,2)<=9 and p_snapshot->'foreground'->(ty*100+tx)='0'::jsonb and p_snapshot->'foreground'->((ty+1)*100+tx)='0'::jsonb
 order by power(tx-sx,2)+power(ty-sy,2),ty desc,tx limit 1;
 if x is null then return p_snapshot;end if;n:=y*100+x;
 p_snapshot:=jsonb_set(p_snapshot,array['foreground',n::text],'15');p_snapshot:=jsonb_set(p_snapshot,array['foreground',(n+100)::text],'3');
 return jsonb_set(p_snapshot,'{spawn}',jsonb_build_object('x',x,'y',y));
end $$;
revoke all on function public.game_with_entrance(jsonb) from public,anon,authenticated;

create or replace function public.game_join(p_world uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();v_cap integer;snapshot_before jsonb;v_snapshot jsonb;door integer;v_x numeric;v_y numeric;
begin
 if not public.game_rate('join:'||actor,60,20) then raise exception 'RATE_LIMITED';end if;
 select snapshot into snapshot_before from public.game_worlds where id=p_world for update;if not found then raise exception 'WORLD_NOT_FOUND';end if;
 select value::text::integer into v_cap from public.game_settings where key='world_cap';
 if (select count(*) from public.game_memberships where world_id=p_world and user_id<>actor and seen_at>now()-interval '60 seconds')>=v_cap and not public.game_is_admin() then raise exception 'WORLD_FULL';end if;
 v_snapshot:=public.game_with_entrance(snapshot_before);
 if v_snapshot<>snapshot_before then
  update public.game_worlds set snapshot=v_snapshot,version=version+1,updated_at=now() where id=p_world;
  insert into public.game_events(world_id,kind,payload) values(p_world,'resync','{}');
 end if;
 select ordinality::integer-1 into door from jsonb_array_elements(v_snapshot->'foreground') with ordinality t(value,ordinality) where value='15'::jsonb order by ordinality limit 1;
 if door is not null then v_x:=door%100+6.0/32;v_y:=door/100+2.0/32;
 else
  select x,y into v_x,v_y from generate_series(0,99) x cross join generate_series(0,58) y where (v_snapshot->'foreground'->>(y*100+x))::integer in (0,9)
  order by power(x-(v_snapshot->'spawn'->>'x')::numeric,2)+power(y-(v_snapshot->'spawn'->>'y')::numeric,2),y,x limit 1;
 end if;
 if v_x is null then raise exception 'WORLD_HAS_NO_SAFE_SPAWN';end if;
 insert into public.game_memberships(user_id,world_id,x,y) values(actor,p_world,v_x,v_y)
 on conflict(user_id) do update set world_id=excluded.world_id,x=excluded.x,y=excluded.y,facing='right',animation='idle',sequence=0,seen_at=now(),moved_at=now();
 update public.game_profiles set last_seen_at=now() where id=actor;
 insert into public.game_events(world_id,kind,payload) values(p_world,'join',jsonb_build_object('user_id',actor));return public.game_state(p_world);
end $$;

create table public.game_tile_damage(world_id uuid not null references public.game_worlds(id) on delete cascade,x integer not null,y integer not null,layer text not null,item integer not null,hits integer not null,heals_at timestamptz not null,primary key(world_id,x,y,layer));
alter table public.game_tile_damage enable row level security;
revoke all on public.game_tile_damage from public,anon,authenticated;
grant all on public.game_tile_damage to service_role;
create function public.game_punch(p_world uuid,p_x integer,p_y integer,p_expected_version integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();w public.game_worlds;result jsonb;tile_id integer;v_layer text:='foreground';damage integer:=0;hp integer;edits jsonb:='[]';
begin
 select * into w from public.game_worlds where id=p_world for update;
 select r.result into result from public.game_requests r where user_id=actor and request_id=p_request_id and operation='punch';if found then return result;end if;
 perform public.game_reach(p_world,p_x,p_y);
 if w.version is distinct from p_expected_version then raise exception 'STALE_VERSION';end if;
 if not public.game_can_edit(p_world,p_y*100+p_x) then raise exception 'LOCKED';end if;
 tile_id:=(w.snapshot->'foreground'->>(p_y*100+p_x))::integer;
 if tile_id in (3,15) then raise exception 'UNBREAKABLE';end if;
 if tile_id between 10 and 14 then raise exception 'LOCK_TILE';end if;
 if tile_id=0 then v_layer:='background';tile_id:=(w.snapshot->'background'->>(p_y*100+p_x))::integer;end if;
 if not public.game_rate('punch:'||actor,1,5) then raise exception 'RATE_LIMITED';end if;
 hp:=case tile_id when 0 then 0 when 4 then 4 when 6 then 2 else 3 end;
 if tile_id<>0 then
  select hits into damage from public.game_tile_damage where world_id=p_world and x=p_x and y=p_y and layer=v_layer and game_tile_damage.item=tile_id and heals_at>now();damage:=coalesce(damage,0)+1;
  if damage>=hp then
   w.snapshot:=jsonb_set(w.snapshot,array[v_layer,(p_y*100+p_x)::text],'0');
   update public.game_worlds set snapshot=w.snapshot,version=version+1,updated_at=now() where id=p_world returning version into w.version;
   delete from public.game_tile_damage where world_id=p_world and x=p_x and y=p_y and layer=v_layer;
   edits:=jsonb_build_array(jsonb_build_object('x',p_x,'y',p_y,'layer',v_layer,'id',0));
  else
   insert into public.game_tile_damage values(p_world,p_x,p_y,v_layer,tile_id,damage,now()+interval '8 seconds') on conflict(world_id,x,y,layer) do update set item=excluded.item,hits=excluded.hits,heals_at=excluded.heals_at;
  end if;
 end if;
 result:=jsonb_build_object('version',w.version,'edits',edits,'saved_at',now(),'x',p_x,'y',p_y,'user_id',actor,'remaining',greatest(0,hp-damage),'tile_id',tile_id);
 insert into public.game_requests values(actor,p_request_id,'punch',result,now());
 insert into public.game_events(world_id,kind,payload) values(p_world,'punch',result);
 if jsonb_array_length(edits)>0 then insert into public.game_events(world_id,version,kind,payload) values(p_world,w.version,'edit',result);end if;
 return result;
end $$;
revoke all on function public.game_punch(uuid,integer,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.game_punch(uuid,integer,integer,integer,uuid) to authenticated;
create or replace function public.game_edit(p_world uuid,p_expected_version integer,p_edits jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();w public.game_worlds;e jsonb;x integer;y integer;item integer;layer text;result jsonb;
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED';end if;
 select * into w from public.game_worlds where id=p_world for update;
 select r.result into result from public.game_requests r where user_id=actor and request_id=p_request_id and operation='edit';if found then return result;end if;
 if w.version is distinct from p_expected_version then raise exception 'STALE_VERSION';end if;
 if p_edits is null or jsonb_typeof(p_edits)<>'array' or jsonb_array_length(p_edits) not between 1 and 64 then raise exception 'INVALID_EDITS';end if;
 if not public.game_rate('edit:'||actor,1,8) then raise exception 'RATE_LIMITED';end if;
 for e in select jsonb_array_elements(p_edits) loop
  if jsonb_typeof(e)<>'object' or not(e ?& array['x','y','id','layer']) then raise exception 'INVALID_EDITS';end if;
  x:=(e->>'x')::integer;y:=(e->>'y')::integer;item:=(e->>'id')::integer;layer:=e->>'layer';
  perform public.game_reach(p_world,x,y);
  if item is null or item not in (0,1,2,4,5,6,7,8,9,16) or layer is null or layer not in ('foreground','background') or (item<>0 and ((item=8)<>(layer='background'))) then raise exception 'INVALID_ITEM';end if;
  if not public.game_can_edit(p_world,y*100+x) then raise exception 'LOCKED';end if;
  if exists(select 1 from public.game_locks where world_id=p_world and game_locks.x=(e->>'x')::integer and game_locks.y=(e->>'y')::integer) then raise exception 'LOCK_TILE';end if;
  if layer='foreground' and (w.snapshot->'foreground'->>(y*100+x))::integer in (3,15) then raise exception 'UNBREAKABLE';end if;
  if item<>0 and (w.snapshot->layer->>(y*100+x))::integer not in (0,item) then raise exception 'TILE_OCCUPIED';end if;
  if layer='foreground' and item not in (0,9,16) and exists(select 1 from public.game_memberships m where m.world_id=p_world and m.seen_at>now()-interval '60 seconds' and m.x<(e->>'x')::integer+1 and m.x+20.0/32>(e->>'x')::integer and m.y<(e->>'y')::integer+1 and m.y+30.0/32>(e->>'y')::integer) then raise exception 'PLAYER_IN_TILE';end if;
  delete from public.game_tile_damage d where d.world_id=p_world and d.x=(e->>'x')::integer and d.y=(e->>'y')::integer and d.layer=e->>'layer';
  w.snapshot:=jsonb_set(w.snapshot,array[layer,(y*100+x)::text],to_jsonb(item));
 end loop;
 update public.game_worlds set snapshot=w.snapshot,version=version+1,updated_at=now() where id=p_world returning version into w.version;
 result:=jsonb_build_object('version',w.version,'edits',p_edits,'saved_at',now(),'user_id',actor);
 insert into public.game_requests values(actor,p_request_id,'edit',result,now());
 insert into public.game_events(world_id,version,kind,payload) values(p_world,w.version,'edit',result);
 return result;
end $$;

create or replace function public.game_place_lock(p_world uuid,p_x integer,p_y integer,p_kind text,p_expected_version integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();w public.game_worlds;v_tiles integer[];lock_id uuid;item integer;result jsonb;
begin
 select * into w from public.game_worlds where id=p_world for update;
 select r.result into result from public.game_requests r where user_id=actor and request_id=p_request_id and operation='lock';if found then return result;end if;
 if w.version is distinct from p_expected_version then raise exception 'STALE_VERSION';end if;
 if not public.game_rate('lock:'||actor,10,5) then raise exception 'RATE_LIMITED';end if;
 v_tiles:=public.game_preview_lock(p_world,p_x,p_y,p_kind);
 if (w.snapshot->'foreground'->>(p_y*100+p_x))::integer<>0 then raise exception 'TILE_OCCUPIED';end if;
 insert into public.game_locks(world_id,owner_id,kind,x,y,tiles) values(p_world,actor,p_kind,p_x,p_y,v_tiles) returning id into lock_id;
 item:=case p_kind when 'world' then 10 when 'diamond' then 11 when 'small' then 12 when 'big' then 13 else 14 end;
 update public.game_worlds set snapshot=jsonb_set(snapshot,array['foreground',(p_y*100+p_x)::text],to_jsonb(item)),version=version+1,updated_at=now(),owner_id=case when p_kind in ('world','diamond') then actor else owner_id end where id=p_world returning version into w.version;
 result:=jsonb_build_object('lock_id',lock_id,'version',w.version);
 insert into public.game_requests values(actor,p_request_id,'lock',result,now());
 insert into public.game_events(world_id,version,kind,payload) values(p_world,w.version,'resync',result);
 return result;
end $$;

create or replace function public.game_validate_snapshot(p_snapshot jsonb) returns void language plpgsql immutable set search_path=public,pg_temp as $$
declare v_layer text;tile jsonb;item integer;x numeric;y numeric;
begin
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or p_snapshot->>'schema'<>'1' or p_snapshot->>'width'<>'100' or p_snapshot->>'height'<>'60' or octet_length(p_snapshot::text)>10485760 then raise exception 'INVALID_WORLD';end if;
 if not (p_snapshot ?& array['schema','width','height','foreground','background','spawn']) then raise exception 'INVALID_WORLD';end if;
 foreach v_layer in array array['foreground','background'] loop
  if jsonb_typeof(p_snapshot->v_layer)<>'array' or jsonb_array_length(p_snapshot->v_layer)<>6000 then raise exception 'INVALID_WORLD';end if;
  for tile in select jsonb_array_elements(p_snapshot->v_layer) loop
   if jsonb_typeof(tile)<>'number' or tile::text !~ '^[0-9]+$' then raise exception 'INVALID_ITEM';end if;
   item:=tile::text::integer;
   if item not between 0 and 16 or (item<>0 and ((item=8)<>(v_layer='background'))) then raise exception 'INVALID_ITEM';end if;
  end loop;
 end loop;
 if jsonb_typeof(p_snapshot->'spawn'->'x')<>'number' or jsonb_typeof(p_snapshot->'spawn'->'y')<>'number' or not(p_snapshot->'spawn' ?& array['x','y']) then raise exception 'INVALID_SPAWN';end if;
 x:=(p_snapshot->'spawn'->>'x')::numeric;y:=(p_snapshot->'spawn'->>'y')::numeric;
 if x<0 or x>99 or y<0 or y>58 then raise exception 'INVALID_SPAWN';end if;
end $$;

create or replace function public.game_publish(p_world uuid,p_snapshot jsonb,p_expected_version integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();w public.game_worlds;result jsonb;n integer;item integer;
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED';end if;
 select * into w from public.game_worlds where id=p_world for update;
 select r.result into result from public.game_requests r where user_id=actor and request_id=p_request_id and operation='publish';if found then return result;end if;
 if not public.game_is_admin() and (w.owner_id is distinct from actor or exists(select 1 from public.game_locks where world_id=p_world and owner_id<>actor)) then raise exception 'OWNER_REQUIRED';end if;
 if w.version is distinct from p_expected_version then raise exception 'STALE_VERSION';end if;
 perform public.game_validate_snapshot(p_snapshot);
 for n in 0..5999 loop
  item:=(p_snapshot->'foreground'->>n)::integer;
  if ((w.snapshot->'foreground'->>n)::integer=15 or (n>=100 and (w.snapshot->'foreground'->>(n-100))::integer=15)) and p_snapshot->'foreground'->n is distinct from w.snapshot->'foreground'->n then raise exception 'ENTRANCE_PROTECTED';end if;
  if (item between 10 and 14 or exists(select 1 from public.game_locks where world_id=p_world and y*100+x=n)) and (p_snapshot->'foreground'->n is distinct from w.snapshot->'foreground'->n) then raise exception 'LOCK_TILE';end if;
 end loop;
 if not public.game_rate('publish:'||actor,10,1) then raise exception 'RATE_LIMITED';end if;
 update public.game_worlds set snapshot=p_snapshot,version=version+1,updated_at=now() where id=p_world returning version into w.version;
 result:=jsonb_build_object('version',w.version,'saved_at',now());
 insert into public.game_requests values(actor,p_request_id,'publish',result,now());
 insert into public.game_events(world_id,version,kind,payload) values(p_world,w.version,'resync',result);
 return result;
end $$;

create or replace function public.game_prune() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from public.game_memberships where seen_at<now()-interval '60 seconds';
 delete from public.game_events where created_at<now()-interval '10 minutes';
 delete from public.game_messages where created_at<now()-interval '7 days';
 delete from public.game_rate_limits where window_start<now()-interval '2 days';
 delete from public.game_requests where created_at<now()-interval '7 days';
 delete from public.game_tile_damage where heals_at<now();
end $$;
insert into public.game_schema_versions(version) values(10);
commit;
