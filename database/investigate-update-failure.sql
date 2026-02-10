-- Investigate why UPDATE is not working
-- This will help us find the root cause

-- Step 1: Check if UPDATE actually runs and affects rows
-- Run this UPDATE and check the return value
UPDATE sales_data
SET fg_classification = 'FG'
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan';

-- Check how many rows were actually updated (PostgreSQL returns this)
-- In Supabase, you can see this in the query result or run:
SELECT 
    'Check after UPDATE' as info,
    item_number,
    fg_classification,
    COUNT(*) as count
FROM sales_data
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan'
GROUP BY item_number, fg_classification;

-- Step 2: Check if there are any triggers or constraints
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'sales_data'
  AND (trigger_name LIKE '%fg%' OR trigger_name LIKE '%classification%');

-- Step 3: Check if there are any CHECK constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'sales_data'
  AND tc.constraint_type = 'CHECK';

-- Step 4: Try updating with explicit transaction
BEGIN;

UPDATE sales_data
SET fg_classification = 'FG'
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan';

-- Check immediately after UPDATE
SELECT 
    'In transaction' as info,
    item_number,
    fg_classification,
    COUNT(*) as count
FROM sales_data
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan'
GROUP BY item_number, fg_classification;

-- If it shows 'FG', then COMMIT, otherwise ROLLBACK
-- COMMIT;
-- ROLLBACK;

-- Step 5: Try updating a single record by ID
SELECT 
    'Single record to update' as info,
    id,
    item_number,
    fg_classification,
    entity
FROM sales_data
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan'
LIMIT 1;

-- Then update that specific ID (replace 'YOUR_ID_HERE' with actual ID)
-- UPDATE sales_data
-- SET fg_classification = 'FG'
-- WHERE id = 'YOUR_ID_HERE';
