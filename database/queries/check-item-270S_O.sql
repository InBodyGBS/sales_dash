-- Check why item_number "270S_O" is not being updated
-- This query helps debug the mapping issue

-- 1. Check if item exists in item_master
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
   OR item_number LIKE '%270S_O%'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'));

-- 2. Check if item exists in item_mapping (all entities)
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
   OR item_number LIKE '%270S_O%'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'));

-- 3. Check current sales_data values for this item
SELECT 
    entity,
    item_number,
    fg_classification as current_fg,
    category as current_category,
    model as current_model,
    product as current_product,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_O'
   OR item_number LIKE '%270S_O%'
   OR UPPER(TRIM(item_number)) = UPPER(TRIM('270S_O'))
GROUP BY entity, item_number, fg_classification, category, model, product
ORDER BY entity, item_number;

-- 4. Check if there's a mismatch
SELECT 
    sd.entity,
    sd.item_number,
    sd.fg_classification as sales_data_fg,
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
   OR sd.item_number LIKE '%270S_O%'
   OR UPPER(TRIM(sd.item_number)) = UPPER(TRIM('270S_O')))
LIMIT 100;
