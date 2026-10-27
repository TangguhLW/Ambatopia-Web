begin;
-- Two clients passed one smoke run, but repeated Internet latency is variable.
-- Keep the public beta small until a sustained regional load test is available.
update public.game_settings set value='2'::jsonb where key='world_cap';
insert into public.game_schema_versions(version) values(7);
commit;
