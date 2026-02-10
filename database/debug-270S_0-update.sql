-- Debug: Check why 270S_0 is not updating
-- Run this first to see the current state

-- 1. Check item_mapping for 270S_0
SELECT 
    'item_mapping' as source,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    product,
    is_active,
    created_at,
    updated_at
FROM item_mapping
WHERE item_number = '270S_O'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'))
   OR item_number LIKE '%270S%';

-- 2. Check item_master for 270S_0
SELECT 
    'item_master' as source,
    item_number,
    fg_classification,
    category,
    model,
    product,
    is_active,
    created_at,
    updated_at
FROM item_master
WHERE item_number = '270S_O'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'))
   OR item_number LIKE '%270S%';

-- 3. Check current sales_data values
SELECT 
    'sales_data (current)' as source,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_O'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'))
   OR item_number LIKE '%270S%'
GROUP BY entity, item_number, fg_classification, category, model
ORDER BY entity, item_number;

-- 4. Check if UPDATE would match any records
SELECT 
    'Would Update' as status,
    COUNT(*) as matching_records
FROM sales_data sd
INNER JOIN item_mapping imap 
    ON sd.item_number = imap.item_number 
    AND sd.entity = imap.entity
WHERE sd.item_number = '270S_O'
  AND sd.entity = 'Japan'
  AND imap.item_number = '270S_O'
  AND imap.entity = 'Japan'
  AND imap.is_active = true;

-- 5. Check exact string comparison
SELECT 
    'Exact Match Check' as check_type,
    sd.item_number as sales_data_item,
    imap.item_number as mapping_item,
    sd.item_number = imap.item_number as exact_match,
    LENGTH(sd.item_number) as sd_length,
    LENGTH(imap.item_number) as map_length,
    sd.entity as sales_data_entity,
    imap.entity as mapping_entity,
    sd.entity = imap.entity as entity_match
FROM sales_data sd
CROSS JOIN item_mapping imap
WHERE sd.item_number LIKE '%270S%'
  AND imap.item_number LIKE '%270S%'
  AND sd.entity = 'Japan'
LIMIT 10;
