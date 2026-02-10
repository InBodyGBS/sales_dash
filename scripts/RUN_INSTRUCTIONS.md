# Node.js 스크립트 실행 방법

## 1단계: 필요한 패키지 확인 및 설치

### 패키지 확인
```bash
npm list @supabase/supabase-js
```

### dotenv 설치 (필요한 경우)
```bash
npm install dotenv
```

또는 개발 의존성으로 설치:
```bash
npm install --save-dev dotenv
```

## 2단계: 환경 변수 설정

### .env 파일 생성 또는 수정

프로젝트 루트에 `.env` 파일이 있는지 확인하고, 없으면 생성:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Service Role Key 찾는 방법:**
1. Supabase Dashboard 접속
2. Settings → API 메뉴
3. `service_role` key 복사 (⚠️ 비밀 키이므로 공유하지 마세요)

## 3단계: 스크립트 실행

### 방법 1: 직접 실행
```bash
node scripts/update-japan-direct.js
```

### 방법 2: npm script로 실행 (선택사항)

`package.json`에 스크립트 추가:
```json
{
  "scripts": {
    "update-japan": "node scripts/update-japan-direct.js"
  }
}
```

그리고 실행:
```bash
npm run update-japan
```

## 4단계: 결과 확인

스크립트가 실행되면 다음과 같은 출력을 볼 수 있습니다:

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

### 에러: "Cannot find module 'dotenv'"
```bash
npm install dotenv
```

### 에러: "SUPABASE_SERVICE_ROLE_KEY must be set"
→ `.env` 파일에 Service Role Key가 제대로 설정되었는지 확인

### 에러: "Failed to update"
→ Supabase Dashboard에서 Service Role Key 권한 확인

## 주의사항

- ⚠️ Service Role Key는 비밀 키입니다. 절대 공유하거나 Git에 커밋하지 마세요
- `.env` 파일은 `.gitignore`에 포함되어 있는지 확인하세요
- 프로덕션 환경에서는 환경 변수를 안전하게 관리하세요
