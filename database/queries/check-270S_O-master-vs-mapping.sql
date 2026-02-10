-- Check if 270S_O exists in both item_master and item_mapping
-- This will help identify why the update is not working

-- 1. Check item_master
SELECT 
    'item_master' as source,
    item_number,
    fg_classification,
    category,
    model,
    product,
    is_active
FROM item_master
WHERE item_number = '270S_O'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'));

-- 2. Check item_mapping (all entities)
SELECT 
    'item_mapping' as source,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    product,
    is_active
FROM item_mapping
WHERE item_number = '270S_O'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'));

-- 3. Check current sales_data values
SELECT 
    entity,
    item_number,
    fg_classification as current_fg,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_O'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'))
GROUP BY entity, item_number, fg_classification
ORDER BY entity, fg_classification;

-- 4. Compare what should be vs what is
SELECT 
    sd.entity,
    sd.item_number,
    sd.fg_classification as sales_data_fg,
    im_master.fg_classification as item_master_fg,
    im_mapping.fg_classification as item_mapping_fg,
    CASE 
        WHEN im_master.item_number IS NOT NULL THEN 'item_master'
        WHEN im_mapping.item_number IS NOT NULL THEN 'item_mapping'
        ELSE 'NO_MAPPING'
    END as should_use,
    COALESCE(im_master.fg_classification, im_mapping.fg_classification) as should_be_fg,
    CASE 
        WHEN sd.fg_classification != COALESCE(im_master.fg_classification, im_mapping.fg_classification) 
        THEN 'MISMATCH'
        ELSE 'OK'
    END as status
FROM sales_data sd
LEFT JOIN item_master im_master 
    ON sd.item_number = im_master.item_number 
    AND im_master.is_active = true
LEFT JOIN item_mapping im_mapping 
    ON sd.item_number = im_mapping.item_number 
    AND sd.entity = im_mapping.entity
WHERE (sd.item_number = '270S_O'
   OR UPPER(TRIM(sd.item_number)) = UPPER(TRIM('270S_O')))
LIMIT 100;
