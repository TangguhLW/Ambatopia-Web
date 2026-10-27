begin;
update public.game_settings set value='32'::jsonb where key='world_cap';
create table public.game_world_stream(world_id uuid primary key references public.game_worlds(id) on delete cascade,head bigint not null default 0);
alter table public.game_world_stream enable row level security;
revoke all on public.game_world_stream from public,anon,authenticated;
grant all on public.game_world_stream to service_role;
alter table public.game_events add column stream_sequence bigint not null default 0;
create unique index game_events_stream on public.game_events(world_id,stream_sequence) where stream_sequence>0;
create function public.game_sequence_event() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.kind='move' then return null;end if;
 insert into public.game_world_stream(world_id,head) values(new.world_id,1) on conflict(world_id) do update set head=game_world_stream.head+1 returning head into new.stream_sequence;
 return new;
end $$;
revoke all on function public.game_sequence_event() from public,anon,authenticated;
create trigger game_events_sequence before insert on public.game_events for each row execute function public.game_sequence_event();

create function public.game_roster(p_world uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED';end if;
 return jsonb_build_object('version',(select version from public.game_worlds where id=p_world),'players',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'grow_id',p.grow_id,'x',m.x,'y',m.y,'facing',m.facing,'animation',m.animation,'sequence',m.sequence,'appearance',p.appearance,'role',p.role,'god_mode',p.god_mode))
  from public.game_memberships m join public.game_profiles p on p.id=m.user_id where m.world_id=p_world and m.seen_at>now()-interval '60 seconds'),'[]'::jsonb));
end $$;
revoke all on function public.game_roster(uuid) from public,anon,authenticated;
grant execute on function public.game_roster(uuid) to authenticated;

create function public.game_sync_motion(p_world uuid,p_after bigint default null,p_x numeric default null,p_y numeric default null,p_facing text default null,p_animation text default null,p_sequence bigint default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare accepted boolean:=false;players jsonb;events jsonb;cursor_value bigint;stream_head bigint;world_version bigint;
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED';end if;
 if p_after is not null and p_after<0 then raise exception 'INVALID_CURSOR';end if;
 if p_sequence is not null then accepted:=public.game_move(p_world,p_x,p_y,p_facing,p_animation,p_sequence);end if;
 select version into world_version from public.game_worlds where id=p_world;
 select coalesce(head,0) into stream_head from public.game_world_stream where world_id=p_world;stream_head:=coalesce(stream_head,0);
 select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'x',m.x,'y',m.y,'facing',m.facing,'animation',m.animation,'sequence',m.sequence)),'[]'::jsonb) into players
  from public.game_memberships m where m.world_id=p_world and m.seen_at>now()-interval '60 seconds';
 if p_after is null then events:='[]'::jsonb;cursor_value:=stream_head;
 else
  select coalesce(jsonb_agg(to_jsonb(e) order by e.stream_sequence),'[]'::jsonb),coalesce(max(e.stream_sequence),greatest(p_after,stream_head)) into events,cursor_value
   from (select id,kind,payload,version,created_at,stream_sequence from public.game_events where world_id=p_world and stream_sequence>p_after order by stream_sequence limit 128)e;
 end if;
 return jsonb_build_object('accepted',accepted,'players',players,'events',events,'cursor',cursor_value,'head',stream_head,'version',world_version,'server_time',clock_timestamp());
end $$;
revoke all on function public.game_sync_motion(uuid,bigint,numeric,numeric,text,text,bigint) from public,anon,authenticated;
grant execute on function public.game_sync_motion(uuid,bigint,numeric,numeric,text,text,bigint) to authenticated;
insert into public.game_schema_versions(version) values(12);
commit;
