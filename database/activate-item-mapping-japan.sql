-- Activate item_mapping records for Japan entity
-- This will set is_active = true for all Japan item_mapping records

-- Step 1: Check current status
SELECT 
    'BEFORE ACTIVATION' as status,
    is_active,
    COUNT(*) as record_count
FROM item_mapping
WHERE entity = 'Japan'
GROUP BY is_active;

-- Step 2: Activate all Japan item_mapping records
UPDATE item_mapping
SET 
    is_active = true,
    updated_at = NOW()
WHERE entity = 'Japan'
  AND is_active = false;

-- Step 3: Verify activation
SELECT 
    'AFTER ACTIVATION' as status,
    is_active,
    COUNT(*) as record_count
FROM item_mapping
WHERE entity = 'Japan'
GROUP BY is_active;

-- Step 4: Now update sales_data (using subquery for reliability)
UPDATE sales_data
SET 
    fg_classification = (
        SELECT fg_classification 
        FROM item_mapping 
        WHERE item_mapping.item_number = sales_data.item_number
          AND item_mapping.entity = sales_data.entity
          AND item_mapping.is_active = true
        LIMIT 1
    ),
    category = (
        SELECT category 
        FROM item_mapping 
        WHERE item_mapping.item_number = sales_data.item_number
          AND item_mapping.entity = sales_data.entity
          AND item_mapping.is_active = true
        LIMIT 1
    ),
    model = (
        SELECT model 
        FROM item_mapping 
        WHERE item_mapping.item_number = sales_data.item_number
          AND item_mapping.entity = sales_data.entity
          AND item_mapping.is_active = true
        LIMIT 1
    ),
    product = (
        SELECT product 
        FROM item_mapping 
        WHERE item_mapping.item_number = sales_data.item_number
          AND item_mapping.entity = sales_data.entity
          AND item_mapping.is_active = true
        LIMIT 1
    )
WHERE entity = 'Japan'
  AND EXISTS (
      SELECT 1 
      FROM item_mapping 
      WHERE item_mapping.item_number = sales_data.item_number
        AND item_mapping.entity = sales_data.entity
        AND item_mapping.is_active = true
  );

-- Step 5: Verify sales_data update for 270S_0
SELECT 
    'AFTER SALES_DATA UPDATE' as status,
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
