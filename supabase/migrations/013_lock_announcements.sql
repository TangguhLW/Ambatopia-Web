begin;
create or replace function public.game_place_lock(p_world uuid,p_x integer,p_y integer,p_kind text,p_expected_version integer,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();w public.game_worlds;v_tiles integer[];lock_id uuid;item integer;result jsonb;owner_name text;
begin
 select * into w from public.game_worlds where id=p_world for update;
 select r.result into result from public.game_requests r where user_id=actor and request_id=p_request_id and operation='lock';if found then return result;end if;
 if w.version is distinct from p_expected_version then raise exception 'STALE_VERSION';end if;
 if not public.game_rate('lock:'||actor,10,5) then raise exception 'RATE_LIMITED';end if;
 v_tiles:=public.game_preview_lock(p_world,p_x,p_y,p_kind);
 if (w.snapshot->'foreground'->>(p_y*100+p_x))::integer<>0 then raise exception 'TILE_OCCUPIED';end if;
 if exists(select 1 from public.game_memberships m where m.world_id=p_world and m.seen_at>now()-interval '60 seconds' and m.x<p_x+1 and m.x+20.0/32>p_x and m.y<p_y+1 and m.y+30.0/32>p_y) then raise exception 'PLAYER_IN_TILE';end if;
 insert into public.game_locks(world_id,owner_id,kind,x,y,tiles) values(p_world,actor,p_kind,p_x,p_y,v_tiles) returning id into lock_id;
 item:=case p_kind when 'world' then 10 when 'diamond' then 11 when 'small' then 12 when 'big' then 13 else 14 end;
 update public.game_worlds set snapshot=jsonb_set(snapshot,array['foreground',(p_y*100+p_x)::text],to_jsonb(item)),version=version+1,updated_at=now(),owner_id=case when p_kind in ('world','diamond') then actor else owner_id end where id=p_world returning version into w.version;
 select grow_id into owner_name from public.game_profiles where id=actor;
 result:=jsonb_build_object('lock_id',lock_id,'version',w.version,'owner_id',actor,'owner_name',owner_name,'kind',p_kind,'x',p_x,'y',p_y,'tiles_count',cardinality(v_tiles));
 insert into public.game_requests values(actor,p_request_id,'lock',result,now());
 insert into public.game_events(world_id,version,kind,payload) values(p_world,w.version,'lock',result);
 return result;
end $$;

insert into public.game_schema_versions(version) values(13);
commit;
