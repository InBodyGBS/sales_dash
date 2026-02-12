-- Check China entity fg_classification for blank/null values
-- This helps identify records that need fg_classification mapping

-- 1. Count records with NULL or empty fg_classification
SELECT 
    'Total Records' as metric,
    COUNT(*) as count
FROM sales_data
WHERE entity = 'China'
UNION ALL
SELECT 
    'NULL fg_classification' as metric,
    COUNT(*) as count
FROM sales_data
WHERE entity = 'China'
    AND fg_classification IS NULL
UNION ALL
SELECT 
    'Empty string fg_classification' as metric,
    COUNT(*) as count
FROM sales_data
WHERE entity = 'China'
    AND (fg_classification = '' OR fg_classification = ' ')
UNION ALL
SELECT 
    'Has fg_classification' as metric,
    COUNT(*) as count
FROM sales_data
WHERE entity = 'China'
    AND fg_classification IS NOT NULL
    AND fg_classification != ''
    AND fg_classification != ' ';

-- 2. Sample records with blank fg_classification
SELECT 
    id,
    year,
    invoice_date,
    invoice,
    item_number,
    product,
    fg_classification,
    line_amount_mst,
    quantity
FROM sales_data
WHERE entity = 'China'
    AND (fg_classification IS NULL OR fg_classification = '' OR fg_classification = ' ')
ORDER BY year DESC, invoice_date DESC
LIMIT 50;

-- 3. Count by year
SELECT 
    year,
    COUNT(*) as total_records,
    COUNT(CASE WHEN fg_classification IS NULL OR fg_classification = '' OR fg_classification = ' ' THEN 1 END) as blank_fg_count,
    COUNT(CASE WHEN fg_classification IS NOT NULL AND fg_classification != '' AND fg_classification != ' ' THEN 1 END) as has_fg_count,
    ROUND(
        (COUNT(CASE WHEN fg_classification IS NULL OR fg_classification = '' OR fg_classification = ' ' THEN 1 END)::NUMERIC / COUNT(*)) * 100, 
        2
    ) as blank_percentage
FROM sales_data
WHERE entity = 'China'
GROUP BY year
ORDER BY year DESC;

-- 4. Count by item_number (to see which items need mapping)
SELECT 
    item_number,
    COUNT(*) as record_count,
    COUNT(CASE WHEN fg_classification IS NULL OR fg_classification = '' OR fg_classification = ' ' THEN 1 END) as blank_fg_count,
    SUM(line_amount_mst) as total_amount
FROM sales_data
WHERE entity = 'China'
    AND (fg_classification IS NULL OR fg_classification = '' OR fg_classification = ' ')
GROUP BY item_number
ORDER BY record_count DESC, total_amount DESC
LIMIT 50;

-- 5. Check if items exist in item_master or item_mapping
SELECT 
    sd.item_number,
    COUNT(*) as sales_data_count,
    COUNT(CASE WHEN sd.fg_classification IS NULL OR sd.fg_classification = '' OR sd.fg_classification = ' ' THEN 1 END) as blank_fg_count,
    CASE WHEN im.item_number IS NOT NULL THEN 'YES' ELSE 'NO' END as in_item_master,
    CASE WHEN imap.item_number IS NOT NULL THEN 'YES' ELSE 'NO' END as in_item_mapping,
    im.fg_classification as item_master_fg,
    imap.fg_classification as item_mapping_fg
FROM sales_data sd
LEFT JOIN item_master im ON sd.item_number = im.item_number AND im.is_active = true
LEFT JOIN item_mapping imap ON sd.item_number = imap.item_number AND sd.entity = imap.entity AND imap.is_active = true
WHERE sd.entity = 'China'
    AND (sd.fg_classification IS NULL OR sd.fg_classification = '' OR sd.fg_classification = ' ')
GROUP BY sd.item_number, im.item_number, imap.item_number, im.fg_classification, imap.fg_classification
ORDER BY sales_data_count DESC
LIMIT 50;

-- 6. Summary by fg_classification value
SELECT 
    COALESCE(fg_classification, 'NULL') as fg_classification,
    CASE 
        WHEN fg_classification IS NULL THEN 'NULL'
        WHEN fg_classification = '' THEN 'Empty String'
        WHEN fg_classification = ' ' THEN 'Space'
        ELSE 'Has Value'
    END as status,
    COUNT(*) as record_count,
    SUM(line_amount_mst) as total_amount,
    MIN(invoice_date) as earliest_date,
    MAX(invoice_date) as latest_date
FROM sales_data
WHERE entity = 'China'
GROUP BY fg_classification
ORDER BY record_count DESC;

-- 7. 상세 item_number별 분석 (fg_classification 공란)
SELECT 
    sd.item_number,
    COUNT(*) as total_records,
    COUNT(CASE WHEN sd.fg_classification IS NULL OR sd.fg_classification = '' OR sd.fg_classification = ' ' THEN 1 END) as blank_fg_count,
    COUNT(DISTINCT sd.year) as years_count,
    COUNT(DISTINCT sd.product) as products_count,
    COUNT(DISTINCT sd.category) as categories_count,
    SUM(sd.line_amount_mst) as total_amount,
    SUM(sd.quantity) as total_quantity,
    MIN(sd.invoice_date) as earliest_date,
    MAX(sd.invoice_date) as latest_date,
    -- Item Master 정보
    CASE WHEN im.item_number IS NOT NULL THEN 'YES' ELSE 'NO' END as in_item_master,
    im.fg_classification as item_master_fg,
    im.category as item_master_category,
    im.product as item_master_product,
    -- Item Mapping 정보
    CASE WHEN imap.item_number IS NOT NULL THEN 'YES' ELSE 'NO' END as in_item_mapping,
    imap.fg_classification as item_mapping_fg,
    imap.category as item_mapping_category,
    imap.product as item_mapping_product,
    -- Sales Data에서 가장 많이 사용된 값들
    MODE() WITHIN GROUP (ORDER BY sd.product) as most_common_product,
    MODE() WITHIN GROUP (ORDER BY sd.category) as most_common_category,
    MODE() WITHIN GROUP (ORDER BY sd.model) as most_common_model
FROM sales_data sd
LEFT JOIN item_master im ON sd.item_number = im.item_number AND im.is_active = true
LEFT JOIN item_mapping imap ON sd.item_number = imap.item_number AND sd.entity = imap.entity AND imap.is_active = true
WHERE sd.entity = 'China'
    AND (sd.fg_classification IS NULL OR sd.fg_classification = '' OR sd.fg_classification = ' ')
GROUP BY 
    sd.item_number,
    im.item_number,
    im.fg_classification,
    im.category,
    im.product,
    imap.item_number,
    imap.fg_classification,
    imap.category,
    imap.product
ORDER BY total_records DESC, total_amount DESC
LIMIT 100;

-- 8. item_number별 연도별 상세 분석
SELECT 
    sd.item_number,
    sd.year,
    COUNT(*) as record_count,
    COUNT(CASE WHEN sd.fg_classification IS NULL OR sd.fg_classification = '' OR sd.fg_classification = ' ' THEN 1 END) as blank_fg_count,
    SUM(sd.line_amount_mst) as total_amount,
    SUM(sd.quantity) as total_quantity,
    MIN(sd.invoice_date) as earliest_date,
    MAX(sd.invoice_date) as latest_date,
    MODE() WITHIN GROUP (ORDER BY sd.product) as most_common_product,
    MODE() WITHIN GROUP (ORDER BY sd.category) as most_common_category
FROM sales_data sd
WHERE sd.entity = 'China'
    AND (sd.fg_classification IS NULL OR sd.fg_classification = '' OR sd.fg_classification = ' ')
GROUP BY sd.item_number, sd.year
ORDER BY sd.item_number, sd.year DESC
LIMIT 200;

-- 9. item_number별 샘플 레코드 (상세 정보)
SELECT 
    sd.id,
    sd.item_number,
    sd.year,
    sd.month,
    sd.quarter,
    sd.invoice_date,
    sd.invoice,
    sd.product,
    sd.category,
    sd.model,
    sd.fg_classification as current_fg,
    sd.line_amount_mst,
    sd.quantity,
    sd.currency,
    -- Item Master/Mapping 정보
    im.fg_classification as item_master_fg,
    imap.fg_classification as item_mapping_fg,
    CASE 
        WHEN im.fg_classification IS NOT NULL THEN 'item_master'
        WHEN imap.fg_classification IS NOT NULL THEN 'item_mapping'
        ELSE 'no_mapping'
    END as mapping_source
FROM sales_data sd
LEFT JOIN item_master im ON sd.item_number = im.item_number AND im.is_active = true
LEFT JOIN item_mapping imap ON sd.item_number = imap.item_number AND sd.entity = imap.entity AND imap.is_active = true
WHERE sd.entity = 'China'
    AND (sd.fg_classification IS NULL OR sd.fg_classification = '' OR sd.fg_classification = ' ')
ORDER BY sd.item_number, sd.year DESC, sd.invoice_date DESC
LIMIT 100;
