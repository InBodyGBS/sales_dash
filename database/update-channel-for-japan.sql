-- Update calculate_channel function to support Japan and other entities
-- This adds logic to map group column directly to channel for Japan, China, India, Mexico, Oceania, Singapore, Asia, Netherlands, Germany, UK, Europe

CREATE OR REPLACE FUNCTION calculate_channel(
    p_entity VARCHAR(50),
    p_group VARCHAR(100),
    p_invoice_account VARCHAR(100)
) RETURNS VARCHAR(50) AS $$
DECLARE
    v_channel VARCHAR(50);
BEGIN
    -- Initialize as NULL
    v_channel := NULL;
    
    -- HQ entity
    IF p_entity = 'HQ' THEN
        IF p_group IN ('CG11', 'CG31') THEN
            -- Check if invoice_account is in Distributor list
            IF p_invoice_account IN (
                'HC000140', 'HC000282', 'HC000290', 'HC000382', 'HC000469', 
                'HC000543', 'HC000586', 'HC000785', 'HC005195', 'HC005197', 
                'HC005873', 'HC005974', 'HC012621'
            ) THEN
                v_channel := 'Distributor';
            ELSE
                v_channel := 'Direct';
            END IF;
        ELSIF p_group = 'CG12' THEN
            v_channel := 'Overseas';
        ELSIF p_group IN ('CG21', 'CG22') THEN
            v_channel := 'Inter-Company';
        END IF;
    
    -- KOROT entity
    ELSIF p_entity = 'Korot' THEN
        IF p_group IN ('CG11', 'CG31') THEN
            -- Check if invoice_account is in Distributor list
            IF p_invoice_account IN (
                'KC000140', 'KC000282', 'KC000382', 'KC000469', 'KC000543', 
                'KC000586', 'KC000785', 'KC005873', 'KC005974', 'KC010343', 
                'KC010367'
            ) THEN
                v_channel := 'Distributor';
            ELSE
                v_channel := 'Direct';
            END IF;
        ELSIF p_group = 'CG12' THEN
            v_channel := 'Overseas';
        ELSIF p_group IN ('CG21', 'CG22') THEN
            v_channel := 'Inter-Company';
        END IF;
    
    -- Healthcare entity
    ELSIF p_entity = 'Healthcare' THEN
        IF p_group IN ('CG11', 'CG31') THEN
            -- Check if invoice_account is in Distributor list
            IF p_invoice_account IN (
                'HCC000005', 'HCC000006', 'HCC000007', 'HCC000008', 'HCC000009', 
                'HCC000010', 'HCC000011', 'HCC000012', 'HCC000013', 'HCC000273'
            ) THEN
                v_channel := 'Distributor';
            ELSE
                v_channel := 'Direct';
            END IF;
        ELSIF p_group = 'CG12' THEN
            v_channel := 'Overseas';
        ELSIF p_group IN ('CG21', 'CG22') THEN
            v_channel := 'Inter-Company';
        END IF;
    
    -- Vietnam entity
    ELSIF p_entity = 'Vietnam' THEN
        IF p_group IN ('CG12', 'CG16', 'CG17', 'CG31') THEN
            v_channel := 'Direct';
        ELSIF p_group = 'CG13' THEN
            v_channel := 'Distributor';
        ELSIF p_group IN ('CG14', 'CG15') THEN
            v_channel := 'Dealer';
        ELSIF p_group IN ('CG21', 'CG22') THEN
            v_channel := 'Inter-Company';
        END IF;
    
    -- BWA entity
    ELSIF p_entity = 'BWA' THEN
        IF UPPER(TRIM(COALESCE(p_group, ''))) IN ('DOMESTIC', 'ETC') THEN
            v_channel := 'Direct';
        ELSIF UPPER(TRIM(COALESCE(p_group, ''))) = 'INTERCOMPA' THEN
            v_channel := 'Inter-Company';
        ELSIF UPPER(TRIM(COALESCE(p_group, ''))) = 'OVERSEAS' THEN
            v_channel := 'Overseas';
        END IF;
    
    -- USA entity
    ELSIF p_entity = 'USA' THEN
        IF p_invoice_account = 'UC000001' THEN
            v_channel := 'Distributor';
        ELSIF UPPER(TRIM(COALESCE(p_group, ''))) IN ('DOMESTIC', 'ETC') THEN
            v_channel := 'Direct';
        ELSIF UPPER(TRIM(COALESCE(p_group, ''))) = 'INTERCOMPA' THEN
            v_channel := 'Inter-Company';
        ELSIF UPPER(TRIM(COALESCE(p_group, ''))) = 'OVERSEAS' THEN
            v_channel := 'Overseas';
        END IF;
    
    -- Japan entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'Japan' THEN
        v_channel := p_group;
    
    -- China entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'China' THEN
        v_channel := p_group;
    
    -- India entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'India' THEN
        v_channel := p_group;
    
    -- Mexico entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'Mexico' THEN
        v_channel := p_group;
    
    -- Oceania entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'Oceania' THEN
        v_channel := p_group;
    
    -- Singapore entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'Singapore' THEN
        v_channel := p_group;
    
    -- Asia entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'Asia' THEN
        v_channel := p_group;
    
    -- Netherlands entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'Netherlands' THEN
        v_channel := p_group;
    
    -- Germany entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'Germany' THEN
        v_channel := p_group;
    
    -- UK entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'UK' THEN
        v_channel := p_group;
    
    -- Europe entity: group 값을 그대로 channel로 사용
    ELSIF p_entity = 'Europe' THEN
        v_channel := p_group;
    END IF;
    
    RETURN v_channel;
END;
$$ LANGUAGE plpgsql;

-- Update existing records for Japan and other entities
UPDATE sales_data
SET channel = calculate_channel(entity, "group", invoice_account)
WHERE entity IN ('Japan', 'China', 'India', 'Mexico', 'Oceania', 'Singapore', 'Asia', 'Netherlands', 'Germany', 'UK', 'Europe')
  AND (channel IS NULL OR channel != calculate_channel(entity, "group", invoice_account));

-- Verify the update
SELECT 
    entity,
    channel,
    COUNT(*) as record_count
FROM sales_data
WHERE entity IN ('Japan', 'China', 'India', 'Mexico', 'Oceania', 'Singapore', 'Asia', 'Netherlands', 'Germany', 'UK', 'Europe')
GROUP BY entity, channel
ORDER BY entity, channel;

-- Check if any Japan records have NULL channel
SELECT 
    entity,
    "group",
    COUNT(*) as null_channel_count
FROM sales_data
WHERE entity = 'Japan'
  AND channel IS NULL
GROUP BY entity, "group"
ORDER BY null_channel_count DESC;

