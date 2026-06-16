-- RLS: ученик видит ТОЛЬКО свои данные (tz.md §5). Все политики — для роли
-- authenticated; anon не получает ничего. Запись для ученика разрешена лишь в
-- homework_submissions, messages (свои), notification_settings (свои).

alter table public.teachers              enable row level security;
alter table public.students              enable row level security;
alter table public.groups                enable row level security;
alter table public.student_groups        enable row level security;
alter table public.lessons               enable row level security;
alter table public.attendance            enable row level security;
alter table public.homework              enable row level security;
alter table public.homework_submissions  enable row level security;
alter table public.grades                enable row level security;
alter table public.course_materials      enable row level security;
alter table public.messages              enable row level security;
alter table public.announcements         enable row level security;
alter table public.notification_settings enable row level security;
alter table public.payments              enable row level security;
alter table public.charges               enable row level security;

-- STUDENTS: только своя запись (личные данные read-only — правка через админа).
create policy "student reads own profile"
  on public.students for select to authenticated
  using (user_id = auth.uid());

-- TEACHERS: справочник имён преподавателей виден авторизованным
-- (это не приватные данные учеников). Запись — только сервис-роль/админка.
create policy "auth reads teachers"
  on public.teachers for select to authenticated
  using (true);

-- GROUPS / STUDENT_GROUPS: только свои группы.
create policy "student reads own groups"
  on public.groups for select to authenticated
  using (public.is_my_group(id));

create policy "student reads own memberships"
  on public.student_groups for select to authenticated
  using (student_id = public.current_student_id());

-- LESSONS: уроки своих групп.
create policy "student reads own lessons"
  on public.lessons for select to authenticated
  using (public.is_my_group(group_id));

-- ATTENDANCE: своя посещаемость (read-only).
create policy "student reads own attendance"
  on public.attendance for select to authenticated
  using (student_id = public.current_student_id());

-- HOMEWORK: ДЗ своих групп.
create policy "student reads own homework"
  on public.homework for select to authenticated
  using (public.is_my_group(group_id));

-- HOMEWORK_SUBMISSIONS: свои сдачи (read + создание + обновление своей сдачи).
create policy "student reads own submissions"
  on public.homework_submissions for select to authenticated
  using (student_id = public.current_student_id());

create policy "student creates own submission"
  on public.homework_submissions for insert to authenticated
  with check (
    student_id = public.current_student_id()
    and exists (
      select 1 from public.homework h
      where h.id = homework_id and public.is_my_group(h.group_id)
    )
  );

create policy "student updates own submission"
  on public.homework_submissions for update to authenticated
  using (student_id = public.current_student_id())
  with check (student_id = public.current_student_id());

-- GRADES: свои оценки (read-only).
create policy "student reads own grades"
  on public.grades for select to authenticated
  using (student_id = public.current_student_id());

-- COURSE_MATERIALS: материалы своих групп.
create policy "student reads own materials"
  on public.course_materials for select to authenticated
  using (public.is_my_group(group_id));

-- MESSAGES: адресованные лично, своей группе, либо отправленные самим учеником.
create policy "student reads own messages"
  on public.messages for select to authenticated
  using (
    recipient_student_id = public.current_student_id()
    or (group_id is not null and public.is_my_group(group_id))
    or sender_id = auth.uid()
  );

create policy "student sends message"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid());

create policy "student marks own message read"
  on public.messages for update to authenticated
  using (recipient_student_id = public.current_student_id())
  with check (recipient_student_id = public.current_student_id());

-- ANNOUNCEMENTS: общешкольные или для своей группы (read-only).
create policy "student reads announcements"
  on public.announcements for select to authenticated
  using (target_group_id is null or public.is_my_group(target_group_id));

-- NOTIFICATION_SETTINGS: только свои (read/insert/update).
create policy "student reads own notif settings"
  on public.notification_settings for select to authenticated
  using (student_id = public.current_student_id());

create policy "student inserts own notif settings"
  on public.notification_settings for insert to authenticated
  with check (student_id = public.current_student_id());

create policy "student updates own notif settings"
  on public.notification_settings for update to authenticated
  using (student_id = public.current_student_id())
  with check (student_id = public.current_student_id());

-- PAYMENTS / CHARGES: свои, read-only.
create policy "student reads own payments"
  on public.payments for select to authenticated
  using (student_id = public.current_student_id());

create policy "student reads own charges"
  on public.charges for select to authenticated
  using (student_id = public.current_student_id());
