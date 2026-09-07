-- A random claim token links the conditional counter update to the redemption
-- insert inside one D1 batch. If the conditional update loses a race, the
-- following insert receives NULL and its NOT NULL constraint rolls back all
-- statements in the batch.
ALTER TABLE invite_codes ADD COLUMN last_claim_token TEXT;

CREATE INDEX IF NOT EXISTS idx_user_invites_code
ON user_invites(invite_code);
