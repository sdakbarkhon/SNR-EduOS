-- Live coding: teacher writes code in real time, students watch read-only.
alter table lesson_stages
  add column if not exists live_code text;
alter table lesson_stages
  add column if not exists is_live_active boolean default false;

comment on column lesson_stages.live_code is
  'Код учителя, транслируемый ученикам в реальном времени';
comment on column lesson_stages.is_live_active is
  'Идёт ли сейчас live-демонстрация для этого этапа';

grant update (live_code, is_live_active) on lesson_stages to authenticated;
