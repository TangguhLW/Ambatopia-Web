begin;
create function public.game_respawn(p_world uuid,p_sequence bigint,p_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();s jsonb;door integer;m public.game_memberships;result jsonb;
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED';end if;
 select * into m from public.game_memberships where user_id=actor and world_id=p_world for update;if not found then raise exception 'WORLD_ACCESS_DENIED';end if;
 select r.result into result from public.game_requests r where r.user_id=actor and r.request_id=p_request_id and r.operation='respawn';if found then return result;end if;
 if p_sequence is null or p_sequence<0 or p_sequence>1000000000000 or p_request_id is null then raise exception 'INVALID_POSITION';end if;
 if not public.game_rate('respawn:'||actor,10,3) then raise exception 'RATE_LIMITED';end if;
 select snapshot into s from public.game_worlds where id=p_world;
 select ordinality::integer-1 into door from jsonb_array_elements(s->'foreground') with ordinality t(value,ordinality) where value='15'::jsonb order by ordinality limit 1;
 if door is null then raise exception 'WORLD_HAS_NO_SAFE_SPAWN';end if;
 update public.game_memberships set x=door%100+6.0/32,y=door/100+2.0/32,facing='right',animation='idle',sequence=greatest(sequence,p_sequence)+1,moved_at=now(),seen_at=now() where user_id=actor returning * into m;
 result:=jsonb_build_object('user_id',actor,'x',m.x,'y',m.y,'facing',m.facing,'animation',m.animation,'sequence',m.sequence);
 insert into public.game_requests values(actor,p_request_id,'respawn',result,now());
 insert into public.game_events(world_id,kind,payload) values(p_world,'move',result);return result;
end $$;
revoke all on function public.game_respawn(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.game_respawn(uuid,bigint,uuid) to authenticated;
insert into public.game_schema_versions(version) values(11);
commit;
