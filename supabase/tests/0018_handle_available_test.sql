-- ============================================================================
-- handle_available (live username check). Run: supabase test db
-- Uses seeded handles (@you, @arjun.blr).
-- ============================================================================
begin;
select plan(4);

select has_function('handle_available', array['text'], 'handle_available exists');
select ok(has_function_privilege('anon','handle_available(text)','EXECUTE'),
  'anon can call it');
select ok(not handle_available('you'), 'seeded @you is taken → false');
select ok(handle_available('totally.unclaimed.name'), 'unclaimed handle → true');

select * from finish();
rollback;
