-- Check Japan sales_data item_master mapping issues
-- Find items where fg_classification doesn't match

-- 1. Check item_master data for specific item_numbers in Japan sales_data
SELECT DISTINCT
    sd.item_number,
    sd.fg_classification as sales_data_fg,
    im.fg_classification as item_master_fg,
    sd.entity,
    COUNT(*) as record_count
FROM sales_data sd
LEFT JOIN item_master im ON sd.item_number = im.item_number AND im.is_active = true
WHERE sd.entity = 'Japan'
    AND sd.item_number IS NOT NULL
    AND (
        (im.fg_classification IS NOT NULL AND sd.fg_classification != im.fg_classification)
        OR (im.fg_classification IS NOT NULL AND sd.fg_classification IS NULL)
    )
GROUP BY sd.item_number, sd.fg_classification, im.fg_classification, sd.entity
ORDER BY record_count DESC
LIMIT 100;

-- 2. Check item_master entries that should be "FG" but sales_data shows "NonFG"
SELECT 
    im.item_number,
    im.fg_classification as item_master_fg,
    sd.fg_classification as sales_data_fg,
    COUNT(*) as mismatch_count
FROM item_master im
INNER JOIN sales_data sd ON im.item_number = sd.item_number
WHERE im.is_active = true
    AND sd.entity = 'Japan'
    AND im.fg_classification = 'FG'
    AND sd.fg_classification = 'NonFG'
GROUP BY im.item_number, im.fg_classification, sd.fg_classification
ORDER BY mismatch_count DESC
LIMIT 50;

-- 3. Check all item_master entries for Japan item_numbers
SELECT 
    im.item_number,
    im.fg_classification,
    im.category,
    im.model,
    im.product,
    im.is_active,
    COUNT(DISTINCT sd.entity) as used_in_entities,
    COUNT(*) as sales_data_count
FROM item_master im
INNER JOIN sales_data sd ON im.item_number = sd.item_number
WHERE im.is_active = true
    AND sd.entity = 'Japan'
GROUP BY im.item_number, im.fg_classification, im.category, im.model, im.product, im.is_active
ORDER BY sales_data_count DESC
LIMIT 100;
