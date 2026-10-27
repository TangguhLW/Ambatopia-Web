begin;
create table public.game_schema_versions(version integer primary key,applied_at timestamptz not null default now());
alter table public.game_schema_versions enable row level security;
revoke all on public.game_schema_versions from public,anon,authenticated;
grant select on public.game_schema_versions to service_role;
insert into public.game_schema_versions(version) values(1);
create table public.game_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 grow_id text not null check(grow_id ~ '^[A-Za-z0-9_]{3,20}$'),
 grow_key text generated always as (lower(grow_id)) stored unique,
 role text not null default 'player' check(role in ('player','superadmin')),
 created_at timestamptz not null default now(), last_login_at timestamptz, last_seen_at timestamptz,
 appearance jsonb not null default '{}', inventory jsonb not null default '{}',
 god_mode boolean not null default false,
 check((role='superadmin')=(lower(grow_id)='thaney'))
);
create unique index game_single_admin on public.game_profiles(role) where role='superadmin';
create table public.game_account_identities (
 grow_key text primary key, user_id uuid not null unique references public.game_profiles(id) on delete cascade,
 auth_email text not null unique
);
create table public.game_bans (
 user_id uuid primary key references public.game_profiles(id) on delete cascade,
 reason text not null default '', created_at timestamptz not null default now()
);
create table public.game_admin_audit (
 id uuid primary key default gen_random_uuid(), actor uuid references public.game_profiles(id),
 action text not null, target text, payload jsonb not null default '{}', created_at timestamptz not null default now(),
 request_id uuid unique
);
create table public.game_rate_limits (
 bucket text primary key, window_start timestamptz not null default clock_timestamp(), attempts integer not null default 1
);
create table public.game_sessions (
 session_id uuid primary key,user_id uuid not null references public.game_profiles(id) on delete cascade,
 revoked boolean not null default false,created_at timestamptz not null default now()
);
alter table public.game_sessions enable row level security;
revoke all on public.game_sessions from public,anon,authenticated;
grant all on public.game_sessions to service_role;
create function public.game_activate_session(p_user uuid,p_session uuid) returns void language sql security definer set search_path=public,pg_temp as $$
 insert into public.game_sessions(session_id,user_id) values(p_session,p_user) on conflict(session_id) do nothing
$$;
create function public.game_revoke_sessions(p_user uuid) returns void language sql security definer set search_path=public,pg_temp as $$
 update public.game_sessions set revoked=true where user_id=p_user
$$;
revoke all on function public.game_activate_session(uuid,uuid),public.game_revoke_sessions(uuid) from public,anon,authenticated;
grant execute on function public.game_activate_session(uuid,uuid),public.game_revoke_sessions(uuid) to service_role;
create table public.game_settings (key text primary key, value jsonb not null);
insert into public.game_settings values ('world_cap','8');
alter table public.game_profiles enable row level security;
alter table public.game_account_identities enable row level security;
alter table public.game_bans enable row level security;
alter table public.game_admin_audit enable row level security;
alter table public.game_rate_limits enable row level security;
alter table public.game_settings enable row level security;
revoke all on public.game_profiles,public.game_account_identities,public.game_bans,public.game_admin_audit,public.game_rate_limits,public.game_settings from anon,authenticated;
grant all on public.game_profiles,public.game_account_identities,public.game_bans,public.game_admin_audit,public.game_rate_limits,public.game_settings to service_role;

create function public.game_actor() returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_id uuid:=auth.uid();
begin
 if v_id is null or not exists(select 1 from public.game_profiles where id=v_id) then raise exception 'LOGIN_REQUIRED'; end if;
 if exists(select 1 from public.game_bans where user_id=v_id) then raise exception 'ACCOUNT_BANNED'; end if;
 if not exists(select 1 from public.game_sessions where user_id=v_id and session_id=(auth.jwt()->>'session_id')::uuid and not revoked) then raise exception 'SESSION_REVOKED';end if;
 return v_id;
end $$;
create function public.game_is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.game_profiles where id=public.game_actor() and role='superadmin')
$$;
create function public.game_me() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select to_jsonb(p)-'grow_key' from public.game_profiles p where p.id=public.game_actor()
$$;
create function public.game_register(p_id uuid,p_grow_id text,p_email text,p_admin boolean default false) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if lower(p_grow_id)='thaney' and not p_admin then raise exception 'NAME_RESERVED'; end if;
 if p_admin and lower(p_grow_id)<>'thaney' then raise exception 'INVALID_ADMIN'; end if;
 insert into public.game_profiles(id,grow_id,role,last_login_at,last_seen_at) values(p_id,p_grow_id,case when p_admin then 'superadmin' else 'player' end,now(),now());
 insert into public.game_account_identities values(lower(p_grow_id),p_id,p_email);
 if p_admin then insert into public.game_admin_audit(actor,action,target) values(p_id,'bootstrap',p_id::text); end if;
 return (select to_jsonb(p)-'grow_key' from public.game_profiles p where p.id=p_id);
end $$;
create function public.game_rate(p_bucket text,p_seconds integer,p_limit integer) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_attempts integer;
begin
 insert into public.game_rate_limits(bucket) values(p_bucket)
 on conflict(bucket) do update set
 attempts=case when game_rate_limits.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then 1 else game_rate_limits.attempts+1 end,
 window_start=case when game_rate_limits.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else game_rate_limits.window_start end
 returning attempts into v_attempts;
 return v_attempts<=p_limit;
end $$;
create function public.game_record_login() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.game_profiles set last_login_at=now(),last_seen_at=now() where id=public.game_actor();
 return public.game_me();
end $$;
create function public.game_touch() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.game_profiles set last_seen_at=now() where id=public.game_actor();
end $$;
revoke all on function public.game_touch() from public,anon,authenticated;
grant execute on function public.game_touch() to authenticated;
revoke all on function public.game_actor(),public.game_is_admin(),public.game_me(),public.game_register(uuid,text,text,boolean),public.game_rate(text,integer,integer),public.game_record_login() from public,anon,authenticated;
grant execute on function public.game_actor(),public.game_is_admin(),public.game_me(),public.game_record_login() to authenticated;
grant execute on function public.game_register(uuid,text,text,boolean),public.game_rate(text,integer,integer) to service_role;
commit;
