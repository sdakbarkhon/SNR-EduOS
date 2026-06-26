-- daily_facts: one cached AI fact per calendar day (DB-level cache, bypasses Gemini on repeat visits)
CREATE TABLE IF NOT EXISTS public.daily_facts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_date  date        NOT NULL UNIQUE,
  fact_text  text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_facts_date_desc ON public.daily_facts (fact_date DESC);

ALTER TABLE public.daily_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read daily facts"
  ON public.daily_facts FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.daily_facts TO authenticated, anon;
