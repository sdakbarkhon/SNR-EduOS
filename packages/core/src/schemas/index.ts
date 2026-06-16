import { z } from "zod";

/** Форма входа (username + пароль). */
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
  remember: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Сдача ДЗ: нужен текст ИЛИ файл. */
export const submissionInputSchema = z
  .object({
    homework_id: z.string().uuid(),
    student_id: z.string().uuid(),
    answer_text: z.string().trim().min(1).optional(),
    file_url: z.string().min(1).optional(), // путь в Storage, не полный URL
    status: z.enum(["submitted", "checking", "graded"]).optional(),
  })
  .refine((v) => Boolean(v.answer_text) || Boolean(v.file_url), {
    message: "Нужен текст ответа или прикреплённый файл",
  });
export type SubmissionInput = z.infer<typeof submissionInputSchema>;

/** Настройки уведомлений (ученик меняет свои). */
export const notificationSettingsInputSchema = z.object({
  student_id: z.string().uuid(),
  push_homework: z.boolean().optional(),
  push_schedule: z.boolean().optional(),
  push_grades: z.boolean().optional(),
  push_attendance: z.boolean().optional(),
});
export type NotificationSettingsInput = z.infer<
  typeof notificationSettingsInputSchema
>;
