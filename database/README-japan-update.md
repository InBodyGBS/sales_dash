# Japan Entity Item Mapping 업데이트 가이드

## 문제 상황
`sales_data` 테이블의 Japan entity 레코드들이 item mapping이 되지 않는 문제를 해결합니다.

## 해결 방법

### 방법 1: SQL 스크립트 (권장)

#### 1단계: 진단
```bash
# Supabase SQL Editor에서 실행
database/diagnose-update-issue.sql
```

이 스크립트는 다음을 확인합니다:
- RLS (Row Level Security) 정책
- 트리거
- 제약 조건
- Foreign Key
- 사용자 권한

#### 2단계: 안전한 업데이트 (트랜잭션 사용)
```bash
# Supabase SQL Editor에서 실행
database/update-japan-sales-data-safe.sql
```

**중요:** 
- 트랜잭션으로 실행되므로 결과 확인 후 `COMMIT;` 또는 `ROLLBACK;` 선택 가능
- 결과가 만족스러우면 `COMMIT;` 실행
- 문제가 있으면 `ROLLBACK;` 실행

#### 3단계: 직접 업데이트 (트랜잭션 없음)
```bash
# Supabase SQL Editor에서 실행
database/update-japan-sales-data.sql
```

### 방법 2: Node.js 스크립트

#### 준비
```bash
npm install @supabase/supabase-js dotenv
```

#### 환경 변수 설정 (.env)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 실행
```bash
node scripts/update-japan-sales-data.js
```

**장점:**
- 진행 상황 로깅
- 배치 처리로 안전
- 에러 처리 포함

### 방법 3: Python 스크립트

#### 준비
```bash
pip install supabase python-dotenv
```

#### 환경 변수 설정 (.env)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 실행
```bash
python scripts/update-japan-sales-data.py
```

## 매핑 로직

### 우선순위
1. **1차:** `item_master` 테이블 (모든 entity에 적용)
2. **2차:** `item_mapping` 테이블 (item_master에 없는 경우만, entity별)

### 업데이트 필드
- `fg_classification`
- `category`
- `model`
- `product`

## 문제 해결

### UPDATE가 실행되지 않는 경우

**가장 가능성 높은 원인: RLS (Row Level Security) 정책**

SQL UPDATE가 실행되지 않는다면 RLS 정책 때문일 가능성이 높습니다.

#### 해결 방법 1: Node.js 스크립트 사용 (권장) ⭐
```bash
# Service Role Key로 RLS 우회
node scripts/update-japan-direct.js
```

이 스크립트는:
- Service Role Key를 사용하여 RLS를 완전히 우회
- 배치 처리로 안전하게 업데이트
- 진행 상황 로깅
- 에러 처리 포함

#### 해결 방법 2: RLS 정책 확인 및 수정
```sql
-- RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'sales_data';

-- RLS 비활성화 (임시, 테스트용)
ALTER TABLE sales_data DISABLE ROW LEVEL SECURITY;

-- 업데이트 실행 후 다시 활성화
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;
```

#### 해결 방법 3: 단일 레코드 테스트
```sql
-- database/test-single-update.sql 실행
-- 단일 레코드로 테스트하여 문제 확인
```

#### 기타 확인 사항
1. **트리거 확인**
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE event_object_table = 'sales_data';
   ```
   - 트리거가 값을 되돌리는지 확인

2. **권한 확인**
   - Service Role Key 사용 권장
   - Admin 권한으로 실행

3. **트랜잭션 확인**
   - `BEGIN;` ... `COMMIT;` 사용하여 명시적으로 커밋

## 테스트

### 테스트 레코드로 검증
```sql
-- 테스트용 레코드 선택
SELECT id, item_number, fg_classification
FROM sales_data
WHERE entity = 'Japan'
  AND item_number = '270S_0'
LIMIT 1;

-- 단일 레코드 업데이트 테스트
UPDATE sales_data
SET fg_classification = 'FG'
WHERE id = 'test-id-here';

-- 확인
SELECT item_number, fg_classification
FROM sales_data
WHERE id = 'test-id-here';
```

## 예상 결과

### 업데이트 전
```
entity  | item_number | fg_classification | product | model | category
--------|-------------|-------------------|---------|-------|----------
Japan   | 270S_0     | NULL             | NULL    | NULL  | NULL
```

### 업데이트 후
```
entity  | item_number | fg_classification | product | model    | category
--------|-------------|-------------------|---------|----------|----------
Japan   | 270S_0     | FG               | InBody  | 270S     | BIA
```

## 주의사항

1. **백업 권장**: 큰 테이블의 경우 업데이트 전 백업 생성
2. **트랜잭션 사용**: `update-japan-sales-data-safe.sql` 사용 권장
3. **테스트 먼저**: 작은 범위로 테스트 후 전체 적용
4. **Service Role Key**: RLS 우회를 위해 Service Role Key 사용

## 파일 설명

- `diagnose-update-issue.sql`: 문제 진단 스크립트
- `update-japan-sales-data.sql`: 직접 업데이트 (트랜잭션 없음)
- `update-japan-sales-data-safe.sql`: 안전한 업데이트 (트랜잭션 사용)
- `update-japan-sales-data.js`: Node.js 업데이트 스크립트
- `update-japan-sales-data.py`: Python 업데이트 스크립트
