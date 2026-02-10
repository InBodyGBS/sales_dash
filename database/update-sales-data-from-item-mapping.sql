-- Update sales_data from item_mapping and item_master
-- This script updates fg_classification, category, model, and product fields
-- Priority: item_master > item_mapping (entity-specific)

-- 1. Update from item_master (applies to ALL entities for each item_number)
UPDATE sales_data sd
SET 
    fg_classification = COALESCE(im.fg_classification, sd.fg_classification),
    category = COALESCE(im.category, sd.category),
    model = COALESCE(im.model, sd.model),
    product = COALESCE(im.product, sd.product)
FROM item_master im
WHERE sd.item_number = im.item_number
  AND im.is_active = true
  AND (
    im.fg_classification IS NOT NULL OR
    im.category IS NOT NULL OR
    im.model IS NOT NULL OR
    im.product IS NOT NULL
  );

-- 2. Update from item_mapping (entity-specific, only if not updated by item_master)
UPDATE sales_data sd
SET 
    fg_classification = COALESCE(imap.fg_classification, sd.fg_classification),
    category = COALESCE(imap.category, sd.category),
    model = COALESCE(imap.model, sd.model),
    product = COALESCE(imap.product, sd.product)
FROM item_mapping imap
WHERE sd.item_number = imap.item_number
  AND sd.entity = imap.entity
  AND imap.is_active = true
  AND NOT EXISTS (
    -- Skip if item_master has this item_number
    SELECT 1 FROM item_master im
    WHERE im.item_number = sd.item_number
      AND im.is_active = true
  )
  AND (
    imap.fg_classification IS NOT NULL OR
    imap.category IS NOT NULL OR
    imap.model IS NOT NULL OR
    imap.product IS NOT NULL
  );

-- 3. Check specific item (270S_0)
SELECT 
    'After Update' as status,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    product,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_0'
GROUP BY entity, item_number, fg_classification, category, model, product
ORDER BY entity;
