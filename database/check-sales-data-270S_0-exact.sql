-- Check exact item_number values in sales_data for 270S_0
-- This will show us if there are any whitespace or case issues

-- 1. Check all variations of 270S_0 in sales_data
SELECT 
    'sales_data exact values' as source,
    entity,
    item_number,
    LENGTH(item_number) as item_length,
    ASCII(SUBSTRING(item_number, 5, 1)) as char_at_pos_5, -- Check if it's '0' (48) or 'O' (79)
    fg_classification,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number LIKE '%270S%'
  AND entity = 'Japan'
GROUP BY entity, item_number, fg_classification
ORDER BY item_number;

-- 2. Check if there's a match between sales_data and item_mapping
SELECT 
    'Match Check' as check_type,
    sd.item_number as sales_data_item,
    imap.item_number as mapping_item,
    sd.item_number = imap.item_number as exact_match,
    TRIM(sd.item_number) = TRIM(imap.item_number) as trim_match,
    LENGTH(sd.item_number) as sd_length,
    LENGTH(imap.item_number) as map_length,
    sd.fg_classification as current_fg,
    imap.fg_classification as should_be_fg,
    sd.entity as sales_entity,
    imap.entity as mapping_entity
FROM sales_data sd
CROSS JOIN item_mapping imap
WHERE sd.item_number LIKE '%270S%'
  AND imap.item_number LIKE '%270S%'
  AND sd.entity = 'Japan'
  AND imap.entity = 'Japan'
LIMIT 20;

-- 3. Try to find the exact item_number in sales_data
SELECT DISTINCT
    'Unique item_numbers in sales_data' as info,
    item_number,
    LENGTH(item_number) as length,
    entity,
    COUNT(*) as count
FROM sales_data
WHERE item_number LIKE '%270S%'
  AND entity = 'Japan'
GROUP BY item_number, entity
ORDER BY item_number;
