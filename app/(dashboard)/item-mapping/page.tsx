'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Entity } from '@/lib/types/sales';
import { useDropzone } from 'react-dropzone';
import { Upload, Download, Trash2, Edit2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

interface ItemMapping {
  id?: string;
  entity: string;
  item_number: string;
  fg_classification: string | null;
  category: string | null;
  model: string | null;
  product: string | null;
  is_active: boolean;
}

const ENTITIES_REQUIRING_MAPPING: Entity[] = ['Japan', 'China', 'India', 'Mexico', 'Oceania'];

export default function ItemMappingPage() {
  const [useMaster, setUseMaster] = useState(true); // Use item_master by default
  const [entity, setEntity] = useState<Entity>('Japan');
  const [mappings, setMappings] = useState<ItemMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ItemMapping>>({});
  const [deletingAll, setDeletingAll] = useState(false);
  const [updatingSalesData, setUpdatingSalesData] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const fetchMappings = useCallback(async () => {
    try {
      setLoading(true);
      
      if (useMaster) {
        // Use item_master (no entity needed)
        const response = await fetch('/api/item-master');
        if (!response.ok) {
          throw new Error('Failed to fetch item master mappings');
        }
        const data = await response.json();
        setMappings(data.mappings || []);
      } else {
        // Use entity-specific item_mapping
        if (!ENTITIES_REQUIRING_MAPPING.includes(entity)) {
          setMappings([]);
          return;
        }
        const response = await fetch(`/api/item-mapping?entity=${entity}`);
        if (!response.ok) {
          throw new Error('Failed to fetch item mappings');
        }
        const data = await response.json();
        setMappings(data.mappings || []);
      }
    } catch (error) {
      console.error('Failed to fetch item mappings:', error);
      toast.error('Item mapping 데이터를 불러오는데 실패했습니다');
      setMappings([]);
    } finally {
      setLoading(false);
    }
  }, [useMaster, entity]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  // Fetch available years
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const entityParam = useMaster ? null : entity;
        const url = entityParam ? `/api/years?entity=${entityParam}` : '/api/years';
        console.log('Item Mapping - Fetching years from:', url, 'entityParam:', entityParam);
        const res = await fetch(url);
        const data = await res.json();
        const years = data.years || [];
        console.log('Item Mapping - Fetched years:', years, 'for entity:', entityParam);
        setAvailableYears(years);
        // Set default year to latest year if available
        if (years.length > 0 && !year) {
          setYear(years[0]);
        }
      } catch (error) {
        console.error('Failed to fetch years:', error);
        setAvailableYears([]);
      }
    };

    fetchYears();
  }, [entity, useMaster]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Excel 파일만 업로드 가능합니다 (.xlsx, .xls)');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      
      // 1. Supabase Storage에 파일 업로드
      const timestamp = new Date().getTime();
      const folder = useMaster ? 'item-master' : 'item-mapping';
      
      // 파일명을 URL-safe하게 인코딩 (특수 문자 처리)
      // Supabase Storage는 파일 경로에 특수 문자를 허용하지 않으므로 인코딩 필요
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
      
      // 한자, 일본어 등 특수 문자를 base64로 인코딩 (더 안전함)
      // 또는 간단하게 타임스탬프만 사용
      const safeFileName = `${timestamp}${fileExtension}`;
      const storagePath = `${folder}/${safeFileName}`;

      toast.loading('파일 업로드 중...', { id: 'upload' });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sales-files')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        // Check if bucket doesn't exist
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist')) {
          throw new Error(
            `Storage 버킷 'sales-files'가 존재하지 않습니다.\n\n` +
            `Supabase Dashboard에서 Storage 버킷을 생성해주세요:\n` +
            `1. Supabase Dashboard → Storage 메뉴\n` +
            `2. "New bucket" 클릭\n` +
            `3. Name: sales-files, Public: No, File size limit: 100MB\n` +
            `4. Policies 설정 (SUPABASE_STORAGE_SETUP.md 참고)`
          );
        }
        throw new Error(`파일 업로드 실패: ${uploadError.message}`);
      }

      toast.loading('파일 처리 중...', { id: 'upload' });

      // 2. 처리 API 호출
      const endpoint = useMaster ? '/api/item-master/process' : '/api/item-mapping/process';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storagePath: uploadData.path,
          fileName: file.name,
          entity: useMaster ? null : entity,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorDetails = '';
        let errorData: any = null;
        
        try {
          errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          
          // Handle details - could be string or object
          if (errorData.details) {
            if (typeof errorData.details === 'string') {
              errorDetails = errorData.details;
            } else if (typeof errorData.details === 'object') {
              errorDetails = JSON.stringify(errorData.details, null, 2);
            } else {
              errorDetails = String(errorData.details);
            }
          }
        } catch (e) {
          // If response is not JSON, use status text
          const text = await response.text();
          if (text) {
            errorMessage = text.substring(0, 200); // Limit error message length
          }
        }
        
        // Ensure errorDetails is always a string
        let detailsString = '';
        if (errorDetails) {
          if (typeof errorDetails === 'string') {
            detailsString = errorDetails;
          } else {
            detailsString = JSON.stringify(errorDetails, null, 2);
          }
        }
        
        // Also check errorData.details directly if errorDetails is empty
        if (!detailsString && errorData?.details) {
          if (typeof errorData.details === 'string') {
            detailsString = errorData.details;
          } else {
            detailsString = JSON.stringify(errorData.details, null, 2);
          }
        }
        
        const fullError = detailsString ? `${errorMessage}\n\nDetails: ${detailsString}` : errorMessage;
        console.error('API Error:', { 
          status: response.status, 
          message: errorMessage, 
          details: detailsString,
          rawDetails: errorDetails,
          fullErrorData: errorData 
        });
        throw new Error(fullError);
      }

      const data = await response.json();

      // Show success message with skipped items info
      let successMessage = `성공적으로 ${data.count || 0}개의 Item Mapping을 업로드했습니다`;
      if (data.skipped) {
        const skippedParts: string[] = [];
        if (data.skipped.fileDuplicates > 0) {
          skippedParts.push(`파일 내 중복 ${data.skipped.fileDuplicates}개`);
        }
        if (data.skipped.masterConflicts > 0) {
          skippedParts.push(`item_master 충돌 ${data.skipped.masterConflicts}개`);
        }
        if (skippedParts.length > 0) {
          successMessage += ` (${skippedParts.join(', ')} 건너뜀)`;
        }
      }
      
      toast.success(successMessage, { id: 'upload', duration: 5000 });
      
      // Log skipped items details for debugging (only in development)
      if (process.env.NODE_ENV === 'development' && data.skipped && (data.skipped.fileDuplicates > 0 || data.skipped.masterConflicts > 0)) {
        console.log('Skipped items:', {
          fileDuplicates: data.skipped.fileDuplicates,
          masterConflicts: data.skipped.masterConflicts,
          fileDuplicateDetails: data.skipped.fileDuplicateDetails,
          masterConflictItems: data.skipped.masterConflictItems,
        });
      }
      
      fetchMappings();
    } catch (error) {
      console.error('Failed to upload item mapping:', error);
      toast.error((error as Error).message || 'Item Mapping 파일 업로드에 실패했습니다', { id: 'upload' });
    } finally {
      setUploading(false);
    }
  }, [useMaster, entity, fetchMappings]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    disabled: uploading || !ENTITIES_REQUIRING_MAPPING.includes(entity),
  });

  const handleEdit = (mapping: ItemMapping) => {
    setEditingId(mapping.id || '');
    setEditForm({
      item_number: mapping.item_number,
      fg_classification: mapping.fg_classification || '',
      category: mapping.category || '',
      model: mapping.model || '',
      product: mapping.product || '',
    });
  };

  const handleSave = async (id: string) => {
    try {
      const endpoint = useMaster ? '/api/item-master' : '/api/item-mapping';
      const body = useMaster
        ? {
            mappings: [{
              item_number: editForm.item_number,
              fg_classification: editForm.fg_classification || null,
              category: editForm.category || null,
              model: editForm.model || null,
              product: editForm.product || null,
            }],
          }
        : {
            entity,
            mappings: [{
              item_number: editForm.item_number,
              fg_classification: editForm.fg_classification || null,
              category: editForm.category || null,
              model: editForm.model || null,
              product: editForm.product || null,
            }],
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save item mapping');
      }

      toast.success('Item Mapping이 저장되었습니다');
      setEditingId(null);
      setEditForm({});
      fetchMappings();
    } catch (error) {
      console.error('Failed to save item mapping:', error);
      toast.error((error as Error).message || 'Item Mapping 저장에 실패했습니다');
    }
  };

  const handleDelete = async (id: string, itemNumber: string) => {
    if (!confirm(`정말 "${itemNumber}" Item Mapping을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      if (useMaster) {
        // Delete from item_master
        const response = await fetch(`/api/item-master?item_number=${itemNumber}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete item master mapping');
        }
      } else {
        // Deactivate from item_mapping
        const response = await fetch('/api/item-mapping', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity,
            mappings: mappings
              .filter(m => m.id !== id)
              .map(m => ({
                item_number: m.item_number,
                fg_classification: m.fg_classification,
                category: m.category,
                model: m.model,
                product: m.product,
              })),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to delete item mapping');
        }
      }

      toast.success('Item Mapping이 삭제되었습니다');
      fetchMappings();
    } catch (error) {
      console.error('Failed to delete item mapping:', error);
      toast.error('Item Mapping 삭제에 실패했습니다');
    }
  };

  const handleUpdateSalesData = async () => {
    const targetName = useMaster 
      ? 'Master Item Mapping (모든 엔티티)' 
      : `${entity} 엔티티의 Item Mapping`;
    
    const yearText = year ? ` (${year}년)` : ' (전체 연도)';
    
    if (!useMaster && !ENTITIES_REQUIRING_MAPPING.includes(entity)) {
      toast.error('이 엔티티는 Item Mapping을 사용하지 않습니다');
      return;
    }

    setUpdatingSalesData(true);
    try {
      const response = await fetch('/api/item-mapping/update-sales-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          entity: useMaster ? null : entity,
          useMaster: useMaster,
          year: year || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to update sales_data');
      }

      const data = await response.json();
      toast.success(`${targetName}${yearText}이(가) sales_data에 반영되었습니다 (${data.updatedCount}개 레코드 업데이트)`);
    } catch (error) {
      console.error('Failed to update sales_data:', error);
      toast.error((error as Error).message || 'Sales Data 업데이트에 실패했습니다');
    } finally {
      setUpdatingSalesData(false);
    }
  };

  const handleDeleteAll = async () => {
    const targetName = useMaster 
      ? '모든 Master Item Mapping' 
      : `${entity} 엔티티의 모든 Item Mapping`;

    setDeletingAll(true);
    try {
      // First, get the actual total count from the database using count query
      let totalCount = 0;
      if (useMaster) {
        // Use a count query to get the actual total (not limited by pagination)
        const supabase = createClient();
        const { count, error: countError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        
        if (!countError && count !== null) {
          totalCount = count;
        } else {
          // Fallback: try to get from API (may be limited)
          const countResponse = await fetch('/api/item-master');
          if (countResponse.ok) {
            const countData = await countResponse.json();
            totalCount = countData.mappings?.length || 0;
          }
        }
      } else {
        // Use a count query to get the actual total (not limited by pagination)
        const supabase = createClient();
        const { count, error: countError } = await supabase
          .from('item_mapping')
          .select('*', { count: 'exact', head: true })
          .eq('entity', entity)
          .eq('is_active', true);
        
        if (!countError && count !== null) {
          totalCount = count;
        } else {
          // Fallback: try to get from API (may be limited)
          const countResponse = await fetch(`/api/item-mapping?entity=${entity}`);
          if (countResponse.ok) {
            const countData = await countResponse.json();
            totalCount = countData.mappings?.length || 0;
          }
        }
      }

      // Show confirmation with actual total count
      if (!confirm(`정말 ${targetName} (전체 ${totalCount}개)을 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        setDeletingAll(false);
        return;
      }

      if (useMaster) {
        // Delete all from item_master
        const response = await fetch('/api/item-master?all=true', {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.details || 'Failed to delete all item master mappings');
        }

        const data = await response.json();
        toast.success(`${targetName} (${data.count || totalCount}개)이 모두 삭제되었습니다`);
      } else {
        // Delete all from item_mapping for this entity
        const response = await fetch(`/api/item-mapping?entity=${entity}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.details || 'Failed to delete all item mappings');
        }

        const data = await response.json();
        toast.success(`${targetName} (${data.count || totalCount}개)이 모두 삭제되었습니다`);
      }

      fetchMappings();
    } catch (error) {
      console.error('Failed to delete all item mappings:', error);
      toast.error((error as Error).message || '전체 삭제에 실패했습니다');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleExport = () => {
    const headers = ['item_number', 'fg_classification', 'category', 'model', 'product'];
    const csvContent = [
      headers.join(','),
      ...mappings.map(m => [
        m.item_number,
        m.fg_classification || '',
        m.category || '',
        m.model || '',
        m.product || '',
      ].map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `item_mapping_${entity}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Item Mapping 관리</h1>
        <p className="text-muted-foreground mt-2">
          Item Number를 기준으로 fg_classification, category, model, product를 매핑합니다
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Excel 파일 업로드</CardTitle>
            <CardDescription>
              Excel 파일로 Item Mapping 데이터를 일괄 업로드합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mapping-type">Mapping 타입</Label>
              <Select
                value={useMaster ? 'master' : 'entity'}
                onValueChange={(value) => {
                  setUseMaster(value === 'master');
                  if (value === 'entity' && !entity) {
                    setEntity('Japan');
                  }
                }}
              >
                <SelectTrigger id="mapping-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">Master (모든 Entity 공통)</SelectItem>
                  <SelectItem value="entity">Entity별 (D365 이외 법인)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!useMaster && (
              <div className="space-y-2">
                <Label htmlFor="mapping-entity">Entity 선택</Label>
                <Select
                  value={entity}
                  onValueChange={(value) => setEntity(value as Entity)}
                >
                  <SelectTrigger id="mapping-entity">
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITIES_REQUIRING_MAPPING.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              } ${uploading || (!useMaster && !ENTITIES_REQUIRING_MAPPING.includes(entity)) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {uploading ? (
                <p className="text-sm text-muted-foreground">업로드 중...</p>
              ) : isDragActive ? (
                <p className="text-sm text-primary">파일을 여기에 놓으세요</p>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Excel 파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    필수 컬럼: item_number, fg_classification, category, model, product
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mapping List */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div>
                <CardTitle className="text-2xl">Item Mapping 목록</CardTitle>
                <CardDescription className="mt-1">
                  {useMaster ? 'Master Item Mapping 데이터 (모든 Entity 공통)' : `${entity} 엔티티의 Item Mapping 데이터`}
                </CardDescription>
              </div>
              
              {mappings.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="update-year" className="text-sm font-medium whitespace-nowrap">
                      업데이트 연도:
                    </Label>
                    <Select
                      value={year?.toString() || 'all'}
                      onValueChange={(value) => {
                        setYear(value === 'all' ? null : parseInt(value));
                      }}
                    >
                      <SelectTrigger id="update-year" className="w-[140px]">
                        <SelectValue placeholder="연도 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 연도</SelectItem>
                        {availableYears.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}년
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-auto">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleUpdateSalesData}
                      disabled={updatingSalesData || loading}
                      className="min-w-[160px]"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {updatingSalesData ? '업데이트 중...' : 'Sales Data 업데이트'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleDeleteAll}
                      disabled={deletingAll || loading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingAll ? '삭제 중...' : '전체 삭제'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : mappings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Item Mapping 데이터가 없습니다.
                <br />
                Excel 파일을 업로드하여 데이터를 추가하세요.
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {mappings.map((mapping) => {
                  const isEditing = editingId === mapping.id;
                  
                  return (
                    <div
                      key={mapping.id || mapping.item_number}
                      className="p-3 border rounded hover:bg-muted/50 transition-colors"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Item Number</Label>
                              <Input
                                value={editForm.item_number || ''}
                                onChange={(e) => setEditForm({ ...editForm, item_number: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">FG Classification</Label>
                              <Input
                                value={editForm.fg_classification || ''}
                                onChange={(e) => setEditForm({ ...editForm, fg_classification: e.target.value })}
                                className="h-8 text-sm"
                                placeholder="FG/NonFG"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Category</Label>
                              <Input
                                value={editForm.category || ''}
                                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Model</Label>
                              <Input
                                value={editForm.model || ''}
                                onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Product</Label>
                              <Input
                                value={editForm.product || ''}
                                onChange={(e) => setEditForm({ ...editForm, product: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(mapping.id!)}
                              className="h-7"
                            >
                              <Save className="h-3 w-3 mr-1" />
                              저장
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditForm({});
                              }}
                              className="h-7"
                            >
                              <X className="h-3 w-3 mr-1" />
                              취소
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="font-medium text-sm">{mapping.item_number}</div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <div>FG: {mapping.fg_classification || '-'}</div>
                              <div>Category: {mapping.category || '-'}</div>
                              <div>Model: {mapping.model || '-'}</div>
                              <div>Product: {mapping.product || '-'}</div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEdit(mapping)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(mapping.id!, mapping.item_number)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

