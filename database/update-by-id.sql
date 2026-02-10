-- Update by ID - Most reliable method
-- This bypasses any potential matching issues

-- Step 1: Get IDs of all records to update
SELECT 
    id,
    item_number,
    fg_classification as current_fg,
    entity
FROM sales_data
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan'
LIMIT 10;

-- Step 2: Update using CTE (Common Table Expression)
-- This is the most reliable way
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

-- Step 3: Verify the update
SELECT 
    'After ID-based update' as info,
    item_number,
    fg_classification,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan'
GROUP BY item_number, fg_classification
ORDER BY item_number;

-- Step 4: If still not working, try updating one by one
-- Get the first ID
SELECT id
FROM sales_data
WHERE item_number LIKE '270S_%'
  AND entity = 'Japan'
LIMIT 1;

-- Then update that specific ID (replace with actual ID from above)
UPDATE sales_data
SET fg_classification = 'FG'
WHERE id = 'YOUR_ID_HERE';
