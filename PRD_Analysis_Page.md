# PRD: Sales Analysis Page (제품별 단가 분석)

## 개요

기존 Sales Dashboard 웹 애플리케이션에 새로운 **"Analysis"** 페이지를 추가합니다. 이 페이지는 제품별 단가 분석과 법인별 주력 제품 분석을 제공하는 인터랙티브 대시보드입니다.

---

## 목표

1. 제품별 법인 간 판매 단가 비교 분석
2. 법인별 주력 제품(Top 10) 매출 분석
3. 두 뷰 간 상호 연동 (드릴다운 기능)
4. 연도별(2024년 vs 2025년) 비교 분석

---

## 페이지 구조

### URL
- `/analysis` 또는 `/dashboard/analysis`

### 네비게이션
- 기존 Dashboard 헤더에 "Analysis" 링크 추가
- 또는 Dashboard 내 탭으로 구현

---

## 기능 요구사항

### View 1: 제품별 단가 분석

#### UI 구성
- **제목**: "제품별 단가 분석"
- **필터**: 제품 선택 드롭다운 (전사 매출 비중 순으로 정렬)
- **차트 영역**: 2개의 Bar Chart (좌: 2024년, 우: 2025년)

#### 차트 세부사항
- **X축**: 법인명 (HQ 제외)
- **Y축**: 평균 판매 단가 (KRW)
- **Tooltip 정보**:
  - 단가: ₩XXX,XXX
  - 수량: XXX대
  - 매출: ₩XXX,XXX

#### 데이터 소스
```sql
SELECT 
    entity,
    year,
    model,
    SUM(quantity) as total_qty,
    SUM(line_amount_mst) as total_amt,
    SUM(line_amount_mst) / NULLIF(SUM(quantity), 0) as avg_price
FROM sales_data
WHERE entity != 'HQ'
  AND year IN (2024, 2025)
  AND model IS NOT NULL
GROUP BY entity, year, model
ORDER BY total_amt DESC;
```

---

### View 2: 법인별 주력 제품 분석

#### UI 구성
- **제목**: "법인별 주력 제품 분석"
- **필터**: 법인 선택 드롭다운
- **가이드 텍스트**: "💡 팁: 그래프 막대를 클릭하면 해당 제품의 단가 분석 화면으로 이동합니다."
- **차트 영역**: 2개의 Horizontal Bar Chart (좌: 2024년, 우: 2025년)

#### 차트 세부사항
- **Y축**: 제품명 (Top 10)
- **X축**: 매출액
- **Tooltip 정보**:
  - 매출: ₩XXX (XX.X%)
  - 수량: XXX대
  - 평균단가: ₩XXX
  - (클릭 시 단가 상세 분석 이동)

#### 드릴다운 기능
- 막대 클릭 시 View 1로 전환
- 해당 제품이 자동 선택됨

#### 데이터 소스
```sql
SELECT 
    entity,
    year,
    model,
    SUM(quantity) as total_qty,
    SUM(line_amount_mst) as total_amt,
    SUM(line_amount_mst) / NULLIF(SUM(quantity), 0) as avg_price,
    SUM(line_amount_mst) * 100.0 / SUM(SUM(line_amount_mst)) OVER (PARTITION BY entity, year) as share_pct
FROM sales_data
WHERE entity != 'HQ'
  AND year IN (2024, 2025)
  AND model IS NOT NULL
GROUP BY entity, year, model
ORDER BY entity, year, total_amt DESC;
-- 각 entity/year별 Top 10만 사용
```

---

## 뷰 전환 기능

### 네비게이션 버튼
- **View 1 → View 2**: "법인별 주력 제품 분석으로 이동 →"
- **View 2 → View 1**: "← 제품별 단가 분석으로 이동"

### 상태 관리
```typescript
const [currentView, setCurrentView] = useState<'product' | 'corp'>('product');
const [selectedModel, setSelectedModel] = useState<string>('');
const [selectedEntity, setSelectedEntity] = useState<string>('');
```

---

## 기술 스택

### 프론트엔드
- **Framework**: Next.js (기존 프로젝트와 동일)
- **차트 라이브러리**: Recharts (기존 사용 중) 또는 Chart.js
- **스타일링**: Tailwind CSS (기존 사용 중)

### 백엔드 API
- `/api/analysis/product-price` - 제품별 단가 데이터
- `/api/analysis/corp-top-products` - 법인별 Top 10 제품 데이터

---

## API 명세

### 1. GET /api/analysis/product-price

#### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| model | string | No | 특정 모델 필터 (없으면 전체) |
| year | string | No | 연도 필터 (기본: 2024,2025) |

#### Response
```json
{
  "success": true,
  "data": {
    "models": ["InBody 970", "InBody 770", ...],  // 매출 비중 순
    "priceData": {
      "InBody 970": {
        "2024": {
          "USA": { "qty": 100, "amt": 50000000, "price": 500000 },
          "Japan": { "qty": 80, "amt": 40000000, "price": 500000 },
          ...
        },
        "2025": { ... }
      },
      ...
    }
  }
}
```

### 2. GET /api/analysis/corp-top-products

#### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| entity | string | No | 특정 법인 필터 (없으면 전체) |
| year | string | No | 연도 필터 (기본: 2024,2025) |
| limit | number | No | Top N (기본: 10) |

#### Response
```json
{
  "success": true,
  "data": {
    "entities": ["USA", "Japan", "Germany", ...],
    "topProducts": {
      "USA": {
        "2024": [
          { "model": "InBody 970", "qty": 100, "amt": 50000000, "price": 500000, "share": 25.5 },
          ...
        ],
        "2025": [ ... ]
      },
      ...
    }
  }
}
```

---

## UI/UX 요구사항

### 레이아웃
```
┌─────────────────────────────────────────────────────────────┐
│  [페이지 제목]                    [뷰 전환 버튼]              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │  필터 영역 (드롭다운)                                 │    │
│  │  [제품 선택 ▼] 또는 [법인 선택 ▼]                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │   2024년 차트         │  │   2025년 차트         │         │
│  │                       │  │                       │         │
│  │   [Bar Chart]         │  │   [Bar Chart]         │         │
│  │                       │  │                       │         │
│  └──────────────────────┘  └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 반응형 디자인
- **Desktop**: 차트 2열 배치
- **Tablet/Mobile**: 차트 1열 배치 (세로 스택)

### 색상 테마
- **2024년 차트**: Blue 계열 (`rgba(52, 152, 219, 0.7)`)
- **2025년 차트**: Red/Purple 계열 (`rgba(231, 76, 60, 0.7)`)
- **View 2 차트**: Green/Purple 계열

### 애니메이션
- 뷰 전환 시 fade-in 효과
- 차트 로딩 시 스켈레톤 UI

---

## 파일 구조

```
app/
├── (dashboard)/
│   ├── analysis/
│   │   └── page.tsx              # 메인 Analysis 페이지
│   └── dashboard/
│       └── [entity]/
│           └── page.tsx          # 기존 대시보드
├── api/
│   └── analysis/
│       ├── product-price/
│       │   └── route.ts          # 제품별 단가 API
│       └── corp-top-products/
│           └── route.ts          # 법인별 Top 10 API
└── components/
    └── analysis/
        ├── ProductPriceView.tsx   # View 1 컴포넌트
        ├── CorpTopProductsView.tsx # View 2 컴포넌트
        ├── PriceChart.tsx         # 단가 차트 컴포넌트
        └── TopProductsChart.tsx   # Top 10 차트 컴포넌트
```

---

## 데이터 요구사항

### 필수 컬럼 (sales_data 테이블)
- `entity`: 법인명
- `year`: 연도
- 'category' : 카테고리리
- `product`: 제품 모델명
- 'fg_classification' : FG 는 제품, NonFG는 제품이 아니므로 무시.
- `quantity`: 판매 수량
- `line_amount_mst`: 매출액 (기준 통화) 

### 매출액 계산 로직
- Group Dashboard 의 Amount(KRW) 와 동일로직 사용

### 데이터 필터링
- HQ 법인 제외 (본사는 분석 대상에서 제외)
- `model`이 NULL인 데이터 제외
- 2024년, 2025년 데이터만 포함

### 정렬 기준
- **View 1 제품 목록**: 전사 총 매출 비중 내림차순
- **View 2 법인 목록**: 알파벳순 또는 총 매출 내림차순
- **View 2 Top 10**: 해당 법인/연도 매출 내림차순

---

## 구현 우선순위

### Phase 1 (MVP)
1. [ ] API 엔드포인트 구현 (`/api/analysis/*`)
2. [ ] Analysis 페이지 기본 레이아웃
3. [ ] View 1: 제품별 단가 분석 차트
4. [ ] View 2: 법인별 Top 10 차트
5. [ ] 뷰 전환 기능

### Phase 2
1. [ ] 드릴다운 기능 (View 2 → View 1)
2. [ ] 반응형 디자인 최적화
3. [ ] 로딩 상태 및 에러 처리
4. [ ] 네비게이션 통합 (메인 메뉴에 추가)

### Phase 3 (선택)
1. [ ] 연도 필터 확장 (2023년 이전 데이터)
2. [ ] 데이터 내보내기 기능 (CSV/Excel)
3. [ ] 추가 분석 지표 (YoY 성장률 등)

---

## 참고: 기존 HTML 코드 구조

첨부된 `SalesPriceRef.txt` 파일은 동일한 기능을 순수 HTML/JavaScript로 구현한 레퍼런스입니다.

### 주요 구현 포인트
1. **Chart.js** 사용 → Recharts로 변환 필요
2. **하드코딩된 데이터** → API 호출로 변경
3. **DOM 조작** → React 상태 관리로 변경
4. **스타일** → Tailwind CSS로 변환

---

## 테스트 체크리스트

- [ ] 제품 선택 시 차트가 올바르게 업데이트되는가
- [ ] 법인 선택 시 차트가 올바르게 업데이트되는가
- [ ] 뷰 전환이 부드럽게 작동하는가
- [ ] 드릴다운 클릭 시 올바른 제품이 선택되는가
- [ ] Tooltip이 올바른 정보를 표시하는가
- [ ] 모바일 뷰에서 레이아웃이 정상적인가
- [ ] 데이터가 없는 경우 적절한 메시지를 표시하는가
- [ ] API 에러 시 적절한 에러 처리가 되는가

---

## 예상 일정

| 작업 | 예상 시간 |
|------|----------|
| API 구현 | 2-3시간 |
| 페이지 레이아웃 | 1-2시간 |
| View 1 차트 | 2-3시간 |
| View 2 차트 | 2-3시간 |
| 뷰 전환 및 드릴다운 | 1-2시간 |
| 테스트 및 버그 수정 | 2-3시간 |
| **합계** | **10-16시간** |
