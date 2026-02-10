# Item Mapping 업데이트 로직 설명

## API 실행 로직: `/api/item-mapping/update-sales-data`

### 현재 동작 방식

#### 1. **데이터 로드 단계**
```
1. item_master 로드 (우선순위 1)
   - is_active = true인 모든 항목
   - 페이지네이션으로 전체 로드

2. item_mapping 로드 (우선순위 2, fallback)
   - 특정 entity의 모든 항목 (is_active 무관)
   - item_master에 없는 item_number만 사용
```

#### 2. **업데이트 조건 체크**
```typescript
// 현재 로직 (app/api/item-mapping/update-sales-data/route.ts:233-234)
if (mapping.fg_classification !== null && 
    mapping.fg_classification !== undefined && 
    mapping.fg_classification !== '') {
  updateData.fg_classification = mapping.fg_classification.trim();
}
```

**의미:**
- ✅ **값이 있으면**: 업데이트 진행
- ❌ **공란이면 (null, undefined, '')**: 업데이트하지 않음 → **기존 값 유지**

#### 3. **업데이트 실행**
```typescript
// item_master인 경우: 모든 엔티티의 sales_data 업데이트
UPDATE sales_data 
SET fg_classification = 'FG'  // item_master의 값
WHERE item_number = 'ABC123'

// item_mapping인 경우: 특정 엔티티만 업데이트
UPDATE sales_data 
SET fg_classification = 'FG'  // item_mapping의 값
WHERE entity = 'Japan' AND item_number = 'ABC123'
```

## 현재 문제점

### 문제 1: 공란 처리
- **현재**: `fg_classification`이 공란이면 업데이트하지 않음
- **결과**: 기존 값이 그대로 유지됨 (예: "NonFG"가 그대로 남음)

### 문제 2: NonFG 기본값
- **표시용**: `app/api/dashboard/data-table/route.ts`에서 `row.fg_classification || 'NonFG'`로 표시
- **실제 DB**: 공란이면 NULL로 유지 (업데이트 안 함)

## 해결 방안

### 옵션 1: 공란도 업데이트 (NULL로 설정)
```typescript
// 공란도 업데이트하도록 변경
if (mapping.fg_classification !== undefined) {
  updateData.fg_classification = mapping.fg_classification?.trim() || null;
}
```

### 옵션 2: 공란이면 "NonFG"로 설정
```typescript
// 공란이면 "NonFG"로 설정
updateData.fg_classification = mapping.fg_classification?.trim() || 'NonFG';
```

### 옵션 3: 현재 로직 유지 (기존 값 유지)
```typescript
// 현재 로직: 공란이면 업데이트하지 않음
if (mapping.fg_classification !== null && 
    mapping.fg_classification !== undefined && 
    mapping.fg_classification !== '') {
  updateData.fg_classification = mapping.fg_classification.trim();
}
```

## 업로드 시 로직 (`/api/upload/process`)

```typescript
// app/api/upload/process/route.ts:635-636
if (itemMapping.fg_classification !== undefined) {
  transformed.fg_classification = itemMapping.fg_classification;
}
```

**의미:**
- `undefined`가 아니면 덮어쓰기
- `null`이나 `''`도 덮어쓰기됨 (기존 값이 사라짐)

## 요약

| 상황 | 현재 동작 | 원하는 동작? |
|------|----------|------------|
| `fg_classification = "FG"` | ✅ 업데이트 | ✅ 업데이트 |
| `fg_classification = ""` (공란) | ❌ 업데이트 안 함 (기존 값 유지) | ? |
| `fg_classification = null` | ❌ 업데이트 안 함 (기존 값 유지) | ? |
| `fg_classification` 없음 | ❌ 업데이트 안 함 (기존 값 유지) | ? |

**질문:**
- 공란이면 어떻게 해야 하나요?
  1. 기존 값 유지 (현재)
  2. NULL로 설정
  3. "NonFG"로 설정
