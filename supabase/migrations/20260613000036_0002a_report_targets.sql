-- ============================================================================
-- Migration 0002a — extend report_target_t for per-content reporting (Safety #1)
-- Approved decision: reports can now target individual recaps/stories/comments/
-- messages, not just user/plan. ADD VALUE is isolated in its own migration so the
-- new labels are committed before submit_report (0014l) uses them.
-- ============================================================================
alter type report_target_t add value if not exists 'recap';
alter type report_target_t add value if not exists 'story';
alter type report_target_t add value if not exists 'comment';
alter type report_target_t add value if not exists 'message';
