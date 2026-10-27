begin;
create table public.game_worlds (
 id uuid primary key default gen_random_uuid(),name text not null unique check(name ~ '^[A-Z0-9]{1,24}$'),
 owner_id uuid references public.game_profiles(id),version integer not null default 0,
 snapshot jsonb not null,created_by uuid not null references public.game_profiles(id),request_id uuid not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(created_by,request_id)
);
create table public.game_memberships (
 user_id uuid primary key references public.game_profiles(id) on delete cascade,
 world_id uuid not null references public.game_worlds(id) on delete cascade,
 x numeric not null default 5,y numeric not null default 22,facing text not null default 'right',animation text not null default 'idle',
 sequence bigint not null default 0,seen_at timestamptz not null default now(),moved_at timestamptz not null default now()
);
create index game_active_world on public.game_memberships(world_id,seen_at);
create table public.game_events (
 id uuid primary key default gen_random_uuid(),world_id uuid not null references public.game_worlds(id) on delete cascade,
 version integer,kind text not null,payload jsonb not null,created_at timestamptz not null default now()
);
create index game_events_world on public.game_events(world_id,created_at);
create table public.game_requests (
 user_id uuid not null references public.game_profiles(id) on delete cascade,request_id uuid not null,
 operation text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table public.game_worlds enable row level security;
alter table public.game_memberships enable row level security;
alter table public.game_events enable row level security;
alter table public.game_requests enable row level security;
revoke all on public.game_worlds,public.game_memberships,public.game_events,public.game_requests from anon,authenticated;
grant all on public.game_worlds,public.game_memberships,public.game_events,public.game_requests to service_role;

create function public.game_member(p_world uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.game_memberships where world_id=p_world and user_id=public.game_actor() and seen_at>now()-interval '60 seconds')
$$;
create function public.game_worlds_list(p_query text default '',p_cursor text default '',p_limit integer default 30) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.game_actor();
 if length(p_query)>24 then raise exception 'INVALID_SEARCH'; end if;
 return coalesce((select jsonb_agg(row_to_json(t)) from (
 select w.id,w.name,w.owner_id,w.version,w.updated_at,(select count(*) from public.game_memberships m where m.world_id=w.id and m.seen_at>now()-interval '60 seconds') player_count
 from public.game_worlds w where w.name like upper(p_query)||'%' and w.name>p_cursor order by w.name limit least(greatest(p_limit,1),30)
 )t),'[]'::jsonb);
end $$;
create function public.game_create_world(p_name text,p_request_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();world uuid;fg jsonb;bg jsonb;
begin
 select id into world from public.game_worlds where created_by=actor and request_id=p_request_id;
 if found then return world; end if;
 if not public.game_rate('create:'||actor,60,5) then raise exception 'RATE_LIMITED'; end if;
 if p_name !~ '^[A-Za-z0-9]{1,24}$' then raise exception 'INVALID_WORLD_NAME'; end if;
 select jsonb_agg(case when n/100=59 then 3 when n/100>24 then 1 when n/100=24 then 2 else 0 end order by n),
 jsonb_agg(case when n/100>=24 then 8 else 0 end order by n) into fg,bg from generate_series(0,5999)n;
 insert into public.game_worlds(name,created_by,request_id,snapshot) values(upper(p_name),actor,p_request_id,jsonb_build_object('schema',1,'width',100,'height',60,'foreground',fg,'background',bg,'spawn',jsonb_build_object('x',5,'y',22))) returning id into world;
 return world;
end $$;
create function public.game_state(p_world uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED'; end if;
 select jsonb_build_object('world',to_jsonb(w)-'snapshot'-'request_id','snapshot',w.snapshot,
 'players',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'grow_id',p.grow_id,'x',m.x,'y',m.y,'facing',m.facing,'animation',m.animation,'sequence',m.sequence,'appearance',p.appearance,'role',p.role,'god_mode',p.god_mode))
 from public.game_memberships m join public.game_profiles p on p.id=m.user_id where m.world_id=p_world and m.seen_at>now()-interval '60 seconds'),'[]'::jsonb)) into result from public.game_worlds w where w.id=p_world;
 return result;
end $$;
create function public.game_join(p_world uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();v_cap integer;v_spawn jsonb;
begin
 if not public.game_rate('join:'||actor,60,20) then raise exception 'RATE_LIMITED'; end if;
 perform 1 from public.game_worlds where id=p_world for update;
 if not found then raise exception 'WORLD_NOT_FOUND'; end if;
 select (value::text)::integer into v_cap from public.game_settings where key='world_cap';
 if (select count(*) from public.game_memberships where world_id=p_world and user_id<>actor and seen_at>now()-interval '60 seconds')>=v_cap and not public.game_is_admin() then raise exception 'WORLD_FULL'; end if;
 select snapshot->'spawn' into v_spawn from public.game_worlds where id=p_world;
 insert into public.game_memberships(user_id,world_id,x,y) values(actor,p_world,(v_spawn->>'x')::numeric,(v_spawn->>'y')::numeric)
 on conflict(user_id) do update set world_id=excluded.world_id,x=excluded.x,y=excluded.y,sequence=0,seen_at=now(),moved_at=now();
 update public.game_profiles set last_seen_at=now() where id=actor;
 insert into public.game_events(world_id,kind,payload) values(p_world,'join',jsonb_build_object('user_id',actor));
 return public.game_state(p_world);
end $$;
create function public.game_leave(p_world uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();
begin
 delete from public.game_memberships where user_id=actor and world_id=p_world;
 insert into public.game_events(world_id,kind,payload) select p_world,'leave',jsonb_build_object('user_id',actor) where exists(select 1 from public.game_worlds where id=p_world);
end $$;
create function public.game_heartbeat(p_world uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=public.game_actor();
begin
 if not public.game_member(p_world) then raise exception 'WORLD_ACCESS_DENIED'; end if;
 update public.game_memberships set seen_at=now() where user_id=actor;
 update public.game_profiles set last_seen_at=now() where id=actor;
end $$;
grant select on public.game_events to authenticated;
create policy game_events_member on public.game_events for select to authenticated using(public.game_member(world_id));
revoke all on function public.game_member(uuid),public.game_worlds_list(text,text,integer),public.game_create_world(text,uuid),public.game_state(uuid),public.game_join(uuid),public.game_leave(uuid),public.game_heartbeat(uuid) from public,anon,authenticated;
grant execute on function public.game_member(uuid),public.game_worlds_list(text,text,integer),public.game_create_world(text,uuid),public.game_state(uuid),public.game_join(uuid),public.game_leave(uuid),public.game_heartbeat(uuid) to authenticated;
insert into public.game_schema_versions(version) values(2);
commit;
