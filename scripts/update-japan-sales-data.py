"""
Japan Entity Item Mapping 업데이트 스크립트 (Python)

사용법:
1. pip install supabase python-dotenv
2. 환경 변수 설정: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
3. python scripts/update-japan-sales-data.py
"""

import os
import time
from typing import Dict, List, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BATCH_SIZE = 1000
DELAY_MS = 0.1  # 초 단위


def get_item_master_mappings() -> Dict[str, Dict]:
    """item_master에서 매핑 가져오기"""
    print("📥 Loading item_master mappings...")
    
    response = supabase.table("item_master").select(
        "item_number, fg_classification, category, model, product"
    ).eq("is_active", True).execute()
    
    mapping = {}
    for item in response.data:
        if item.get("item_number"):
            key = item["item_number"].strip()
            mapping[key] = {
                "fg_classification": item.get("fg_classification", "").strip() or None,
                "category": item.get("category", "").strip() or None,
                "model": item.get("model", "").strip() or None,
                "product": item.get("product", "").strip() or None,
                "source": "item_master"
            }
    
    print(f"✅ Loaded {len(mapping)} item_master mappings")
    return mapping


def get_item_mapping_mappings(master_mappings: Dict[str, Dict]) -> Dict[str, Dict]:
    """item_mapping에서 매핑 가져오기 (Japan만, master에 없는 것만)"""
    print("📥 Loading item_mapping mappings for Japan...")
    
    response = supabase.table("item_mapping").select(
        "item_number, fg_classification, category, model, product"
    ).eq("entity", "Japan").eq("is_active", True).execute()
    
    mapping = {}
    for item in response.data:
        if item.get("item_number"):
            key = item["item_number"].strip()
            # item_master에 없는 경우만 추가
            if key not in master_mappings:
                mapping[key] = {
                    "fg_classification": item.get("fg_classification", "").strip() or None,
                    "category": item.get("category", "").strip() or None,
                    "model": item.get("model", "").strip() or None,
                    "product": item.get("product", "").strip() or None,
                    "source": "item_mapping"
                }
    
    print(f"✅ Loaded {len(mapping)} item_mapping mappings (not in master)")
    return mapping


def get_japan_sales_data(page: int = 0, page_size: int = 1000) -> tuple:
    """Japan sales_data 레코드 가져오기 (페이지네이션)"""
    from_range = page * page_size
    to_range = from_range + page_size - 1
    
    response = supabase.table("sales_data").select(
        "id, item_number, fg_classification, category, model, product",
        count="exact"
    ).eq("entity", "Japan").not_.is_("item_number", "null").range(
        from_range, to_range
    ).execute()
    
    total = response.count if hasattr(response, 'count') else len(response.data)
    has_more = total > to_range + 1
    
    return response.data or [], has_more, total


def update_batch(updates: List[Dict]) -> int:
    """배치 업데이트"""
    if not updates:
        return 0
    
    try:
        supabase.table("sales_data").upsert(updates).execute()
        return len(updates)
    except Exception as e:
        print(f"❌ Batch update error: {e}")
        raise


def update_japan_sales_data():
    """메인 업데이트 함수"""
    try:
        print("🚀 Starting Japan sales_data update...\n")
        
        # 1. 매핑 데이터 로드
        master_mappings = get_item_master_mappings()
        mapping_mappings = get_item_mapping_mappings(master_mappings)
        all_mappings = {**master_mappings, **mapping_mappings}
        
        if not all_mappings:
            print("⚠️ No mappings found. Exiting.")
            return
        
        # 2. sales_data 가져오기 및 업데이트
        page = 0
        total_updated = 0
        total_processed = 0
        
        while True:
            records, has_more, total = get_japan_sales_data(page)
            
            if not records:
                break
            
            print(f"\n📄 Processing page {page + 1} ({len(records)} records, total: {total})")
            
            # 업데이트할 레코드 준비
            updates = []
            batch_updated = 0
            
            for record in records:
                item_number = record.get("item_number", "").strip()
                if not item_number:
                    continue
                
                mapping = all_mappings.get(item_number)
                if not mapping:
                    continue
                
                update_data = {
                    "id": record["id"],
                    "fg_classification": mapping.get("fg_classification") or record.get("fg_classification"),
                    "category": mapping.get("category") or record.get("category"),
                    "model": mapping.get("model") or record.get("model"),
                    "product": mapping.get("product") or record.get("product")
                }
                
                # 변경사항이 있는지 확인
                has_changes = (
                    update_data["fg_classification"] != record.get("fg_classification") or
                    update_data["category"] != record.get("category") or
                    update_data["model"] != record.get("model") or
                    update_data["product"] != record.get("product")
                )
                
                if has_changes:
                    updates.append(update_data)
                    batch_updated += 1
            
            # 배치 업데이트
            if updates:
                for i in range(0, len(updates), BATCH_SIZE):
                    batch = updates[i:i + BATCH_SIZE]
                    update_batch(batch)
                    total_updated += len(batch)
                    
                    if i + BATCH_SIZE < len(updates):
                        time.sleep(DELAY_MS)
                
                print(f"   ✅ Updated {batch_updated} records")
            else:
                print(f"   ⏭️  No updates needed for this page")
            
            total_processed += len(records)
            
            if not has_more:
                break
            
            page += 1
            time.sleep(DELAY_MS)
        
        print(f"\n✅ Update completed!")
        print(f"   Total processed: {total_processed} records")
        print(f"   Total updated: {total_updated} records")
        
    except Exception as e:
        print(f"\n❌ Update failed: {e}")
        raise


if __name__ == "__main__":
    try:
        update_japan_sales_data()
        print("\n🎉 Done!")
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        exit(1)
