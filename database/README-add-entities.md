# Adding India, Mexico, Oceania Entities

## 문제
India, Mexico, Oceania entity를 추가했지만, 데이터베이스의 체크 제약 조건(check constraint)이 이 entity들을 허용하지 않아서 다음 에러가 발생합니다:

```
new row for relation "item_mapping" violates check constraint "valid_entity_item_mapping"
```

## 해결 방법

### 1단계: 마이그레이션 SQL 실행

Supabase SQL Editor에서 다음 파일을 실행하세요:

```sql
-- database/add-india-mexico-oceania-entities.sql
```

이 스크립트는 다음 테이블의 제약 조건을 업데이트합니다:
- ✅ `item_mapping` - Item Mapping 테이블
- ✅ `column_mapping` - Column Mapping 테이블  
- ✅ `sales_data` - Sales Data 테이블
- ✅ `upload_history` - Upload History 테이블

### 2단계: 실행 방법

**Supabase Dashboard:**
1. Supabase Dashboard → SQL Editor 메뉴
2. "New query" 클릭
3. `database/add-india-mexico-oceania-entities.sql` 파일 내용 복사 & 붙여넣기
4. "Run" 버튼 클릭

### 3단계: 검증

마이그레이션이 성공했는지 확인:

```sql
-- 업데이트된 제약 조건 확인
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname LIKE '%valid_entity%'
ORDER BY table_name, constraint_name;
```

**예상 결과:**
```
valid_entity_item_mapping | item_mapping | CHECK ((entity)::text = ANY (ARRAY[... 'India', 'Mexico', 'Oceania']))
valid_entity_mapping      | column_mapping | CHECK ((entity)::text = ANY (ARRAY[... 'India', 'Mexico', 'Oceania']))
valid_entity              | sales_data | CHECK ((entity)::text = ANY (ARRAY[... 'India', 'Mexico', 'Oceania']))
```

### 4단계: Item Mapping 업로드 재시도

마이그레이션 후:
1. Item Mapping 페이지로 이동
2. Entity: India/Mexico/Oceania 선택
3. Excel 파일 업로드
4. ✅ 성공!

## 업데이트된 Entity 목록

전체 11개 Entity:
- HQ
- USA
- BWA
- Vietnam
- Healthcare
- Korot
- Japan (Item Mapping 사용)
- China (Item Mapping 사용)
- **India** ✨ (Item Mapping 사용)
- **Mexico** ✨ (Item Mapping 사용)
- **Oceania** ✨ (Item Mapping 사용)

## Item Mapping이 필요한 Entity

- Japan
- China
- India ✨
- Mexico ✨
- Oceania ✨

이 entity들은 FG Classification이 필요합니다.

## 변경된 파일

### 데이터베이스 스키마:
- ✅ `database/add-india-mexico-oceania-entities.sql` (마이그레이션)
- ✅ `database/create-item-mapping-table.sql`
- ✅ `database/create-column-mapping-table.sql`
- ✅ `database/schema-full.sql`
- ✅ `database/drop-and-recreate-full.sql`

### API 코드:
- ✅ `app/api/upload/process/route.ts` - entitiesRequiringItemMapping 업데이트

### Frontend:
- ✅ `lib/types/sales.ts` - Entity 타입 정의
- ✅ `app/(dashboard)/dashboard/page.tsx` - Entity 목록
- ✅ `app/(dashboard)/upload/page.tsx` - Upload 페이지
- ✅ `app/(dashboard)/item-mapping/page.tsx` - Item Mapping 페이지
- ✅ `app/(dashboard)/dashboard/[entity]/page.tsx` - FG Distribution
- ✅ `app/(dashboard)/dashboard/group/page.tsx` - Group Dashboard
- ✅ `app/api/entities/route.ts` - Entity API
- ✅ `app/api/entities/available/route.ts` - Available Entities API

## 주의사항

⚠️ **중요:** 데이터베이스 마이그레이션(`add-india-mexico-oceania-entities.sql`)을 먼저 실행해야 합니다!

마이그레이션을 실행하지 않으면:
- Item Mapping 업로드 실패 (`valid_entity_item_mapping` 에러)
- Sales Data 업로드 실패 (`valid_entity` 에러)

