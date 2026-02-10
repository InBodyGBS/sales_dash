-- Update sales_data for Japan entity only (to avoid timeout)
-- This is a smaller, faster update focused on Japan entity

-- ============================================
-- STEP 1: Update Japan from item_master
-- ============================================
UPDATE sales_data sd
SET 
    fg_classification = COALESCE(im.fg_classification, sd.fg_classification),
    category = COALESCE(im.category, sd.category),
    model = COALESCE(im.model, sd.model),
    product = COALESCE(im.product, sd.product)
FROM item_master im
WHERE sd.item_number = im.item_number
  AND sd.entity = 'Japan'
  AND im.is_active = true
  AND (
    im.fg_classification IS NOT NULL OR
    im.category IS NOT NULL OR
    im.model IS NOT NULL OR
    im.product IS NOT NULL
  );

-- ============================================
-- STEP 2: Update Japan from item_mapping
-- ============================================
UPDATE sales_data sd
SET 
    fg_classification = COALESCE(imap.fg_classification, sd.fg_classification),
    category = COALESCE(imap.category, sd.category),
    model = COALESCE(imap.model, sd.model),
    product = COALESCE(imap.product, sd.product)
FROM item_mapping imap
WHERE sd.item_number = imap.item_number
  AND sd.entity = 'Japan'
  AND imap.entity = 'Japan'
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

-- ============================================
-- STEP 3: Check results for 270S_0
-- ============================================
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

-- ============================================
-- STEP 4: Summary for Japan
-- ============================================
SELECT 
    'Summary' as status,
    COUNT(DISTINCT item_number) as unique_items,
    COUNT(*) as total_records,
    COUNT(CASE WHEN fg_classification IS NOT NULL THEN 1 END) as records_with_fg,
    COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as records_with_category
FROM sales_data
WHERE entity = 'Japan';
