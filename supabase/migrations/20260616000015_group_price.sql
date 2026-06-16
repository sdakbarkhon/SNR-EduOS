-- Цена курса в месяц (UZS). Ученик видит через RLS своих групп.
alter table public.groups add column course_price integer not null default 0;
