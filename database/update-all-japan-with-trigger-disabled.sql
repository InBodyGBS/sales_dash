-- Update all Japan sales_data from item_mapping/item_master with trigger disabled
-- This ensures the trigger doesn't override the updates

-- Step 1: Disable the trigger
ALTER TABLE sales_data DISABLE TRIGGER trg_calculate_derived_columns;

-- Step 2: Update from item_master (applies to ALL entities, but we filter for Japan)
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

-- Step 3: Update from item_mapping (entity-specific, only if not in item_master)
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

-- Step 4: Check results for 270S_O specifically
SELECT 
    'AFTER UPDATE - 270S_O' as status,
    entity,
    item_number,
    fg_classification,
    category,
    model,
    COUNT(*) as record_count
FROM sales_data
WHERE item_number = '270S_O'
  AND entity = 'Japan'
GROUP BY entity, item_number, fg_classification, category, model;

-- Step 5: Check overall Japan update results
SELECT 
    'AFTER UPDATE - ALL JAPAN' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN fg_classification IS NOT NULL THEN 1 END) as with_fg,
    COUNT(CASE WHEN fg_classification = 'FG' THEN 1 END) as fg_count,
    COUNT(CASE WHEN fg_classification = 'NonFG' THEN 1 END) as nonfg_count
FROM sales_data
WHERE entity = 'Japan'
  AND item_number IS NOT NULL;

-- Step 6: Re-enable the trigger (uncomment when ready)
-- NOTE: After re-enabling, you should modify the function to preserve fg_classification
-- ALTER TABLE sales_data ENABLE TRIGGER trg_calculate_derived_columns;
