-- Check if there are triggers that might be reverting the fg_classification value
-- This will help identify if a trigger is the cause

-- 1. Check all triggers on sales_data
SELECT 
    'All Triggers' as check_type,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    LEFT(action_statement, 200) as action_statement_preview
FROM information_schema.triggers
WHERE event_object_table = 'sales_data'
ORDER BY trigger_name;

-- 2. Check trigger functions that might affect fg_classification
-- Note: This query might be slow, so we'll check triggers first
SELECT 
    'Trigger Functions' as check_type,
    p.proname as function_name,
    SUBSTRING(pg_get_functiondef(p.oid)::text, 1, 500) as function_definition_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND EXISTS (
    SELECT 1 
    FROM pg_trigger t
    JOIN pg_proc tf ON t.tgfoid = tf.oid
    WHERE tf.oid = p.oid
      AND t.tgrelid = 'sales_data'::regclass
  )
  AND pg_get_functiondef(p.oid)::text LIKE '%fg_classification%'
ORDER BY p.proname
LIMIT 10;

-- 3. Check if there's a trigger that sets fg_classification to NonFG
SELECT 
    'NonFG Trigger Check' as check_type,
    trigger_name,
    event_manipulation,
    LEFT(action_statement, 500) as action_statement_preview
FROM information_schema.triggers
WHERE event_object_table = 'sales_data'
  AND (
    action_statement LIKE '%NonFG%' 
    OR action_statement LIKE '%fg_classification%'
  );
