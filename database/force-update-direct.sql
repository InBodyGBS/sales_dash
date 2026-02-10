-- Force update using ID-based approach
-- This will update regardless of item_number matching issues

-- Step 1: Get the IDs of records to update
SELECT 
    'Records to update' as info,
    id,
    item_number,
    fg_classification as current_fg,
    entity
FROM sales_data
WHERE item_number LIKE '%270S%'
  AND entity = 'Japan'
LIMIT 10;

-- Step 2: Update using ID (replace with actual IDs from Step 1)
-- First, let's get all IDs
WITH ids_to_update AS (
    SELECT id
    FROM sales_data
    WHERE item_number LIKE '%270S%'
      AND entity = 'Japan'
)
UPDATE sales_data
SET fg_classification = 'FG'
WHERE id IN (SELECT id FROM ids_to_update);

-- Step 3: Alternative - Update using pattern matching
UPDATE sales_data
SET fg_classification = 'FG'
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan';

-- Step 4: Verify
SELECT 
    'After update' as info,
    item_number,
    fg_classification,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number LIKE '%270S%'
  AND entity = 'Japan'
GROUP BY item_number, fg_classification
ORDER BY item_number;
