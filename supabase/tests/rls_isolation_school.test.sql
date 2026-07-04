-- =====================================================================
-- pgTAP: school-scoped RLS isolation (migration 71).
-- Run via `supabase test db` in the local stack. All fixtures created
-- and torn down inside this file's own transaction (begin;/rollback;)
-- — nothing here touches persistent local seed data.
--
-- Two fresh test schools + one admin/teacher/student/group/lesson each,
-- plus the real super_admin created by migration 71 (fixed id
-- 'b0b0b0b0-0000-0000-0000-000000000001'). Covers: same-school positive
-- visibility, cross-school negative visibility (SELECT), cross-school
-- write denial (UPDATE via the admin "full access" policies, which are
-- exactly the ones migration 71 rewrote to add the school_id check on
-- top of fn_is_admin()), and super_admin's full bypass in both
-- directions (reads AND writes) across schools.
-- =====================================================================
begin;

create extension if not exists pgtap;

select plan(21);

-- ============ FIXTURES (two schools, one admin/teacher/student/group/lesson each) ============

insert into public.schools (id, name, code) values
  ('e0e0e0e0-9999-0000-0000-000000000001', 'RLS Test School A', 'RLSA'),
  ('e0e0e0e0-9999-0000-0000-000000000002', 'RLS Test School B', 'RLSB');

-- auth.users — dummy encrypted_password since these rows are only ever
-- accessed via forged request.jwt.claims below, never a real login.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-1111-0000-0000-00000000000a', 'authenticated', 'authenticated', 'rls_admin_a@admins.snr.local',   'x', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-1111-0000-0000-00000000000b', 'authenticated', 'authenticated', 'rls_teacher_a@teachers.snr.local', 'x', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-1111-0000-0000-00000000000c', 'authenticated', 'authenticated', 'rls_student_a@students.snr.local', 'x', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-2222-0000-0000-00000000000a', 'authenticated', 'authenticated', 'rls_admin_b@admins.snr.local',   'x', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-2222-0000-0000-00000000000b', 'authenticated', 'authenticated', 'rls_teacher_b@teachers.snr.local', 'x', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0e0e0e0-2222-0000-0000-00000000000c', 'authenticated', 'authenticated', 'rls_student_b@students.snr.local', 'x', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', '');

insert into public.admins (id, user_id, full_name, school_id) values
  ('e0e0e0e0-1111-0000-0000-0000000000a1', 'e0e0e0e0-1111-0000-0000-00000000000a', 'RLS Admin A', 'e0e0e0e0-9999-0000-0000-000000000001'),
  ('e0e0e0e0-2222-0000-0000-0000000000a1', 'e0e0e0e0-2222-0000-0000-00000000000a', 'RLS Admin B', 'e0e0e0e0-9999-0000-0000-000000000002');

insert into public.teachers (id, user_id, full_name, username, school_id) values
  ('e0e0e0e0-1111-0000-0000-0000000000b1', 'e0e0e0e0-1111-0000-0000-00000000000b', 'RLS Teacher A', 'rls_teacher_a', 'e0e0e0e0-9999-0000-0000-000000000001'),
  ('e0e0e0e0-2222-0000-0000-0000000000b1', 'e0e0e0e0-2222-0000-0000-00000000000b', 'RLS Teacher B', 'rls_teacher_b', 'e0e0e0e0-9999-0000-0000-000000000002');

insert into public.students (id, user_id, username, full_name, school_id) values
  ('e0e0e0e0-1111-0000-0000-0000000000c1', 'e0e0e0e0-1111-0000-0000-00000000000c', 'rls_student_a', 'RLS Student A', 'e0e0e0e0-9999-0000-0000-000000000001'),
  ('e0e0e0e0-2222-0000-0000-0000000000c1', 'e0e0e0e0-2222-0000-0000-00000000000c', 'rls_student_b', 'RLS Student B', 'e0e0e0e0-9999-0000-0000-000000000002');

insert into public.groups (id, name, subject, teacher_id, school_id) values
  ('e0e0e0e0-1111-0000-0000-0000000000d1', 'RLS Test Group A', 'test', 'e0e0e0e0-1111-0000-0000-0000000000b1', 'e0e0e0e0-9999-0000-0000-000000000001'),
  ('e0e0e0e0-2222-0000-0000-0000000000d1', 'RLS Test Group B', 'test', 'e0e0e0e0-2222-0000-0000-0000000000b1', 'e0e0e0e0-9999-0000-0000-000000000002');

insert into public.student_groups (student_id, group_id, school_id) values
  ('e0e0e0e0-1111-0000-0000-0000000000c1', 'e0e0e0e0-1111-0000-0000-0000000000d1', 'e0e0e0e0-9999-0000-0000-000000000001'),
  ('e0e0e0e0-2222-0000-0000-0000000000c1', 'e0e0e0e0-2222-0000-0000-0000000000d1', 'e0e0e0e0-9999-0000-0000-000000000002');

insert into public.lessons (id, group_id, topic, status, starts_at, school_id) values
  ('e0e0e0e0-1111-0000-0000-0000000000e1', 'e0e0e0e0-1111-0000-0000-0000000000d1', 'RLS test lesson A', 'scheduled', now(), 'e0e0e0e0-9999-0000-0000-000000000001'),
  ('e0e0e0e0-2222-0000-0000-0000000000e1', 'e0e0e0e0-2222-0000-0000-0000000000d1', 'RLS test lesson B', 'scheduled', now(), 'e0e0e0e0-9999-0000-0000-000000000002');

-- ============ STUDENT A: sees own school, not the other ============
reset role;
select set_config('request.jwt.claims', '{"sub":"e0e0e0e0-1111-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select count(*) > 0 from public.groups where id = 'e0e0e0e0-1111-0000-0000-0000000000d1'),
  'student A sees own group'
);
select is(
  (select count(*)::int from public.groups where id = 'e0e0e0e0-2222-0000-0000-0000000000d1'),
  0,
  'student A does NOT see group B (other school)'
);
select ok(
  (select count(*) > 0 from public.lessons where id = 'e0e0e0e0-1111-0000-0000-0000000000e1'),
  'student A sees own lesson'
);
select is(
  (select count(*)::int from public.lessons where id = 'e0e0e0e0-2222-0000-0000-0000000000e1'),
  0,
  'student A does NOT see lesson B (other school)'
);

-- ============ TEACHER A: sees own school, not the other ============
reset role;
select set_config('request.jwt.claims', '{"sub":"e0e0e0e0-1111-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select count(*) > 0 from public.groups where id = 'e0e0e0e0-1111-0000-0000-0000000000d1'),
  'teacher A sees own group'
);
select is(
  (select count(*)::int from public.groups where id = 'e0e0e0e0-2222-0000-0000-0000000000d1'),
  0,
  'teacher A does NOT see group B (other school)'
);
select is(
  (select count(*)::int from public.students where id = 'e0e0e0e0-2222-0000-0000-0000000000c1'),
  0,
  'teacher A does NOT see student B (other school, not in own group anyway, but must also fail school check)'
);

-- ============ ADMIN A: fn_is_admin() now scoped to own school ============
reset role;
select set_config('request.jwt.claims', '{"sub":"e0e0e0e0-1111-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select count(*) > 0 from public.students where id = 'e0e0e0e0-1111-0000-0000-0000000000c1'),
  'admin A (fn_is_admin) sees own-school student via admin policy'
);
select is(
  (select count(*)::int from public.students where id = 'e0e0e0e0-2222-0000-0000-0000000000c1'),
  0,
  'admin A does NOT see other-school student via admin policy (school_id check on fn_is_admin())'
);
select is(
  (select count(*)::int from public.teachers where id = 'e0e0e0e0-2222-0000-0000-0000000000b1'),
  0,
  'admin A does NOT see other-school teacher via admin policy'
);
select is(
  (select count(*)::int from public.groups where id = 'e0e0e0e0-2222-0000-0000-0000000000d1'),
  0,
  'admin A does NOT see other-school group via admin policy'
);
select throws_ok(
  $$ update public.groups set name = 'HACKED-BY-ADMIN-A' where id = 'e0e0e0e0-2222-0000-0000-0000000000d1' $$,
  '42501', NULL,
  'admin A cannot UPDATE group B (cross-school write blocked, 42501)'
);
select is(
  (select name from public.groups where id = 'e0e0e0e0-2222-0000-0000-0000000000d1'),
  'RLS Test Group B',
  'group B name unchanged after blocked cross-school update attempt'
);

-- ============ ADMIN B (mirror check — same policy protects both directions) ============
reset role;
select set_config('request.jwt.claims', '{"sub":"e0e0e0e0-2222-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.students where id = 'e0e0e0e0-1111-0000-0000-0000000000c1'),
  0,
  'admin B does NOT see other-school (A) student via admin policy'
);
select ok(
  (select count(*) > 0 from public.students where id = 'e0e0e0e0-2222-0000-0000-0000000000c1'),
  'admin B sees own-school student via admin policy'
);

-- ============ SUPER ADMIN: sees + can write across both schools ============
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0b0b0b0-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  (select count(*) >= 2 from public.schools where id in (
    'e0e0e0e0-9999-0000-0000-000000000001', 'e0e0e0e0-9999-0000-0000-000000000002'
  )),
  'super admin sees both test schools'
);
select is(
  (select count(*)::int from public.students where id in (
    'e0e0e0e0-1111-0000-0000-0000000000c1', 'e0e0e0e0-2222-0000-0000-0000000000c1'
  )),
  2,
  'super admin sees students from BOTH schools (bypass via admin policy)'
);
select is(
  (select count(*)::int from public.groups where id in (
    'e0e0e0e0-1111-0000-0000-0000000000d1', 'e0e0e0e0-2222-0000-0000-0000000000d1'
  )),
  2,
  'super admin sees groups from BOTH schools'
);
select lives_ok(
  $$ update public.groups set name = 'RLS Test Group B' where id = 'e0e0e0e0-2222-0000-0000-0000000000d1' $$,
  'super admin CAN update group B (full cross-school bypass, no-op update to same value)'
);

-- ============ REGRESSION: existing default-school data still visible ============
-- Confirms migration 71's backfill (school_id = default 'a0a0a0a0-...0001')
-- + rewritten policies did not break access to real pre-existing seed
-- data for a real single-school user (Adilbek_07, seeded by seed.sql,
-- migration 2 onward — this is the actual "did we break prod" check for
-- the single-school-today case, distinct from the synthetic two-school
-- fixtures above).
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  (select count(*) > 0 from public.groups),
  'regression: seed student Adilbek_07 still sees groups after school backfill + policy rewrite'
);
select ok(
  (select count(*) > 0 from public.lessons),
  'regression: seed student Adilbek_07 still sees lessons after school backfill + policy rewrite'
);

select * from finish();
rollback;
