-- Log table for student recurring schedule emails.
-- Tracks each send attempt (success or failure) per student per term.
CREATE TABLE IF NOT EXISTS slake_student_schedule_email_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   text        NOT NULL,
  student_id  uuid        NOT NULL,
  student_name text       NOT NULL DEFAULT '',
  term_id     uuid        NOT NULL,
  term_name   text        NOT NULL DEFAULT '',
  emailed_to  text        NOT NULL DEFAULT '',
  status      text        NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed'
  error       text,
  sent_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_schedule_logs_center_term
  ON slake_student_schedule_email_logs (center_id, term_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_schedule_logs_student_term
  ON slake_student_schedule_email_logs (student_id, term_id);
