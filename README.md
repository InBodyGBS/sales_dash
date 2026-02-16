# Sales Dashboard

InBody의 글로벌 16개 법인(HQ, USA, BWA, Vietnam, Healthcare, Korot, Japan, China, India, Mexico, Oceania, Netherlands, Germany, UK, Asia, Europe)의 매출 데이터를 통합하여 시각화하고 분석하는 웹 기반 대시보드입니다.

## 기술 스택

- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18+, Tailwind CSS, shadcn/ui
- **Charts**: Recharts
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Deployment**: Vercel

## 주요 기능

### 데이터 관리
- 📊 **엑셀 파일 업로드**: 드래그 앤 드롭으로 간편한 데이터 업로드
- 🔧 **Column Mapping**: Entity별 컬럼 매핑 저장 및 관리 (Japan 방식)
- 🗺️ **Item Mapping**: 제품별 FG 분류, 카테고리, 모델 매핑
- 💱 **Exchange Rate**: 환율 데이터 관리 및 자동 적용

### 대시보드
- 📈 **Individual Entity Dashboard**: 각 법인별 상세 매출 분석
- 🌐 **InBody Group Dashboard**: 전체 법인 통합 분석 (KRW 기준)
- 🔍 **다차원 필터링**: Entity, Year, Quarter, FG Classification, Category
- 📊 **다양한 차트**: 월별 트렌드, 분기 비교, Top 10 제품, 산업별 분석, FG 분포 등

### 기타
- 🔄 **실시간 동기화**: Materialized View를 통한 빠른 데이터 조회
- 💾 **CSV 내보내기**: 분석 결과 다운로드
- 🌍 **다중 통화 지원**: KRW, USD, JPY, CNH, MXN, INR, AUD, VND, EUR, GBP, MYR, SGD

## 시작하기

### 1. 저장소 클론

```bash
git clone <repository-url>
cd gbs_sales
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_NAME=Sales Dashboard
NEXT_PUBLIC_MAX_FILE_SIZE=104857600
```

### 4. Supabase 데이터베이스 설정

Supabase SQL Editor에서 다음 스키마를 실행하세요:

```sql
-- Sales Data Table
CREATE TABLE sales_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity VARCHAR(50) NOT NULL,
    sale_date DATE NOT NULL,
    year INTEGER NOT NULL,
    quarter VARCHAR(2) NOT NULL,
    category VARCHAR(100),
    product VARCHAR(200) NOT NULL,
    region VARCHAR(100),
    currency VARCHAR(10) NOT NULL,
    sales_amount DECIMAL(15, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    upload_batch_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_entity CHECK (entity IN ('HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Europe')),
    CONSTRAINT valid_quarter CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    CONSTRAINT positive_amount CHECK (sales_amount >= 0),
    CONSTRAINT positive_quantity CHECK (quantity >= 0)
);

-- Upload History Table
CREATE TABLE upload_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL UNIQUE,
    entity VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    rows_uploaded INTEGER,
    status VARCHAR(20),
    error_message TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sales_entity ON sales_data(entity);
CREATE INDEX idx_sales_year ON sales_data(year);
CREATE INDEX idx_sales_quarter ON sales_data(quarter);
CREATE INDEX idx_sales_date ON sales_data(sale_date);
CREATE INDEX idx_sales_category ON sales_data(category);
CREATE INDEX idx_sales_product ON sales_data(product);
```

### 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 프로젝트 구조

```
sales-dashboard/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   ├── [entity]/         # Individual Entity Dashboard
│   │   │   │   └── page.tsx
│   │   │   ├── group/            # InBody Group Dashboard
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx          # Dashboard Selection
│   │   ├── upload/               # File Upload
│   │   │   └── page.tsx
│   │   ├── master-mapping/       # Item Mapping & Exchange Rate
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── upload/               # Upload Processing
│   │   ├── dashboard/            # Dashboard APIs
│   │   │   ├── inbody-group/    # Group Dashboard APIs
│   │   │   └── [other APIs]
│   │   ├── entities/
│   │   ├── exchange-rate/
│   │   └── item-mapping/
│   ├── layout.tsx
│   └── page.tsx                  # Landing Page
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── charts/                   # Recharts components
│   ├── dashboard/                # Dashboard components
│   └── upload/                   # Upload components
├── lib/
│   ├── supabase/                 # Supabase client
│   ├── utils/                    # Utility functions
│   └── types/                    # TypeScript types
├── database/                     # SQL scripts
│   ├── create-inbody-group-functions.sql
│   ├── create-dashboard-functions.sql
│   └── add-new-entities-2026.sql
└── public/
```

## 엑셀 파일 형식

### 업로드 방식

1. **고정 매핑 방식** (HQ, USA, BWA, Vietnam, Healthcare, Korot)
   - 사전 정의된 컬럼 매핑 사용
   - 표준 Excel 템플릿 필요

2. **동적 매핑 방식** (Japan, China, India, Mexico, Oceania, Netherlands, Germany, UK, Asia, Europe)
   - 업로드 시 컬럼 매핑 설정
   - Entity별 독립적인 매핑 저장
   - 유연한 Excel 형식 지원

### 필수 컬럼 (매핑 필요)

- **Invoice Date**: 송장 날짜
- **Product / Item Number**: 제품명 또는 품목 번호
- **Quantity**: 수량
- **Line Amount_MST**: 금액 (Master Currency 기준)
- **Currency**: 통화 코드 (KRW, USD, EUR 등)

### 선택 컬럼

- **Category**: 제품 카테고리
- **FG Classification**: FG/NonFG 분류
- **Customer Name**: 고객명
- **Invoice**: 송장 번호
- **Group**: 그룹 정보
- 기타 필요한 모든 컬럼

## 새로운 Entity 추가

새로운 법인을 추가하려면 다음 단계를 따르세요:

1. **TypeScript 타입 업데이트** (`lib/types/sales.ts`)
   ```typescript
   export type Entity = 'HQ' | 'USA' | ... | 'NewEntity';
   ```

2. **데이터베이스 제약 조건 업데이트**
   - `sales_data`, `item_mapping`, `column_mapping` 테이블의 CHECK 제약 조건
   - `database/add-new-entities-2026.sql` 참고

3. **통화 및 환율 설정**
   - `entity_currency` 테이블에 법인별 통화 매핑
   - `exchange_rate` 테이블에 환율 데이터

4. **프론트엔드 업데이트**
   - Upload 페이지의 entity 드롭다운
   - Dashboard의 ENTITIES 배열
   - Master Mapping 페이지의 entity 리스트

5. **Materialized View Refresh**
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_cube;
   ```

상세한 가이드는 `database/README-new-entities-2026.md`를 참조하세요.

## 배포

### Vercel 배포

1. GitHub 저장소를 Vercel에 연결
2. 환경 변수 설정
3. 자동 배포 완료

자세한 내용은 [Vercel 문서](https://vercel.com/docs)를 참조하세요.

## 데이터베이스 함수

### InBody Group Dashboard 함수
- `get_inbody_group_summary`: 전체 요약 통계 (KRW 기준)
- `get_inbody_group_monthly_trend`: 월별 트렌드
- `get_inbody_group_quarterly`: 분기별 비교
- `get_inbody_group_entity_sales`: 법인별 매출
- `get_inbody_group_top_products`: Top 10 제품
- `get_inbody_group_industry`: 산업별 분석
- `get_inbody_group_fg_distribution`: FG 분포

### Individual Entity Dashboard 함수
- `get_dashboard_summary`: Entity별 요약 통계
- `get_monthly_trend`: 월별 트렌드
- `get_quarterly_comparison`: 분기별 비교
- `get_channel_sales`: 채널별 매출

모든 SQL 함수는 `database/` 폴더에 정의되어 있습니다.

## 라이선스

이 프로젝트는 InBody Co., Ltd.의 내부 프로젝트입니다.
