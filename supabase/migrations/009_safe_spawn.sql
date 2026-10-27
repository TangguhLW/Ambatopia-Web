begin;
create or replace function public.game_join(p_world uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();v_cap integer;v_snapshot jsonb;v_x numeric;v_y numeric;
begin
 if not public.game_rate('join:'||actor,60,20) then raise exception 'RATE_LIMITED'; end if;
 select snapshot into v_snapshot from public.game_worlds where id=p_world for update;
 if not found then raise exception 'WORLD_NOT_FOUND'; end if;
 select (value::text)::integer into v_cap from public.game_settings where key='world_cap';
 if (select count(*) from public.game_memberships where world_id=p_world and user_id<>actor and seen_at>now()-interval '60 seconds')>=v_cap and not public.game_is_admin() then raise exception 'WORLD_FULL'; end if;
 -- One empty tile fits the native 20 x 30 pixel body inside a 32 pixel tile.
 select x,y into v_x,v_y from generate_series(0,99) x cross join generate_series(0,58) y
 where (v_snapshot->'foreground'->>(y*100+x))::integer in (0,9)
 order by power(x-(v_snapshot->'spawn'->>'x')::numeric,2)+power(y-(v_snapshot->'spawn'->>'y')::numeric,2),y,x limit 1;
 if v_x is null then raise exception 'WORLD_HAS_NO_SAFE_SPAWN';end if;
 insert into public.game_memberships(user_id,world_id,x,y) values(actor,p_world,v_x,v_y)
 on conflict(user_id) do update set world_id=excluded.world_id,x=excluded.x,y=excluded.y,sequence=0,seen_at=now(),moved_at=now();
 update public.game_profiles set last_seen_at=now() where id=actor;
 insert into public.game_events(world_id,kind,payload) values(p_world,'join',jsonb_build_object('user_id',actor));
 return public.game_state(p_world);
end $$;
insert into public.game_schema_versions(version) values(9) on conflict do nothing;
commit;
