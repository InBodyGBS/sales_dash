-- Channel이 NULL인 데이터 조회

SELECT 
    id,
    entity,
    "group",
    invoice_account,
    channel,
    invoice_date,
    invoice,
    sales_order,
    item_number,
    product_name,
    line_amount_mst,
    quantity
FROM sales_data
WHERE channel IS NULL
ORDER BY entity, invoice_date DESC, invoice
LIMIT 1000;
