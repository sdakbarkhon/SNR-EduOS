// Промт "Gemini migration", ЧАСТЬ 5.1 — строгие JSON-схемы (generationConfig.
// responseSchema) для фич с простой, стабильной формой ответа. Убирает
// markdown-обёртку и любой текст вне JSON без необходимости самим
// перепроверять/чистить ответ регуляркой — прямая экономия output-токенов.
// generate-stages НАМЕРЕННО не переведён на строгую схему (см. prompts.ts,
// buildLessonGenerationPrompt) — там полиморфная форма (slides варьируются
// по layout, quiz есть только у части этапов), безопасно описать её схемой
// сложнее, чем рискует сломать генерацию; там остаётся responseMimeType:
// "application/json" без schema (уже включено в generateJSON по умолчанию).
import { SchemaType, type ResponseSchema } from "@google/generative-ai";

export const HOMEWORK_FILE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
  },
  required: ["title", "description"],
};

export const HOMEWORK_TEST_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question: { type: SchemaType.STRING },
          options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          correctIndex: { type: SchemaType.INTEGER },
        },
        required: ["question", "options", "correctIndex"],
      },
    },
  },
  required: ["title", "description", "questions"],
};

export const HOMEWORK_PROGRAMMING_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    starterCode: { type: SchemaType.STRING },
    expectedOutput: { type: SchemaType.STRING },
    language: { type: SchemaType.STRING, enum: ["python", "javascript", "cpp", "java"], format: "enum" },
  },
  required: ["title", "description", "starterCode", "expectedOutput", "language"],
};

// Bundle остаётся без строгой схемы: "config" по смыслу разный для каждого
// type (test -> questions[], code -> starterCode/language/expectedOutput,
// file/внешний сервис -> {}) — Gemini's responseSchema не поддерживает
// объединения по значению соседнего поля (union discriminated by a sibling
// enum), описать это без потери валидных вариантов схемой нельзя.

export const CURRICULUM_TOPICS_SCHEMA: ResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      description: { type: SchemaType.STRING },
      estimated_lessons: { type: SchemaType.INTEGER },
    },
    required: ["title", "description", "estimated_lessons"],
  },
};

// Промт МОБ-7 (v8 "EduOS Assistant Insight", apps/web/app/api/mobile/insight/route.ts).
export const PARENT_INSIGHT_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    insights: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          body: { type: SchemaType.STRING },
          category: {
            type: SchemaType.STRING,
            enum: ["attendance", "grades", "homework", "progress", "recommendation"],
            format: "enum",
          },
          sentiment: {
            type: SchemaType.STRING,
            enum: ["positive", "neutral", "warning"],
            format: "enum",
          },
        },
        required: ["title", "body", "category", "sentiment"],
      },
    },
  },
  required: ["summary", "insights"],
};
