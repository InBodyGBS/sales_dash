-- Add Singapore to entity_currency table and add Asia, Europe entities
-- Also add corresponding exchange rates

-- 1. Add missing entities to entity_currency table
INSERT INTO entity_currency (entity, currency) VALUES
('Singapore', 'SGD'),
('Asia', 'MYR'),  -- Asia entity uses MYR (Malaysia Ringgit)
('Europe', 'EUR'),
('Netherlands', 'EUR'),
('Germany', 'EUR'),
('UK', 'EUR')  -- UK also uses EUR
ON CONFLICT (entity) DO UPDATE SET currency = EXCLUDED.currency;

-- 2. Check if exchange_rate table exists and has the currencies
-- Add Singapore Dollar (SGD) exchange rate
INSERT INTO exchange_rate (year, currency, rate) VALUES
(2025, 'SGD', 950),
(2024, 'SGD', 950),
(2023, 'SGD', 950)
ON CONFLICT (year, currency) DO UPDATE SET rate = EXCLUDED.rate;

-- 3. Add other missing currency rates if not exists
INSERT INTO exchange_rate (year, currency, rate) VALUES
-- EUR (Euro) - for Europe, Netherlands, Germany, UK
(2025, 'EUR', 1450),
(2024, 'EUR', 1450),
(2023, 'EUR', 1450),
-- MYR (Malaysia Ringgit) - for Asia
(2025, 'MYR', 300),
(2024, 'MYR', 300),
(2023, 'MYR', 300),
-- AUD (Australian Dollar) - for Oceania
(2025, 'AUD', 850),
(2024, 'AUD', 850),
(2023, 'AUD', 850)
ON CONFLICT (year, currency) DO UPDATE SET rate = EXCLUDED.rate;

-- 4. Verify the updates
SELECT * FROM entity_currency WHERE entity IN ('Singapore', 'Asia', 'Europe', 'Netherlands', 'Germany', 'UK', 'Oceania') ORDER BY entity;

SELECT * FROM exchange_rate WHERE currency IN ('SGD', 'EUR', 'MYR', 'AUD') ORDER BY year DESC, currency;

-- 5. Test query to check Singapore, UK, and Asia KRW conversion
SELECT 
    s.entity,
    s.year,
    ec.currency,
    e.rate as exchange_rate,
    SUM(s.total_amount) as original_amount,
    SUM(
        CASE 
            WHEN s.entity IN ('HQ', 'Korot', 'Healthcare') THEN s.total_amount
            ELSE ROUND(s.total_amount * COALESCE(e.rate, 1))
        END
    ) as amount_krw
FROM mv_sales_cube s
LEFT JOIN entity_currency ec ON s.entity = ec.entity
LEFT JOIN exchange_rate e ON s.year = e.year AND ec.currency = e.currency
WHERE s.entity IN ('Singapore', 'UK', 'Asia')
  AND s.year = 2025
  AND (s.channel IS NULL OR s.channel != 'Inter-Company')
GROUP BY s.entity, s.year, ec.currency, e.rate
ORDER BY s.entity;

