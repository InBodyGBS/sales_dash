# 새로운 Entity 추가 가이드 (2026)

## 추가된 Entity
- **Netherlands** (EUR)
- **Germany** (EUR)
- **UK** (EUR)
- **Asia** (MYR, SGD) - 주 통화: MYR
- **Europe** (EUR)

## 설정 완료 사항

### 1. ✅ 데이터베이스 설정
`database/add-new-entities-2026.sql` 파일을 Supabase SQL Editor에서 실행하세요.

이 파일은 다음을 수행합니다:
- Entity-Currency 매핑 추가
- Exchange Rate 샘플 데이터 추가 (실제 환율로 업데이트 필요)
- Column Mapping 복사 (Japan 방식)

```sql
-- Supabase SQL Editor에서 실행
-- 파일: database/add-new-entities-2026.sql
```

### 2. ✅ 업로드 로직
- **Channel 계산**: Japan 방식과 동일 (Group 값을 그대로 Channel로 사용)
- **Item Mapping**: Japan 방식과 동일 (item_master → item_mapping 순서로 적용)

### 3. ✅ Dashboard
- **구성**: USA 방식과 동일
- **통화 포맷**: 
  - Netherlands, Germany, UK, Europe: EUR (€)
  - Asia: MYR (RM) 또는 SGD (S$) - 데이터의 실제 통화 기준

## 사용 방법

### 0. Column Mapping 설정 (업로드 시)
새로운 entity에 처음 파일을 업로드할 때:

1. **Upload 페이지**에서 entity 선택 (Netherlands, Germany, UK, Asia, Europe)
2. Excel 파일을 드래그 & 드롭 또는 선택
3. **Column Mapping Dialog**가 자동으로 표시됨
4. Excel 컬럼 → DB 컬럼 매핑:
   - 자동 감지된 Excel 컬럼 목록 확인
   - 각 Excel 컬럼을 DB 컬럼에 매핑
   - 예: `Invoice date` → `invoice_date`
5. **"Save Mapping"** 클릭하여 매핑 저장
6. 업로드 진행

**다음 업로드부터는 저장된 매핑이 자동으로 적용됩니다!**

매핑을 수정하려면 **Master Mapping** 페이지에서 언제든지 변경 가능합니다.

### 1. Exchange Rate 업데이트
실제 환율 데이터를 입력하세요 (Master Mapping 페이지에서):

```
Year: 2024, Currency: EUR, Rate: 1450 (예시)
Year: 2024, Currency: MYR, Rate: 300 (예시)
Year: 2024, Currency: SGD, Rate: 950 (예시)
Year: 2025, Currency: EUR, Rate: 1450
Year: 2025, Currency: MYR, Rate: 300
Year: 2025, Currency: SGD, Rate: 950
Year: 2026, Currency: EUR, Rate: 1450
Year: 2026, Currency: MYR, Rate: 300
Year: 2026, Currency: SGD, Rate: 950
```

**참고: Asia는 MYR과 SGD를 혼용합니다.**
- Entity Currency 매핑: MYR (주 통화)
- Dashboard 표시: 데이터의 실제 통화 기준 (MYR 또는 SGD)
- Group Dashboard: 각 행의 실제 통화에 맞는 환율 적용

### 2. Column Mapping 확인
Master Mapping 페이지에서 각 entity의 Column Mapping이 제대로 복사되었는지 확인하세요.

기본값으로 Japan의 Column Mapping이 복사되어 있습니다.

### 3. 데이터 업로드
1. Dashboard 페이지에서 원하는 entity 선택
2. Upload 페이지에서 Excel 파일 업로드
3. Japan과 동일한 방식으로 처리됨:
   - Group → Channel 자동 매핑
   - Item Master/Mapping 자동 적용

### 4. Item Mapping 설정 (선택사항)
Master Mapping 페이지에서:
- **Item Master**: 모든 entity에 공통으로 적용
- **Item Mapping**: 특정 entity에만 적용 (entity 선택 후)

## ⚠️ 중요: 초기 설정 스크립트

**`add-new-entities-2026.sql`은 초기 설정용 스크립트입니다!**

### 처음 실행 시
- ✅ Japan의 Column Mapping을 복사하여 초기 매핑 생성
- ✅ Entity Currency 설정
- ✅ Exchange Rate 샘플 데이터 추가

### 다시 실행하면?
- ⚠️ **기존 커스텀 매핑이 모두 삭제됩니다!**
- ⚠️ Japan 매핑으로 덮어씌워집니다!

### 운영 시
- 각 entity의 Column Mapping은 **Master Mapping 페이지**에서 관리
- 각 entity는 **독립적**으로 관리됨
- Japan 매핑과 일치하지 않아도 됨
- **이 SQL은 다시 실행하지 마세요!**

## 주의사항

### Exchange Rate
- **중요**: 반드시 실제 환율로 업데이트하세요!
- 현재는 샘플 데이터만 입력되어 있습니다.
- Master Mapping 페이지에서 쉽게 관리 가능합니다.

### Column Mapping
- **초기값**: Japan 매핑을 복사하여 시작
- **이후**: 각 entity를 독립적으로 관리
- **수정**: Master Mapping 페이지에서 entity별로 변경 가능
- **주의**: `add-new-entities-2026.sql`을 다시 실행하면 커스텀 매핑이 삭제됨!

### Dashboard
- USA 방식과 동일한 구성
- 차트 포맷은 각 entity의 통화에 맞게 자동 표시
- Group Dashboard에도 자동 포함

## 환율 적용 방식

### InBody Group Dashboard
모든 금액이 **KRW**로 환산되어 표시됩니다:

- **Netherlands** (EUR): Amount × EUR Rate → KRW
- **Germany** (EUR): Amount × EUR Rate → KRW  
- **UK** (EUR): Amount × EUR Rate → KRW
- **Asia**: 
  - MYR 데이터: Amount × MYR Rate → KRW
  - SGD 데이터: Amount × SGD Rate → KRW
- **Europe** (EUR): Amount × EUR Rate → KRW

### Entity별 Dashboard
각 entity의 통화 그대로 표시됩니다:

- **Netherlands**: EUR (€)
- **Germany**: EUR (€)
- **UK**: EUR (€)
- **Asia**: MYR (RM) 또는 SGD (S$) - 실제 데이터의 통화 기준
- **Europe**: EUR (€)

## 파일 구조

```
app/
├── (dashboard)/
│   ├── dashboard/
│   │   ├── page.tsx                    # Entity 선택 페이지 (새 entity 추가됨)
│   │   └── group/page.tsx              # Group Dashboard (새 entity 포함)
│   └── master-mapping/page.tsx         # Item Mapping & Exchange Rate 관리
├── api/
│   └── upload/
│       └── process/route.ts            # Upload 로직 (새 entity 처리)
database/
├── add-new-entities-2026.sql           # 새 entity 설정 SQL ⭐
└── README-new-entities-2026.md         # 이 파일
lib/
├── types/sales.ts                      # Entity 타입 추가
└── utils/formatters.ts                 # EUR/GBP 포맷터 추가
```

## 테스트 체크리스트

- [ ] SQL 파일 실행 (`add-new-entities-2026.sql`)
- [ ] Exchange Rate 실제 값으로 업데이트
- [ ] Column Mapping 확인 (각 entity별)
- [ ] 테스트 데이터 업로드
- [ ] Entity Dashboard 확인 (통화 포맷)
- [ ] Group Dashboard 확인 (KRW 환산)
- [ ] Item Mapping 작동 확인

## 문제 해결

### Column Mapping이 비어있는 경우
SQL에서 Japan의 Column Mapping을 수동으로 복사:

```sql
INSERT INTO column_mapping (entity, excel_column, db_column, is_active)
SELECT 'Netherlands', excel_column, db_column, is_active
FROM column_mapping
WHERE entity = 'Japan' AND is_active = true
ON CONFLICT (entity, excel_column) DO UPDATE 
SET db_column = EXCLUDED.db_column;
```

### Exchange Rate가 적용되지 않는 경우
1. Master Mapping에서 환율 데이터 확인
2. Year, Currency가 정확한지 확인
3. Materialized View 새로고침:
   ```sql
   REFRESH MATERIALIZED VIEW mv_sales_cube;
   ```

### Dashboard에 데이터가 안 보이는 경우
1. 데이터가 정상적으로 업로드되었는지 확인
2. Year 필터 확인
3. mv_sales_cube 새로고침

