# Item Mapping 자동 업데이트 설명

## 현재 상황

### ✅ 이미 구현된 자동 업데이트

**`app/api/item-mapping/process/route.ts`** (432-516줄)에 이미 자동 업데이트 로직이 있습니다:

1. **Item Mapping 파일 업로드 시 자동 실행**
   - 파일 업로드 → Storage 저장 → 처리 API 호출
   - 처리 API에서 `item_mapping` 테이블에 데이터 삽입
   - **자동으로 `sales_data` 업데이트** (432-516줄)

2. **업데이트 로직**
   - `item_mapping`의 모든 항목을 `sales_data`에 적용
   - 배치 처리로 성능 최적화
   - 각 `item_number`별로 `fg_classification`, `category`, `model`, `product` 업데이트

### ❌ 문제점: 트리거가 덮어쓰기

**`auto_calculate_derived_columns` 트리거**가 UPDATE 후에 `fg_classification`을 "NonFG"로 덮어쓰고 있었습니다.

## 해결 방법

### 1단계: 트리거 비활성화 (완료 ✅)
- `fix-270S_O-with-trigger-disabled.sql` 실행
- 트리거 비활성화로 수동 업데이트 성공

### 2단계: 함수 수정 및 트리거 재활성화 (필요)

**`fix-and-re-enable-trigger.sql` 실행:**
1. 함수 수정: `item_mapping`/`item_master`가 있으면 덮어쓰지 않음
2. 트리거 재활성화
3. 테스트

## 앞으로의 동작 방식

### ✅ 자동 업데이트 (함수 수정 후)

1. **Item Mapping 파일 업로드**
   ```
   사용자 → 파일 업로드 → Storage 저장
   ```

2. **자동 처리**
   ```
   처리 API → item_mapping 테이블 삽입
          → sales_data 자동 업데이트 (이미 구현됨)
          → 트리거 실행 (함수 수정 후 덮어쓰지 않음)
   ```

3. **결과**
   - `item_mapping`의 값이 `sales_data`에 자동 반영
   - 트리거가 덮어쓰지 않음
   - **SQL 수동 실행 불필요** ✅

### ❌ 수동 업데이트 (현재 상태)

현재는 트리거가 비활성화되어 있어서:
- 파일 업로드 시 자동 업데이트는 작동함
- 하지만 트리거가 재활성화되면 다시 덮어쓸 수 있음
- 따라서 함수를 수정해야 함

## 권장 사항

### 지금 해야 할 일

1. **`fix-and-re-enable-trigger.sql` 실행**
   - 함수 수정
   - 트리거 재활성화
   - 테스트

2. **이후에는 자동으로 작동**
   - Item Mapping 파일 업로드만 하면 됨
   - SQL 수동 실행 불필요 ✅

### 수동 업데이트가 필요한 경우

다음 경우에만 수동으로 `update-sales-data` API를 호출하거나 SQL을 실행:

1. **기존 데이터 일괄 업데이트**
   - 이미 업로드된 `item_mapping` 데이터로 기존 `sales_data` 업데이트
   - 예: `update-all-japan-complete.sql`

2. **특정 엔티티만 업데이트**
   - Item Mapping 파일 없이 특정 엔티티만 업데이트
   - 예: `update-all-japan-complete.sql`

## 요약

| 상황 | SQL 수동 실행 필요? |
|------|-------------------|
| **Item Mapping 파일 업로드** | ❌ **불필요** (자동 업데이트) |
| **기존 데이터 일괄 업데이트** | ✅ 필요 (한 번만) |
| **함수 수정 후** | ❌ **불필요** (모두 자동) |

**결론:** 함수를 수정하고 트리거를 재활성화하면, 앞으로는 **파일 업로드만 하면 자동으로 업데이트**됩니다! 🎉
