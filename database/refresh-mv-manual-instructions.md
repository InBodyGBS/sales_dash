# Materialized View 갱신 방법

## 문제
RPC 함수가 timeout으로 실패하는 경우, 데이터베이스에서 직접 SQL을 실행해야 합니다.

## 해결 방법

### 방법 1: Supabase SQL Editor에서 직접 실행 (권장)

1. Supabase Dashboard에 로그인
2. SQL Editor로 이동
3. 다음 SQL 실행:

```sql
REFRESH MATERIALIZED VIEW mv_sales_cube;
```

### 방법 2: RPC 함수 재생성 후 실행

1. `database/fix-refresh-mv-function-timeout.sql` 파일 실행
2. Dashboard에서 "갱신" 버튼 클릭

### 방법 3: 특정 연도만 갱신 (더 빠름)

Materialized view 전체를 갱신하는 대신, 특정 연도의 데이터만 확인:

```sql
-- 2024년 데이터 확인
SELECT COUNT(*) FROM sales_data WHERE year = 2024 AND entity = 'Oceania';
SELECT COUNT(*) FROM mv_sales_cube WHERE year = 2024 AND entity = 'Oceania';

-- 전체 갱신
REFRESH MATERIALIZED VIEW mv_sales_cube;
```

## 예상 소요 시간
- 소량 데이터 (< 10,000 rows): 1-5초
- 중간 데이터 (10,000 - 100,000 rows): 5-30초
- 대량 데이터 (> 100,000 rows): 30초 - 5분

## 주의사항
- Materialized view 갱신 중에는 해당 view를 조회할 수 없습니다 (락 발생)
- 갱신은 일반적으로 1-2분 이내에 완료됩니다
- Timeout이 계속 발생하면 Supabase 프로젝트 설정에서 statement timeout을 늘려야 할 수 있습니다
