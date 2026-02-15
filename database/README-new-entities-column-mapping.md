# Column Mapping for Mexico, India, Oceania

## 개요
Mexico, India, Oceania는 Japan과 동일한 Excel 파일 구조를 사용합니다.

## 실행 방법

### 옵션 1: Japan의 Mapping 복사 (권장) ⭐

**파일:** `copy-japan-column-mapping-to-new-entities.sql`

Japan에 이미 column mapping이 설정되어 있다면, 이를 자동으로 복사합니다.

```sql
-- Supabase SQL Editor에서 실행
-- 파일: database/copy-japan-column-mapping-to-new-entities.sql
```

**장점:**
- ✅ Japan의 mapping이 업데이트되면 다시 실행해서 동기화 가능
- ✅ 간단하고 빠름
- ✅ 수동 오타 없음

### 옵션 2: 직접 INSERT (백업)

**파일:** `insert-mexico-india-oceania-column-mapping.sql`

Japan의 mapping이 없거나, 옵션 1이 실패할 경우 사용합니다.

```sql
-- Supabase SQL Editor에서 실행
-- 파일: database/insert-mexico-india-oceania-column-mapping.sql
```

## Column Mapping 목록

| Excel Column | DB Column | 설명 |
|--------------|-----------|------|
| Invoice # | invoice | 인보이스 번호 |
| 計上日 | invoice_date | 인보이스 날짜 |
| Industry | industry | 산업 분류 |
| Customer Code | account_number | 고객 코드 |
| Customer Name | name | 고객명 |
| Customer Group | group | 고객 그룹 |
| Currency | currency | 통화 |
| Region(Country) | street | 국가 |
| Region(City) | city | 도시 |
| Item_code | item_number | 제품 코드 |
| Item_name | product_name | 제품명 |
| Qty | quantity | 수량 |
| Amount | line_amount_mst | 금액 |
| Sales Rep | l_wk_name | 영업 담당자 |
| Sales Department | l_dim_cc | 영업 부서 |

## 검증

설정 후 다음 쿼리로 확인:

```sql
-- Entity별 mapping 개수 확인
SELECT 
    entity,
    COUNT(*) as mapping_count
FROM column_mapping
WHERE entity IN ('Japan', 'Mexico', 'India', 'Oceania')
  AND is_active = true
GROUP BY entity
ORDER BY entity;
```

**예상 결과:**
```
entity  | mapping_count
--------|---------------
India   | 18
Japan   | 18
Mexico  | 18
Oceania | 18
```

## Excel 파일 구조

Mexico, India, Oceania의 Excel 파일은 다음 컬럼을 포함해야 합니다:

```
Invoice # | 計上日 | Industry | Customer Code | Customer Name | Customer Group | 
Currency | Region(Country) | Region(City) | Item_code | Item_name | 
Qty | Amount | Sales Rep | Sales Department
```

## 사용 방법

1. **Column Mapping 설정** (이 문서의 SQL 실행)
2. **Item Mapping 설정** (Item Mapping 페이지에서 Excel 업로드)
3. **Sales Data 업로드** (Upload 페이지에서 Excel 업로드)

## 주의사항

⚠️ **Column Mapping이 설정되지 않으면:**
- Upload 시 default column mapping 사용
- Excel 컬럼명이 다르면 데이터가 올바르게 매핑되지 않음

✅ **이 SQL을 실행하면:**
- Japan과 동일한 Excel 구조 사용 가능
- 컬럼명이 자동으로 매핑됨
- 데이터 업로드가 정확해짐

## 실행 순서

1. ✅ Entity 추가 (`add-india-mexico-oceania-entities.sql`) - 이미 완료
2. ✅ Column Mapping 설정 (이 문서의 SQL) - **지금 실행**
3. Item Mapping 설정 (Item Mapping 페이지)
4. Sales Data 업로드 (Upload 페이지)

