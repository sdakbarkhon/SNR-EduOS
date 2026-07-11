import { cache } from "react";
import {
  getMyStudent as getMyStudentCore,
  getMyGroups as getMyGroupsCore,
  getMyTeacher as getMyTeacherCore,
} from "@snr/core";
import type { Db } from "@snr/core";

/**
 * Per-request dedup for queries called both in `(app)/layout.tsx` and again in
 * individual page.tsx files. Without this, `getMyStudent`/`getMyGroups` (each
 * doing its own `auth.getUser()` network round-trip) fired twice per navigation —
 * once for the layout's chrome (student name/avatar), once for the page's own data.
 * Requires `createClient()` to be cache()'d too (same client reference both calls).
 */
export const getMyStudent = cache((db: Db) => getMyStudentCore(db));
export const getMyGroups = cache((db: Db) => getMyGroupsCore(db));

/**
 * Промт «скорость», Задача 3: teacher/layout.tsx, TeacherHeaderInfo.tsx, and
 * teacher/dashboard|lessons page.tsx each called getMyTeacherCore
 * independently — 3 separate `teachers` round trips per teacher page load.
 * Same request-scoped dedup as the student side above.
 */
export const getMyTeacher = cache((db: Db) => getMyTeacherCore(db));
