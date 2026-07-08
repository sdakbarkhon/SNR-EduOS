// Shared label/filename lookup for CodeLanguage so lesson-stage and homework
// programming UIs don't each hardcode their own python/cpp-only ternary
// (УЧ.10 Part 6 — extended python/cpp to python/javascript/cpp/java).

import type { CodeLanguage } from "@snr/core";

export const CODE_LANGUAGES: CodeLanguage[] = ["python", "javascript", "cpp", "java", "html"];

export const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  python: "Python",
  javascript: "JavaScript",
  cpp: "C++",
  java: "Java",
  html: "HTML/CSS",
};

export const CODE_LANGUAGE_FILENAMES: Record<CodeLanguage, string> = {
  python: "main.py",
  javascript: "main.js",
  cpp: "main.cpp",
  java: "Main.java",
  html: "index.html",
};

export const CODE_LANGUAGE_DEFAULT_SNIPPETS: Record<CodeLanguage, string> = {
  python: "def solve():\n    # Твой код здесь\n    pass\n\nsolve()",
  javascript: "function solve() {\n  // Твой код здесь\n}\n\nsolve();",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Твой код здесь\n    return 0;\n}",
  java: "public class Main {\n    public static void main(String[] args) {\n        // Твой код здесь\n    }\n}",
  html: "<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    /* Твои стили здесь */\n  </style>\n</head>\n<body>\n  <h1>Привет, мир!</h1>\n</body>\n</html>",
};

/** 'html' never reaches Piston — it renders as a live iframe preview instead. */
export function isHtmlLanguage(language: CodeLanguage): boolean {
  return language === "html";
}
