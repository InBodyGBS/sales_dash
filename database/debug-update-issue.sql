-- Debug: Why is UPDATE not working?
-- This will help us find the exact issue

-- Step 1: Check exact item_number in sales_data (with hex values)
SELECT 
    'Exact item_number check' as info,
    item_number,
    LENGTH(item_number) as length,
    ASCII(SUBSTRING(item_number, 5, 1)) as char_at_pos_5, -- Should be 48 for '0' or 79 for 'O'
    fg_classification,
    entity,
    COUNT(*) as count
FROM sales_data
WHERE item_number LIKE '%270S%'
  AND entity = 'Japan'
GROUP BY item_number, fg_classification, entity
ORDER BY item_number;

-- Step 2: Check if UPDATE would match
SELECT 
    'Would UPDATE match?' as info,
    COUNT(*) as matching_records
FROM sales_data
WHERE (item_number = '270S_0' OR item_number = '270S_O')
  AND entity = 'Japan';

-- Step 3: Try UPDATE and see affected rows
BEGIN;

UPDATE sales_data
SET fg_classification = 'FG'
WHERE (item_number = '270S_0' OR item_number = '270S_O')
  AND entity = 'Japan';

-- Check how many rows were affected
SELECT 
    'Rows affected' as info,
    COUNT(*) as updated_count
FROM sales_data
WHERE (item_number = '270S_0' OR item_number = '270S_O')
  AND entity = 'Japan'
  AND fg_classification = 'FG';

-- If the count is 0, rollback and try different approach
-- If the count is > 0, commit
-- COMMIT;
-- ROLLBACK;
