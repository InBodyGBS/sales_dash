-- Direct fix for 270S_0 - Most explicit approach
-- Run debug-270S_0-update.sql first to see the issue

-- Step 1: Check what we're working with
SELECT 
    'BEFORE UPDATE' as status,
    sd.id,
    sd.entity,
    sd.item_number,
    sd.fg_classification as current_fg,
    imap.fg_classification as should_be_fg,
    imap.is_active as mapping_active
FROM sales_data sd
LEFT JOIN item_mapping imap 
    ON TRIM(sd.item_number) = TRIM(imap.item_number)
    AND sd.entity = imap.entity
WHERE TRIM(sd.item_number) = '270S_0'
  AND sd.entity = 'Japan'
LIMIT 10;

-- Step 1.5: IMPORTANT - Activate item_mapping records first!
-- If is_active = false, the UPDATE won't work
UPDATE item_mapping
SET is_active = true, updated_at = NOW()
WHERE entity = 'Japan'
  AND is_active = false;

-- Step 2: Update using direct JOIN with TRIM
-- First, let's see what we're matching
SELECT 
    'BEFORE UPDATE - Matching records' as status,
    sd.id,
    sd.item_number as sales_item,
    imap.item_number as mapping_item,
    sd.fg_classification as current_fg,
    imap.fg_classification as new_fg,
    sd.entity,
    imap.is_active
FROM sales_data sd
INNER JOIN item_mapping imap ON (
    TRIM(sd.item_number) = TRIM(imap.item_number) OR
    sd.item_number = imap.item_number
  )
WHERE sd.entity = 'Japan'
  AND imap.entity = 'Japan'
  AND imap.item_number = '270S_0'
  AND imap.is_active = true
LIMIT 10;

-- Now update
UPDATE sales_data sd
SET 
    fg_classification = imap.fg_classification,
    category = imap.category,
    model = imap.model,
    product = imap.product
FROM item_mapping imap
WHERE (
    TRIM(sd.item_number) = TRIM(imap.item_number) OR
    sd.item_number = imap.item_number
  )
  AND sd.entity = imap.entity
  AND imap.item_number = '270S_0'
  AND imap.entity = 'Japan'
  AND imap.is_active = true;

-- Step 3: Verify the update
SELECT 
    'AFTER UPDATE' as status,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as record_count
FROM sales_data
WHERE TRIM(item_number) = '270S_0'
  AND entity = 'Japan'
GROUP BY entity, item_number, fg_classification, category, model
ORDER BY entity;

-- Step 4: If still not working, try with exact item_number from item_mapping
-- First, get the exact item_number from item_mapping
SELECT 
    'Exact item_number from item_mapping:' as info,
    item_number,
    LENGTH(item_number) as length,
    fg_classification
FROM item_mapping
WHERE entity = 'Japan'
  AND (item_number LIKE '%270S%' OR item_number LIKE '%270s%')
  AND is_active = true;

-- Then use that exact value in the UPDATE
-- (Replace 'EXACT_VALUE_HERE' with the actual value from above query)
-- UPDATE sales_data
-- SET fg_classification = 'FG'
-- WHERE item_number = 'EXACT_VALUE_HERE'
--   AND entity = 'Japan';
