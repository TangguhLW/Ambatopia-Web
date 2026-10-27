begin;
create function public.game_validate_snapshot(p_snapshot jsonb) returns void language plpgsql immutable set search_path=public,pg_temp as $$
declare v_layer text;tile jsonb;item integer;x numeric;y numeric;
begin
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or p_snapshot->>'schema'<>'1' or p_snapshot->>'width'<>'100' or p_snapshot->>'height'<>'60' or octet_length(p_snapshot::text)>10485760 then raise exception 'INVALID_WORLD';end if;
 if not (p_snapshot ?& array['schema','width','height','foreground','background','spawn']) then raise exception 'INVALID_WORLD';end if;
 foreach v_layer in array array['foreground','background'] loop
  if jsonb_typeof(p_snapshot->v_layer)<>'array' or jsonb_array_length(p_snapshot->v_layer)<>6000 then raise exception 'INVALID_WORLD';end if;
  for tile in select jsonb_array_elements(p_snapshot->v_layer) loop
   if jsonb_typeof(tile)<>'number' or tile::text !~ '^[0-9]+$' then raise exception 'INVALID_ITEM';end if;
   item:=tile::text::integer;
   if item not between 0 and 14 or (item<>0 and ((item=8)<>(v_layer='background'))) then raise exception 'INVALID_ITEM';end if;
  end loop;
 end loop;
 if jsonb_typeof(p_snapshot->'spawn'->'x')<>'number' or jsonb_typeof(p_snapshot->'spawn'->'y')<>'number' or not(p_snapshot->'spawn' ?& array['x','y']) then raise exception 'INVALID_SPAWN';end if;
 x:=(p_snapshot->'spawn'->>'x')::numeric;y:=(p_snapshot->'spawn'->>'y')::numeric;
 if x<0 or x>99 or y<0 or y>58 then raise exception 'INVALID_SPAWN';end if;
end $$;
create function public.game_publish(p_world uuid,p_snapshot jsonb,p_expected_version integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
  if (item>=10 or exists(select 1 from public.game_locks where world_id=p_world and y*100+x=n)) and (p_snapshot->'foreground'->n is distinct from w.snapshot->'foreground'->n) then raise exception 'LOCK_TILE';end if;
 end loop;
 if not public.game_rate('publish:'||actor,10,1) then raise exception 'RATE_LIMITED';end if;
 update public.game_worlds set snapshot=p_snapshot,version=version+1,updated_at=now() where id=p_world returning version into w.version;
 result:=jsonb_build_object('version',w.version,'saved_at',now());
 insert into public.game_requests values(actor,p_request_id,'publish',result,now());
 insert into public.game_events(world_id,version,kind,payload) values(p_world,w.version,'resync',result);
 return result;
end $$;
create function public.game_audit_developer_write() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();row_data jsonb;
begin
 if v_actor is not null and exists(select 1 from public.game_profiles where id=v_actor and role='superadmin') then
  row_data:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.game_admin_audit(actor,action,target,payload) values(v_actor,TG_TABLE_NAME||':'||TG_OP,coalesce(row_data->>'world_id',row_data->>'id',row_data->>'lock_id'),jsonb_build_object('version',row_data->'version'));
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
create trigger game_worlds_admin_audit after update on public.game_worlds for each row execute function public.game_audit_developer_write();
create trigger game_locks_admin_audit after insert or update or delete on public.game_locks for each row execute function public.game_audit_developer_write();
create trigger game_grants_admin_audit after insert or delete on public.game_lock_grants for each row execute function public.game_audit_developer_write();
revoke all on function public.game_validate_snapshot(jsonb),public.game_publish(uuid,jsonb,integer,uuid),public.game_audit_developer_write() from public,anon,authenticated;
grant execute on function public.game_publish(uuid,jsonb,integer,uuid) to authenticated;
insert into public.game_schema_versions(version) values(6);
commit;
