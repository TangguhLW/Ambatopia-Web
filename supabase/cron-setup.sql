begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('growtopia-game-prune','* * * * *','select public.game_prune()');
commit;
select jobname,active from cron.job where jobname='growtopia-game-prune';
