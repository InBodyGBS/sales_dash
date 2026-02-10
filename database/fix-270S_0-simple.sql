-- Simple fix for 270S_0 - Check and update in one go
-- This handles both '270S_0' (zero) and '270S_O' (letter O)

-- Step 1: Check what exists in sales_data
SELECT DISTINCT
    'Current values' as info,
    item_number,
    fg_classification,
    COUNT(*) as record_count
FROM sales_data
WHERE (item_number LIKE '%270S%' OR item_number LIKE '%270s%')
  AND entity = 'Japan'
GROUP BY item_number, fg_classification
ORDER BY item_number;

-- Step 2: Check what should be from item_mapping
SELECT 
    'Should be' as info,
    item_number,
    fg_classification,
    category,
    model
FROM item_mapping
WHERE (item_number LIKE '%270S%' OR item_number LIKE '%270s%')
  AND entity = 'Japan'
  AND is_active = true;

-- Step 3: Update all variations (both 0 and O)
-- First, check how many records will be updated
SELECT 
    'Records to update' as info,
    COUNT(*) as count
FROM sales_data
WHERE (item_number = '270S_0' OR item_number = '270S_O' OR item_number LIKE '270S_%')
  AND entity = 'Japan';

-- Now update using CTE (most reliable method)
WITH ids_to_update AS (
    SELECT id
    FROM sales_data
    WHERE item_number LIKE '270S_%'
      AND entity = 'Japan'
)
UPDATE sales_data
SET fg_classification = 'FG'
FROM ids_to_update
WHERE sales_data.id = ids_to_update.id;

-- Check how many were actually updated
SELECT 
    'Update result' as info,
    item_number,
    fg_classification,
    COUNT(*) as updated_count
FROM sales_data
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan'
GROUP BY item_number, fg_classification;

-- Step 4: Verify
SELECT 
    'After update' as info,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as record_count
FROM sales_data
WHERE (item_number = '270S_0' OR item_number = '270S_O')
  AND entity = 'Japan'
GROUP BY item_number, fg_classification, category, model
ORDER BY item_number;
