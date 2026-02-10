-- Force update 270S_0 using multiple matching strategies
-- Run check-sales-data-270S_0-exact.sql first to see the exact values

-- Strategy 1: Direct update with exact match
UPDATE sales_data
SET fg_classification = 'FG'
WHERE item_number = '270S_0'
  AND entity = 'Japan';

-- Strategy 2: Update with TRIM (in case of whitespace)
UPDATE sales_data
SET fg_classification = 'FG'
WHERE TRIM(item_number) = '270S_0'
  AND entity = 'Japan';

-- Strategy 3: Update using item_mapping JOIN (most reliable)
UPDATE sales_data sd
SET 
    fg_classification = imap.fg_classification,
    category = imap.category,
    model = imap.model,
    product = imap.product
FROM item_mapping imap
WHERE (
    sd.item_number = imap.item_number OR
    TRIM(sd.item_number) = TRIM(imap.item_number)
  )
  AND sd.entity = imap.entity
  AND imap.item_number = '270S_0'
  AND imap.entity = 'Japan'
  AND imap.is_active = true;

-- Strategy 4: Update using LIKE pattern (if exact match fails)
UPDATE sales_data sd
SET 
    fg_classification = imap.fg_classification,
    category = imap.category,
    model = imap.model,
    product = imap.product
FROM item_mapping imap
WHERE sd.item_number LIKE '%270S_0%'
  AND imap.item_number = '270S_0'
  AND sd.entity = 'Japan'
  AND imap.entity = 'Japan'
  AND imap.is_active = true;

-- Verify the update
SELECT 
    'AFTER FORCE UPDATE' as status,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number LIKE '%270S%'
  AND entity = 'Japan'
GROUP BY entity, item_number, fg_classification, category, model
ORDER BY item_number;
