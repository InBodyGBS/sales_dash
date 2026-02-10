-- Final fix for 270S_0 - Force update with explicit matching
-- This will update sales_data regardless of is_active status

-- Step 1: Verify item_mapping has the correct value
SELECT 
    'item_mapping check' as step,
    item_number,
    fg_classification,
    category,
    model,
    is_active
FROM item_mapping
WHERE item_number = '270S_O'
  AND entity = 'Japan';

-- Step 2: Verify current sales_data values
SELECT 
    'sales_data BEFORE' as step,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as count
FROM sales_data
WHERE item_number = '270S_O'
  AND entity = 'Japan'
GROUP BY item_number, fg_classification, category, model;

-- Step 3: Force update using direct value from item_mapping
-- This uses a subquery to get the value directly
UPDATE sales_data
SET 
    fg_classification = (
        SELECT fg_classification 
        FROM item_mapping 
        WHERE item_number = '270S_O' 
          AND entity = 'Japan'
        LIMIT 1
    ),
    category = (
        SELECT category 
        FROM item_mapping 
        WHERE item_number = '270S_O' 
          AND entity = 'Japan'
        LIMIT 1
    ),
    model = (
        SELECT model 
        FROM item_mapping 
        WHERE item_number = '270S_O' 
          AND entity = 'Japan'
        LIMIT 1
    ),
    product = (
        SELECT product 
        FROM item_mapping 
        WHERE item_number = '270S_O' 
          AND entity = 'Japan'
        LIMIT 1
    )
WHERE item_number = '270S_O'
  AND entity = 'Japan';

-- Step 4: Alternative - Direct value update (if subquery doesn't work)
-- First check what value should be:
SELECT 
    'Value to use' as info,
    fg_classification as should_be_fg
FROM item_mapping
WHERE item_number = '270S_O'
  AND entity = 'Japan'
LIMIT 1;

-- If the above shows 'FG', then run this:
-- IMPORTANT: Check if item_number is '270S_0' (zero) or '270S_O' (letter O)
-- Run this query first to see which one exists:
SELECT DISTINCT
    'Check item_number' as info,
    item_number,
    LENGTH(item_number) as length,
    COUNT(*) as count
FROM sales_data
WHERE (item_number LIKE '%270S%')
  AND entity = 'Japan'
GROUP BY item_number
ORDER BY item_number;

-- Then update with the correct value (replace '270S_0' with the actual value from above):
UPDATE sales_data
SET fg_classification = 'FG'
WHERE item_number = '270S_0'  -- Change this to '270S_O' if that's what exists
  AND entity = 'Japan';

-- Check how many rows were updated:
SELECT 
    'UPDATE RESULT' as info,
    COUNT(*) as updated_rows
FROM sales_data
WHERE item_number = '270S_0'  -- Change this to '270S_O' if that's what exists
  AND entity = 'Japan'
  AND fg_classification = 'FG';

-- Step 5: Verify the update (check both variations)
SELECT 
    'sales_data AFTER' as step,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as count
FROM sales_data
WHERE (item_number = '270S_0' OR item_number = '270S_O')
  AND entity = 'Japan'
GROUP BY item_number, fg_classification, category, model
ORDER BY item_number;
