-- Update only 270S_0 item in sales_data for Japan entity
-- Quick fix for testing

-- Before update - check current values
SELECT 
    'Before Update' as status,
    entity,
    item_number,
    fg_classification,
    category,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_0'
  AND entity = 'Japan'
GROUP BY entity, item_number, fg_classification, category
ORDER BY entity;

-- Update from item_mapping (with explicit matching)
UPDATE sales_data sd
SET 
    fg_classification = imap.fg_classification,
    category = imap.category,
    model = imap.model,
    product = imap.product
FROM item_mapping imap
WHERE TRIM(sd.item_number) = TRIM(imap.item_number)
  AND sd.entity = imap.entity
  AND TRIM(sd.item_number) = '270S_0'
  AND sd.entity = 'Japan'
  AND imap.is_active = true
  AND (
    imap.fg_classification IS NOT NULL OR
    imap.category IS NOT NULL OR
    imap.model IS NOT NULL OR
    imap.product IS NOT NULL
  );

-- Alternative: Update using subquery (more explicit)
UPDATE sales_data
SET 
    fg_classification = (
        SELECT fg_classification 
        FROM item_mapping 
        WHERE TRIM(item_number) = TRIM(sales_data.item_number)
          AND entity = sales_data.entity
          AND is_active = true
        LIMIT 1
    ),
    category = (
        SELECT category 
        FROM item_mapping 
        WHERE TRIM(item_number) = TRIM(sales_data.item_number)
          AND entity = sales_data.entity
          AND is_active = true
        LIMIT 1
    ),
    model = (
        SELECT model 
        FROM item_mapping 
        WHERE TRIM(item_number) = TRIM(sales_data.item_number)
          AND entity = sales_data.entity
          AND is_active = true
        LIMIT 1
    ),
    product = (
        SELECT product 
        FROM item_mapping 
        WHERE TRIM(item_number) = TRIM(sales_data.item_number)
          AND entity = sales_data.entity
          AND is_active = true
        LIMIT 1
    )
WHERE TRIM(item_number) = '270S_0'
  AND entity = 'Japan'
  AND EXISTS (
      SELECT 1 
      FROM item_mapping 
      WHERE TRIM(item_number) = TRIM(sales_data.item_number)
        AND entity = sales_data.entity
        AND is_active = true
  );

-- After update - check new values
SELECT 
    'After Update' as status,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_0'
  AND entity = 'Japan'
GROUP BY entity, item_number, fg_classification, category, model
ORDER BY entity;
