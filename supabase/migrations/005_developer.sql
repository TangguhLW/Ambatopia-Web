begin;
create function public.game_admin_users(p_query text default '',p_offset integer default 0,p_limit integer default 30) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.game_is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (
 select p.id,p.grow_id,p.role,p.created_at,p.last_login_at,p.last_seen_at,
 ((p.last_seen_at>now()-interval '60 seconds') and exists(select 1 from public.game_sessions s where s.user_id=p.id and not s.revoked)) is true as online,m.world_id,w.name as world_name,
 exists(select 1 from public.game_bans b where b.user_id=p.id) as banned
 from public.game_profiles p left join public.game_memberships m on m.user_id=p.id left join public.game_worlds w on w.id=m.world_id
 where p.grow_key like lower(left(p_query,20))||'%' order by p.created_at,p.id limit least(greatest(p_limit,1),50) offset greatest(p_offset,0))t),'[]'::jsonb);
end $$;
create function public.game_admin_player(p_user uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.game_is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 return (select jsonb_build_object('profile',to_jsonb(p)-'grow_key','state',(select to_jsonb(m) from public.game_memberships m where user_id=p_user),'ban',(select to_jsonb(b) from public.game_bans b where user_id=p_user)) from public.game_profiles p where id=p_user);
end $$;
create function public.game_admin_world(p_world uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.game_is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 return (select jsonb_build_object('world',to_jsonb(w)-'snapshot','locks',coalesce((select jsonb_agg(to_jsonb(l)) from public.game_locks l where world_id=p_world),'[]'::jsonb),'grants',coalesce((select jsonb_agg(to_jsonb(g)) from public.game_lock_grants g join public.game_locks l on l.id=g.lock_id where l.world_id=p_world),'[]'::jsonb)) from public.game_worlds w where id=p_world);
end $$;
create function public.game_admin_action(p_action text,p_target uuid,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=public.game_actor();result jsonb;v_world uuid;
begin
 if not public.game_is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if p_action is null or p_action not in ('teleport','god_mode','kick','ban','unban','grant','revoke') then raise exception 'INVALID_ACTION';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1024 then raise exception 'INVALID_PAYLOAD';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_actor::text,0));
 select payload into result from public.game_admin_audit where request_id=p_request_id and game_admin_audit.actor=v_actor;
 if found then return result;end if;
 if p_action in ('ban','kick') then
  if exists(select 1 from public.game_profiles where id=p_target and role='superadmin') then raise exception 'ADMIN_PROTECTED';end if;
  if not exists(select 1 from public.game_profiles where id=p_target) then raise exception 'PLAYER_NOT_FOUND';end if;
  select world_id into v_world from public.game_memberships where user_id=p_target;
  if p_action='ban' then insert into public.game_bans(user_id,reason) values(p_target,left(coalesce(p_payload->>'reason',''),240)) on conflict(user_id) do update set reason=excluded.reason;end if;
  update public.game_sessions set revoked=true where user_id=p_target;
  delete from public.game_memberships where user_id=p_target;
  if v_world is not null then insert into public.game_events(world_id,kind,payload) values(v_world,'leave',jsonb_build_object('user_id',p_target));end if;
 elsif p_action='unban' then delete from public.game_bans where user_id=p_target;
 elsif p_action='god_mode' then
  if p_target<>v_actor or jsonb_typeof(p_payload->'enabled')<>'boolean' then raise exception 'INVALID_PAYLOAD';end if;
  update public.game_profiles set god_mode=(p_payload->>'enabled')::boolean where id=v_actor;
 elsif p_action='teleport' then perform public.game_join(p_target);
 elsif p_action in ('grant','revoke') then perform public.game_grant(p_target,p_payload->>'grow_id',p_action='grant');
 end if;
 result:=jsonb_build_object('ok',true,'action',p_action,'target',p_target,'saved_at',now());
 insert into public.game_admin_audit(actor,action,target,payload,request_id) values(v_actor,p_action,p_target::text,result,p_request_id);
 return result;
end $$;
revoke all on function public.game_admin_users(text,integer,integer),public.game_admin_player(uuid),public.game_admin_world(uuid),public.game_admin_action(text,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.game_admin_users(text,integer,integer),public.game_admin_player(uuid),public.game_admin_world(uuid),public.game_admin_action(text,uuid,jsonb,uuid) to authenticated;
insert into public.game_schema_versions(version) values(5);
commit;
