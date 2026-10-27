begin;
create table public.game_locks (
 id uuid primary key default gen_random_uuid(),world_id uuid not null references public.game_worlds(id) on delete cascade,
 owner_id uuid not null references public.game_profiles(id),kind text not null check(kind in ('world','diamond','small','big','huge')),
 x integer not null check(x between 0 and 99),y integer not null check(y between 0 and 58),tiles integer[] not null,
 created_at timestamptz not null default now(),unique(world_id,x,y)
);
create unique index game_one_world_lock on public.game_locks(world_id) where kind in ('world','diamond');
create table public.game_lock_grants (
 lock_id uuid not null references public.game_locks(id) on delete cascade,user_id uuid not null references public.game_profiles(id),primary key(lock_id,user_id)
);
alter table public.game_locks enable row level security;
alter table public.game_lock_grants enable row level security;
revoke all on public.game_locks,public.game_lock_grants from anon,authenticated;
grant all on public.game_locks,public.game_lock_grants to service_role;

create function public.game_can_edit(p_world uuid,p_tile integer) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.game_is_admin() or not exists(
 select 1 from public.game_locks l where l.world_id=p_world and (l.kind in ('world','diamond') or p_tile=any(l.tiles))
 and l.owner_id<>public.game_actor() and not exists(select 1 from public.game_lock_grants g where g.lock_id=l.id and g.user_id=public.game_actor()))
$$;
create function public.game_reach(p_world uuid,p_x integer,p_y integer) returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();m public.game_memberships;
begin
 if p_x is null or p_y is null or p_x not between 0 and 99 or p_y not between 0 and 58 then raise exception 'INVALID_TILE'; end if;
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED'; end if;
 select * into m from public.game_memberships where user_id=actor;
 if not public.game_is_admin() and (abs(m.x-p_x)>6 or abs(m.y-p_y)>6) then raise exception 'OUT_OF_REACH'; end if;
end $$;
create function public.game_locks_list(p_world uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED'; end if;
 return coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('owner_name',p.grow_id,'grants',coalesce((select jsonb_agg(jsonb_build_object('user_id',g.user_id,'grow_id',u.grow_id)) from public.game_lock_grants g join public.game_profiles u on u.id=g.user_id where g.lock_id=l.id),'[]'::jsonb))) from public.game_locks l join public.game_profiles p on p.id=l.owner_id where l.world_id=p_world),'[]'::jsonb);
end $$;
create function public.game_preview_lock(p_world uuid,p_x integer,p_y integer,p_kind text) returns integer[] language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tiles integer[]:='{}';queue integer[];visited integer[]:='{}';pos integer:=1;n integer;candidate integer;v_cap integer;actor uuid:=public.game_actor();
begin
 perform public.game_reach(p_world,p_x,p_y);
 if p_kind is null or p_kind not in ('world','diamond','small','big','huge') then raise exception 'INVALID_LOCK'; end if;
 if not public.game_can_edit(p_world,p_y*100+p_x) then raise exception 'LOCKED'; end if;
 if exists(select 1 from public.game_locks where world_id=p_world and (x=p_x and y=p_y or kind in ('world','diamond'))) then raise exception 'LOCK_ALREADY_EXISTS'; end if;
 if p_kind in ('world','diamond') then
  if exists(select 1 from public.game_locks where world_id=p_world and owner_id<>actor) and not public.game_is_admin() then raise exception 'FOREIGN_LOCK'; end if;
  return array(select generate_series(0,5999));
 end if;
 v_cap:=case p_kind when 'small' then 10 when 'big' then 48 else 200 end;
 queue:=array[p_y*100+p_x];
 while pos<=cardinality(queue) and cardinality(tiles)<v_cap loop
  n:=queue[pos];pos:=pos+1;
  if n=any(visited) then continue; end if;visited:=array_append(visited,n);
  if n<0 or n>=5900 or not public.game_can_edit(p_world,n) or exists(select 1 from public.game_locks where world_id=p_world and (n=any(game_locks.tiles) or y*100+x=n)) then continue; end if;
  tiles:=array_append(tiles,n);
  if n>=100 then queue:=array_append(queue,n-100); end if;
  if n%100<99 then queue:=array_append(queue,n+1); end if;
  if n<5800 then queue:=array_append(queue,n+100); end if;
  if n%100>0 then queue:=array_append(queue,n-1); end if;
 end loop;
 if cardinality(tiles)=0 then raise exception 'NO_LOCK_SPACE'; end if;
 return tiles;
end $$;
create function public.game_place_lock(p_world uuid,p_x integer,p_y integer,p_kind text,p_expected_version integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
create function public.game_edit(p_world uuid,p_expected_version integer,p_edits jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
  if item is null or item not between 0 and 9 or item=3 or layer is null or layer not in ('foreground','background') or (item<>0 and ((item=8)<>(layer='background'))) then raise exception 'INVALID_ITEM';end if;
  if not public.game_can_edit(p_world,y*100+x) then raise exception 'LOCKED';end if;
  if exists(select 1 from public.game_locks where world_id=p_world and game_locks.x=(e->>'x')::integer and game_locks.y=(e->>'y')::integer) then raise exception 'LOCK_TILE';end if;
  w.snapshot:=jsonb_set(w.snapshot,array[layer,(y*100+x)::text],to_jsonb(item));
 end loop;
 update public.game_worlds set snapshot=w.snapshot,version=version+1,updated_at=now() where id=p_world returning version into w.version;
 result:=jsonb_build_object('version',w.version,'edits',p_edits,'saved_at',now());
 insert into public.game_requests values(actor,p_request_id,'edit',result,now());
 insert into public.game_events(world_id,version,kind,payload) values(p_world,w.version,'edit',result);
 return result;
end $$;
create function public.game_grant(p_lock uuid,p_target_grow_id text,p_allow boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();l public.game_locks;target uuid;
begin
 select * into l from public.game_locks where id=p_lock for update;
 if not found then raise exception 'LOCK_NOT_FOUND';end if;
 if l.owner_id<>actor and not public.game_is_admin() then raise exception 'OWNER_REQUIRED';end if;
 select id into target from public.game_profiles where grow_key=lower(p_target_grow_id);if not found then raise exception 'PLAYER_NOT_FOUND';end if;
 if p_allow then insert into public.game_lock_grants values(p_lock,target) on conflict do nothing;else delete from public.game_lock_grants where lock_id=p_lock and user_id=target;end if;
 insert into public.game_events(world_id,kind,payload) values(l.world_id,'permissions',jsonb_build_object('lock_id',p_lock));
end $$;
create function public.game_remove_lock(p_lock uuid,p_expected_version integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();l public.game_locks;w public.game_worlds;result jsonb;
begin
 select r.result into result from public.game_requests r where user_id=actor and request_id=p_request_id and operation='unlock';if found then return result;end if;
 select * into l from public.game_locks where id=p_lock;
 if not found then raise exception 'LOCK_NOT_FOUND';end if;
 select * into w from public.game_worlds where id=l.world_id for update;
 if l.owner_id<>actor and not public.game_is_admin() then raise exception 'OWNER_REQUIRED';end if;
 if w.version is distinct from p_expected_version then raise exception 'STALE_VERSION';end if;
 delete from public.game_locks where id=p_lock;
 update public.game_worlds set snapshot=jsonb_set(snapshot,array['foreground',(l.y*100+l.x)::text],'0'),version=version+1,updated_at=now(),owner_id=case when l.kind in ('world','diamond') then null else owner_id end where id=l.world_id returning version into w.version;
 result:=jsonb_build_object('version',w.version);
 insert into public.game_requests values(actor,p_request_id,'unlock',result,now());
 insert into public.game_events(world_id,version,kind,payload) values(l.world_id,w.version,'resync',result);
 return result;
end $$;
revoke all on function public.game_can_edit(uuid,integer),public.game_reach(uuid,integer,integer),public.game_locks_list(uuid),public.game_preview_lock(uuid,integer,integer,text),public.game_place_lock(uuid,integer,integer,text,integer,uuid),public.game_edit(uuid,integer,jsonb,uuid),public.game_grant(uuid,text,boolean),public.game_remove_lock(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.game_can_edit(uuid,integer),public.game_reach(uuid,integer,integer),public.game_locks_list(uuid),public.game_preview_lock(uuid,integer,integer,text),public.game_place_lock(uuid,integer,integer,text,integer,uuid),public.game_edit(uuid,integer,jsonb,uuid),public.game_grant(uuid,text,boolean),public.game_remove_lock(uuid,integer,uuid) to authenticated;
insert into public.game_schema_versions(version) values(4);
commit;
