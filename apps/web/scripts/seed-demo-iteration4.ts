import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "password123";

async function main() {
  console.log("=== Seeding demo data for Iteration 4 ===");

  // 1. STORAGE CLEANUP
  console.log("\n[1/8] Cleaning storage buckets...");
  const buckets = [
    "lesson-materials",
    "course-materials",
    "materials",
    "homework-files",
    "homework-submissions",
    "homework-tests",
    "avatars",
    "books",
    "project-files",
    "stage-attachments",
  ];

  for (const bucket of buckets) {
    try {
      const { data: files } = await supabase.storage
        .from(bucket)
        .list("", { limit: 1000 });
      if (files && files.length > 0) {
        const allFiles = await listAllFiles(bucket);
        if (allFiles.length > 0) {
          const { error } = await supabase.storage
            .from(bucket)
            .remove(allFiles);
          if (error) console.warn(`  Failed to clean ${bucket}:`, error.message);
          else console.log(`  Cleaned ${allFiles.length} files from ${bucket}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  Skipping ${bucket}:`, msg);
    }
  }

  // 2. CREATE TEACHER
  console.log("\n[2/8] Creating teacher Karim Alisher...");
  const { data: teacherAuth, error: teacherAuthErr } =
    await supabase.auth.admin.createUser({
      email: "teacher_demo@snr.local",
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: "teacher_demo" },
    });
  if (teacherAuthErr)
    throw new Error(`Teacher auth: ${teacherAuthErr.message}`);

  const teacherUserId = teacherAuth.user!.id;

  const { data: teacherRow, error: teacherErr } = await supabase
    .from("teachers")
    .insert({
      user_id: teacherUserId,
      username: "teacher_demo",
      full_name: "Карим Алишер Botirovich",
    })
    .select()
    .single();
  if (teacherErr) throw new Error(`Teacher row: ${teacherErr.message}`);

  const teacherId = teacherRow.id as string;
  console.log(`  Teacher created: id=${teacherId}`);

  // 3. CREATE GROUPS
  // groups.subject is NOT NULL (migration 2 legacy field); use 'mixed' since
  // actual subjects are created separately in the subjects table below.
  console.log("\n[3/8] Creating groups...");
  const groupsToCreate = [
    { name: "3-А класс", grade: 3, subject: "mixed" },
    { name: "7-А класс", grade: 7, subject: "mixed" },
    { name: "10-А класс", grade: 10, subject: "mixed" },
  ];

  const groups: Array<{ id: string; name: string; grade: number }> = [];
  for (const g of groupsToCreate) {
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: g.name, subject: g.subject, teacher_id: teacherId })
      .select()
      .single();
    if (error) throw new Error(`Group ${g.name}: ${error.message}`);
    groups.push({ id: data.id as string, name: g.name, grade: g.grade });
    console.log(`  Group created: ${g.name}`);
  }

  // 4. CREATE STUDENTS
  console.log("\n[4/8] Creating students...");
  const studentsToCreate = [
    {
      username: "Aziz_03",
      fullName: "Aziz Karimov",
      groupId: groups[0].id,
      groupName: "3-А",
    },
    {
      username: "Nodira_07",
      fullName: "Nodira Yusupova",
      groupId: groups[1].id,
      groupName: "7-А",
    },
    {
      username: "Sherzod_10",
      fullName: "Sherzod Tashkenbaev",
      groupId: groups[2].id,
      groupName: "10-А",
    },
  ];

  const students: Array<{
    userId: string;
    studentId: string;
    groupId: string;
    name: string;
  }> = [];
  for (const s of studentsToCreate) {
    const { data: studAuth, error: studAuthErr } =
      await supabase.auth.admin.createUser({
        email: `${s.username.toLowerCase()}@snr.local`,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { username: s.username },
      });
    if (studAuthErr)
      throw new Error(`Student auth ${s.username}: ${studAuthErr.message}`);

    const studentUserId = studAuth.user!.id;

    const { data: studentRow, error: studentErr } = await supabase
      .from("students")
      .insert({
        user_id: studentUserId,
        username: s.username,
        full_name: s.fullName,
      })
      .select()
      .single();
    if (studentErr)
      throw new Error(`Student row ${s.username}: ${studentErr.message}`);

    const { error: sgErr } = await supabase.from("student_groups").insert({
      student_id: studentRow.id,
      group_id: s.groupId,
    });
    if (sgErr)
      throw new Error(`Student-group ${s.username}: ${sgErr.message}`);

    students.push({
      userId: studentUserId,
      studentId: studentRow.id as string,
      groupId: s.groupId,
      name: s.fullName,
    });
    console.log(`  Student created: ${s.fullName} → ${s.groupName}`);
  }

  // 5. CREATE SUBJECTS (subjects table — migration 53)
  // Two subjects per group: Робототехника + Программирование
  console.log("\n[5/8] Creating subjects...");
  const subjectConfigs = [
    {
      name: "Робототехника",
      icon: "Cpu",
      color: "#06B6D4",
    },
    {
      name: "Программирование",
      icon: "Code",
      color: "#6366F1",
    },
  ];

  const subjects: Array<{ id: string; name: string; groupId: string }> = [];
  for (const g of groups) {
    for (const sc of subjectConfigs) {
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          name: sc.name,
          group_id: g.id,
          teacher_id: teacherId,
          icon: sc.icon,
          color: sc.color,
        })
        .select()
        .single();
      if (error)
        throw new Error(`Subject ${sc.name} in ${g.name}: ${error.message}`);
      subjects.push({ id: data.id as string, name: sc.name, groupId: g.id });
      console.log(`  Subject: ${sc.name} in ${g.name}`);
    }
  }

  // 6. CREATE HOMEWORK
  // subjects[i*2 + j] where i=group index, j=subject (0=Робото, 1=Програм)
  console.log("\n[6/8] Creating homework...");
  // 2026-06-30 22:00 Asia/Tashkent = UTC+5 → 2026-06-30T17:00:00.000Z
  const dueAt = "2026-06-30T17:00:00.000Z";

  const homeworkConfig = [
    // 3-А (grade 3, Scratch)
    {
      groupIdx: 0,
      subjectIdx: 0, // Робототехника
      title: "Создай в Scratch анимацию: кот ходит по экрану",
      description:
        "Используя блоки движения, заставь кота ходить от левого края до правого. Добавь смену костюма при движении.",
    },
    {
      groupIdx: 0,
      subjectIdx: 1, // Программирование
      title: "Сделай в Scratch программу: при нажатии пробел кот говорит привет",
      description:
        "Добавь событие 'при нажатии клавиши пробел'. Используй блок 'говорить' чтобы кот сказал 'Привет!'",
    },
    // 7-А (grade 7, Wokwi + Python)
    {
      groupIdx: 1,
      subjectIdx: 0, // Робототехника
      title: "Wokwi: подключи светодиод к Arduino и заставь его мигать каждую секунду",
      description:
        "Создай схему в Wokwi: Arduino UNO + светодиод + резистор. Напиши код который мигает светодиодом с интервалом 1 секунда.",
    },
    {
      groupIdx: 1,
      subjectIdx: 1, // Программирование
      title: "Python: напиши программу которая считает сумму чисел от 1 до N",
      description:
        "Программа принимает число N от пользователя и выводит сумму всех чисел от 1 до N включительно. Используй цикл for.",
    },
    // 10-А (grade 10, advanced)
    {
      groupIdx: 2,
      subjectIdx: 0, // Робототехника
      title: "Wokwi: сделай систему сигнализации с датчиком движения",
      description:
        "Используй PIR датчик движения в Wokwi. При обнаружении движения должен загораться красный светодиод и издаваться звук через пьезо.",
    },
    {
      groupIdx: 2,
      subjectIdx: 1, // Программирование
      title: "Python: реализуй сортировку пузырьком и измерь время выполнения",
      description:
        "Реализуй алгоритм bubble sort. Измерь время сортировки массива из 1000 случайных чисел используя модуль time.",
    },
  ];

  for (const hw of homeworkConfig) {
    const group = groups[hw.groupIdx];
    const subjectIdx = hw.groupIdx * 2 + hw.subjectIdx;
    const subject = subjects[subjectIdx];

    const hwInsert: Record<string, unknown> = {
      teacher_id: teacherId,
      group_id: group.id,
      title: hw.title,
      description: hw.description,
      due_at: dueAt,
      max_grade: 5,
    };
    // subject_id added if column exists (migration 53 adds it to lessons; homework
    // may or may not have it depending on which migrations ran). Try with it first.
    if (subject) hwInsert.subject_id = subject.id;

    const { error } = await supabase.from("homework").insert(hwInsert);
    if (error) {
      // Retry without subject_id in case the column doesn't exist on homework
      if (error.message.includes("subject_id")) {
        delete hwInsert.subject_id;
        const { error: err2 } = await supabase.from("homework").insert(hwInsert);
        if (err2) throw new Error(`Homework "${hw.title}": ${err2.message}`);
      } else {
        throw new Error(`Homework "${hw.title}": ${error.message}`);
      }
    }
    console.log(`  Homework: ${hw.title.slice(0, 50)}...`);
  }

  // 7. CREATE BOOK CARDS (без реальных файлов)
  // books table schema (migration 21): id, title, author, subject, book_type,
  // description, cover_storage_path, file_storage_path (NOT NULL), uploaded_by
  // NOTE: books are school-wide (no group_id); we just set the subject text field.
  console.log("\n[7/8] Creating book cards...");
  const booksConfig = [
    // 3-А
    {
      subject: "Программирование",
      title: "Scratch для детей: программирование без слёз",
      author: "Маджед Маржи",
      description:
        "Книга-самоучитель для младших школьников. Объясняет основы программирования через визуальное программирование в Scratch.",
    },
    {
      subject: "Программирование",
      title: "Программирование в Scratch для начинающих",
      author: "Голиков Денис",
      description:
        "Пошаговое руководство для детей 8-12 лет. Изучение программирования через создание игр и анимаций.",
    },
    // 7-А
    {
      subject: "Программирование",
      title: "Python для детей: самоучитель программирования",
      author: "Джейсон Бриггс",
      description:
        "Учебник Python для школьников 12-15 лет. От переменных до классов через интересные задачи.",
    },
    {
      subject: "Робототехника",
      title: "Простая электроника для начинающих",
      author: "Чарльз Платт",
      description:
        "Основы электроники и Arduino для школьников. Практические схемы и проекты.",
    },
    // 10-А
    {
      subject: "Программирование",
      title: "Изучаем Python",
      author: "Марк Лутц",
      description:
        "Полное руководство по Python для старшеклассников. От основ до объектно-ориентированного программирования.",
    },
    {
      subject: "Программирование",
      title: "Грокаем алгоритмы",
      author: "Адитья Бхаргава",
      description:
        "Иллюстрированное пособие по алгоритмам. Сортировка, поиск, рекурсия, графы — простым языком.",
    },
  ];

  for (const b of booksConfig) {
    const { error } = await supabase.from("books").insert({
      uploaded_by: teacherId,
      title: b.title,
      author: b.author,
      subject: b.subject,
      description: b.description,
      book_type: "Учебник",
      // file_storage_path is NOT NULL — use placeholder until teacher uploads real PDF
      file_storage_path: "placeholder/not-uploaded-yet",
      cover_storage_path: null,
    });
    if (error) {
      console.warn(`  Book "${b.title}": ${error.message}`);
    } else {
      console.log(`  Book card: ${b.title}`);
    }
  }

  // 8. VERIFICATION
  console.log("\n[8/8] Verification...");
  const { count: tc } = await supabase
    .from("teachers")
    .select("*", { count: "exact", head: true });
  const { count: sc } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true });
  const { count: gc } = await supabase
    .from("groups")
    .select("*", { count: "exact", head: true });
  const { count: subc } = await supabase
    .from("subjects")
    .select("*", { count: "exact", head: true });
  const { count: hc } = await supabase
    .from("homework")
    .select("*", { count: "exact", head: true });
  const { count: bc } = await supabase
    .from("books")
    .select("*", { count: "exact", head: true });

  console.log("\n=== SEED COMPLETE ===");
  console.log(`Teachers:  ${tc}`);
  console.log(`Students:  ${sc}`);
  console.log(`Groups:    ${gc}`);
  console.log(`Subjects:  ${subc}`);
  console.log(`Homework:  ${hc}`);
  console.log(`Books:     ${bc}`);
  console.log("\nLogin credentials:");
  console.log(`  Teacher:  teacher_demo / ${PASSWORD}`);
  console.log(`  Students: Aziz_03, Nodira_07, Sherzod_10 / ${PASSWORD}`);
}

async function listAllFiles(bucket: string, path = ""): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path, { limit: 1000 });
  if (error || !data) return [];

  const results: string[] = [];
  for (const item of data) {
    if (item.id === null) {
      const subfiles = await listAllFiles(
        bucket,
        path ? `${path}/${item.name}` : item.name
      );
      results.push(...subfiles);
    } else {
      results.push(path ? `${path}/${item.name}` : item.name);
    }
  }
  return results;
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
