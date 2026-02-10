# 빠른 시작 가이드: Japan Sales Data 업데이트

## 현재 상황
- SQL UPDATE가 실행되지 않음
- `fg_classification`이 'NonFG'로 유지됨
- RLS 정책 또는 권한 문제로 추정

## 해결 방법: Node.js 스크립트 사용

### 1단계: 환경 변수 설정

`.env` 파일에 다음 추가:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Service Role Key 찾는 방법:**
1. Supabase Dashboard → Settings → API
2. `service_role` key 복사 (⚠️ 비밀 키이므로 공유하지 마세요)

### 2단계: 패키지 설치 (필요한 경우)

```bash
npm install @supabase/supabase-js dotenv
```

### 3단계: 스크립트 실행

```bash
node scripts/update-japan-direct.js
```

### 4단계: 결과 확인

스크립트가 다음을 출력합니다:
- ✅ 로드된 매핑 수
- ✅ 업데이트된 레코드 수
- ✅ 270S_0 결과 확인

## 예상 출력

```
🚀 Starting Japan sales_data update with Service Role Key...

📥 Loading item_master mappings...
✅ Loaded 1000 item_master mappings

📥 Loading item_mapping mappings for Japan...
✅ Loaded 500 item_mapping mappings (not in master)

📄 Processing page 1 (1000 records, total: 50000)
   ✅ Updated 156 records

✅ Update completed!
   Total processed: 50000 records
   Total updated: 156 records

📊 Checking result for 270S_0...
   270S_0: fg=FG, category=InBody

🎉 Done!
```

## 문제 해결

### 에러: "SUPABASE_SERVICE_ROLE_KEY must be set"
→ `.env` 파일에 Service Role Key가 제대로 설정되었는지 확인

### 에러: "Failed to update"
→ Supabase Dashboard에서 Service Role Key 권한 확인

### 업데이트가 여전히 안 됨
→ `database/diagnose-update-issue.sql` 실행하여 RLS 정책 확인

## 다음 단계

업데이트 완료 후:
1. Supabase에서 결과 확인
2. `fg_classification`이 'FG'로 변경되었는지 확인
3. 필요시 다른 엔티티에도 동일한 스크립트 적용
