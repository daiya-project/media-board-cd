-- =============================================================================
-- Migration: Seed media.contact_rule with tier-based contact frequency rules
-- Date: 2026-03-22
-- Depends on: 2026032201-table-contact-rule
-- =============================================================================

INSERT INTO media.contact_rule (tier, rule_day, required_stages, is_active) VALUES
  ('상',   90,  '{meeting}',                          true),   -- High-tier: meeting within 90 days
  ('중',  120,  '{contact,meeting}',                  true),   -- Mid-tier: contact or meeting within 120 days
  ('하',  180,  '{contact,meeting,propose,done}',     true),   -- Low-tier: any stage within 180 days
  ('기타',  0,  '{}',                                 false);  -- Other: no tracking
