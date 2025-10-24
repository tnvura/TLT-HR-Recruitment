-- Create notification_config table (stores webhook URLs - service role only)
CREATE TABLE IF NOT EXISTS notification_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT UNIQUE NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create email_notifications table (logs all notification attempts)
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  webhook_payload JSONB,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  webhook_response JSONB,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE email_notifications
ADD CONSTRAINT fk_candidate
FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_notifications_candidate ON email_notifications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_event_type ON email_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created_at ON email_notifications(created_at);

-- RLS Policies

-- notification_config: Only service role can read/write
ALTER TABLE notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for notification_config"
  ON notification_config
  FOR ALL
  USING (false);  -- No client access at all

-- email_notifications: HR can read, service role can write
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can read email_notifications"
  ON email_notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('hr_admin', 'hr_staff', 'hr_manager')
      AND user_roles.is_active = true
    )
  );

-- Service role will insert directly, so no client INSERT policy needed

COMMENT ON TABLE notification_config IS 'Webhook configuration for email notifications - service role access only';
COMMENT ON TABLE email_notifications IS 'Audit log for all email notification attempts';
