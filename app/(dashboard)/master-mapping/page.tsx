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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Entity } from '@/lib/types/sales';
import { useDropzone } from 'react-dropzone';
import { Upload, Download, Trash2, Edit2, Save, X, Plus } from 'lucide-react';
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

interface ExchangeRate {
  id?: number;
  year: number;
  currency: string;
  rate: number;
}

const ENTITIES_REQUIRING_MAPPING: Entity[] = ['Japan', 'China', 'India', 'Mexico', 'Oceania', 'Netherlands', 'Germany', 'UK', 'Asia', 'Singapore'];
const CURRENCIES = ['USD', 'JPY', 'CNH', 'CNY', 'MXN', 'VND', 'INR', 'AUD', 'EUR', 'GBP', 'MYR', 'SGD', 'TRY', 'KRW'];

export default function MasterMappingPage() {
  const [activeTab, setActiveTab] = useState('item-mapping');
  
  // ==================== Item Mapping States ====================
  const [useMaster, setUseMaster] = useState(true);
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

  // ==================== Exchange Rate States ====================
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [exchangeUploading, setExchangeUploading] = useState(false);
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [editRateForm, setEditRateForm] = useState<Partial<ExchangeRate>>({});
  const [newRateForm, setNewRateForm] = useState<Partial<ExchangeRate>>({ year: new Date().getFullYear(), currency: 'USD', rate: 0 });
  const [showAddRate, setShowAddRate] = useState(false);
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');

  // ==================== Item Mapping Functions ====================
  const fetchMappings = useCallback(async () => {
    try {
      setLoading(true);
      
      if (useMaster) {
        const response = await fetch('/api/item-master');
        if (!response.ok) throw new Error('Failed to fetch item master mappings');
        const data = await response.json();
        setMappings(data.mappings || []);
      } else {
        if (!ENTITIES_REQUIRING_MAPPING.includes(entity)) {
          setMappings([]);
          return;
        }
        const response = await fetch(`/api/item-mapping?entity=${entity}`);
        if (!response.ok) throw new Error('Failed to fetch item mappings');
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
    if (activeTab === 'item-mapping') {
      fetchMappings();
    }
  }, [fetchMappings, activeTab]);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const entityParam = useMaster ? null : entity;
        const url = entityParam ? `/api/years?entity=${entityParam}` : '/api/years';
        const res = await fetch(url);
        const data = await res.json();
        const years = data.years || [];
        setAvailableYears(years);
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

  const onDropItemMapping = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Excel 파일만 업로드 가능합니다 (.xlsx, .xls)');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const timestamp = new Date().getTime();
      const folder = useMaster ? 'item-master' : 'item-mapping';
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      const safeFileName = `${timestamp}${fileExtension}`;
      const storagePath = `${folder}/${safeFileName}`;

      toast.loading('파일 업로드 중...', { id: 'upload' });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sales-files')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist')) {
          throw new Error(`Storage 버킷 'sales-files'가 존재하지 않습니다.`);
        }
        throw new Error(`파일 업로드 실패: ${uploadError.message}`);
      }

      toast.loading('파일 처리 중...', { id: 'upload' });

      const endpoint = useMaster ? '/api/item-master/process' : '/api/item-mapping/process';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: uploadData.path, fileName: file.name, entity: useMaster ? null : entity }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Processing failed');
      }

      const data = await response.json();
      let successMessage = `성공적으로 ${data.count || 0}개의 Item Mapping을 업로드했습니다`;
      if (data.skipped) {
        const skippedParts: string[] = [];
        if (data.skipped.fileDuplicates > 0) skippedParts.push(`파일 내 중복 ${data.skipped.fileDuplicates}개`);
        if (data.skipped.masterConflicts > 0) skippedParts.push(`item_master 충돌 ${data.skipped.masterConflicts}개`);
        if (skippedParts.length > 0) successMessage += ` (${skippedParts.join(', ')} 건너뜀)`;
      }
      toast.success(successMessage, { id: 'upload', duration: 5000 });
      fetchMappings();
    } catch (error) {
      console.error('Failed to upload item mapping:', error);
      toast.error((error as Error).message || 'Item Mapping 파일 업로드에 실패했습니다', { id: 'upload' });
    } finally {
      setUploading(false);
    }
  }, [useMaster, entity, fetchMappings]);

  const { getRootProps: getItemRootProps, getInputProps: getItemInputProps, isDragActive: isItemDragActive } = useDropzone({
    onDrop: onDropItemMapping,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    disabled: uploading || (!useMaster && !ENTITIES_REQUIRING_MAPPING.includes(entity)),
  });

  const handleEditItem = (mapping: ItemMapping) => {
    setEditingId(mapping.id || '');
    setEditForm({
      item_number: mapping.item_number,
      fg_classification: mapping.fg_classification || '',
      category: mapping.category || '',
      model: mapping.model || '',
      product: mapping.product || '',
    });
  };

  const handleSaveItem = async (id: string) => {
    try {
      const endpoint = useMaster ? '/api/item-master' : '/api/item-mapping';
      const body = useMaster
        ? { mappings: [{ item_number: editForm.item_number, fg_classification: editForm.fg_classification || null, category: editForm.category || null, model: editForm.model || null, product: editForm.product || null }] }
        : { entity, mappings: [{ item_number: editForm.item_number, fg_classification: editForm.fg_classification || null, category: editForm.category || null, model: editForm.model || null, product: editForm.product || null }] };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
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

  const handleDeleteItem = async (id: string, itemNumber: string) => {
    if (!confirm(`정말 "${itemNumber}" Item Mapping을 삭제하시겠습니까?`)) return;

    try {
      if (useMaster) {
        const response = await fetch(`/api/item-master?item_number=${itemNumber}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete item master mapping');
      } else {
        const response = await fetch('/api/item-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity,
            mappings: mappings.filter(m => m.id !== id).map(m => ({
              item_number: m.item_number,
              fg_classification: m.fg_classification,
              category: m.category,
              model: m.model,
              product: m.product,
            })),
          }),
        });
        if (!response.ok) throw new Error('Failed to delete item mapping');
      }
      toast.success('Item Mapping이 삭제되었습니다');
      fetchMappings();
    } catch (error) {
      console.error('Failed to delete item mapping:', error);
      toast.error('Item Mapping 삭제에 실패했습니다');
    }
  };

  const handleUpdateSalesData = async () => {
    const targetName = useMaster ? 'Master Item Mapping (모든 엔티티)' : `${entity} 엔티티의 Item Mapping`;
    const yearText = year ? ` (${year}년)` : ' (전체 연도)';
    
    if (!useMaster && !ENTITIES_REQUIRING_MAPPING.includes(entity)) {
      toast.error('이 엔티티는 Item Mapping을 사용하지 않습니다');
      return;
    }

    setUpdatingSalesData(true);
    try {
      const response = await fetch('/api/item-mapping/update-sales-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: useMaster ? null : entity, useMaster: useMaster, year: year || undefined }),
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

  const handleDeleteAllItems = async () => {
    const targetName = useMaster ? '모든 Master Item Mapping' : `${entity} 엔티티의 모든 Item Mapping`;

    setDeletingAll(true);
    try {
      const supabase = createClient();
      let totalCount = 0;
      
      if (useMaster) {
        const { count } = await supabase.from('item_master').select('*', { count: 'exact', head: true }).eq('is_active', true);
        totalCount = count || 0;
      } else {
        const { count } = await supabase.from('item_mapping').select('*', { count: 'exact', head: true }).eq('entity', entity).eq('is_active', true);
        totalCount = count || 0;
      }

      if (!confirm(`정말 ${targetName} (전체 ${totalCount}개)을 모두 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        setDeletingAll(false);
        return;
      }

      const endpoint = useMaster ? '/api/item-master?all=true' : `/api/item-mapping?entity=${entity}`;
      const response = await fetch(endpoint, { method: 'DELETE' });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete all mappings');
      }

      const data = await response.json();
      toast.success(`${targetName} (${data.count || totalCount}개)이 모두 삭제되었습니다`);
      fetchMappings();
    } catch (error) {
      console.error('Failed to delete all item mappings:', error);
      toast.error((error as Error).message || '전체 삭제에 실패했습니다');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleExportItems = () => {
    const headers = ['item_number', 'fg_classification', 'category', 'model', 'product'];
    const csvContent = [
      headers.join(','),
      ...mappings.map(m => [m.item_number, m.fg_classification || '', m.category || '', m.model || '', m.product || ''].map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `item_mapping_${useMaster ? 'master' : entity}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==================== Exchange Rate Functions ====================
  const fetchExchangeRates = useCallback(async () => {
    try {
      setExchangeLoading(true);
      const response = await fetch('/api/exchange-rate');
      if (!response.ok) throw new Error('Failed to fetch exchange rates');
      const data = await response.json();
      setExchangeRates(data.rates || []);
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      toast.error('Exchange Rate 데이터를 불러오는데 실패했습니다');
      setExchangeRates([]);
    } finally {
      setExchangeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'exchange-rate') {
      fetchExchangeRates();
    }
  }, [fetchExchangeRates, activeTab]);

  const onDropExchangeRate = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Excel 파일만 업로드 가능합니다 (.xlsx, .xls)');
      return;
    }

    setExchangeUploading(true);
    try {
      const supabase = createClient();
      const timestamp = new Date().getTime();
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      const safeFileName = `${timestamp}${fileExtension}`;
      const storagePath = `exchange-rate/${safeFileName}`;

      toast.loading('파일 업로드 중...', { id: 'upload-rate' });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sales-files')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error(`파일 업로드 실패: ${uploadError.message}`);

      toast.loading('파일 처리 중...', { id: 'upload-rate' });

      const response = await fetch('/api/exchange-rate/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: uploadData.path, fileName: file.name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Processing failed');
      }

      const data = await response.json();
      toast.success(`성공적으로 ${data.count || 0}개의 Exchange Rate를 업로드했습니다`, { id: 'upload-rate' });
      fetchExchangeRates();
    } catch (error) {
      console.error('Failed to upload exchange rate:', error);
      toast.error((error as Error).message || 'Exchange Rate 파일 업로드에 실패했습니다', { id: 'upload-rate' });
    } finally {
      setExchangeUploading(false);
    }
  }, [fetchExchangeRates]);

  const { getRootProps: getRateRootProps, getInputProps: getRateInputProps, isDragActive: isRateDragActive } = useDropzone({
    onDrop: onDropExchangeRate,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    disabled: exchangeUploading,
  });

  const handleAddRate = async () => {
    if (!newRateForm.year || !newRateForm.currency || newRateForm.rate === undefined) {
      toast.error('모든 필드를 입력해주세요');
      return;
    }

    try {
      const response = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates: [{ year: newRateForm.year, currency: newRateForm.currency, rate: newRateForm.rate }] }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add exchange rate');
      }

      toast.success('Exchange Rate가 추가되었습니다');
      setNewRateForm({ year: new Date().getFullYear(), currency: 'USD', rate: 0 });
      setShowAddRate(false);
      fetchExchangeRates();
    } catch (error) {
      console.error('Failed to add exchange rate:', error);
      toast.error((error as Error).message || 'Exchange Rate 추가에 실패했습니다');
    }
  };

  const handleEditRate = (rate: ExchangeRate) => {
    setEditingRateId(rate.id || null);
    setEditRateForm({ year: rate.year, currency: rate.currency, rate: rate.rate });
  };

  const handleSaveRate = async (id: number) => {
    try {
      const response = await fetch('/api/exchange-rate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, year: editRateForm.year, currency: editRateForm.currency, rate: editRateForm.rate }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update exchange rate');
      }

      toast.success('Exchange Rate가 수정되었습니다');
      setEditingRateId(null);
      setEditRateForm({});
      fetchExchangeRates();
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
      toast.error((error as Error).message || 'Exchange Rate 수정에 실패했습니다');
    }
  };

  const handleDeleteRate = async (id: number) => {
    if (!confirm('정말 이 Exchange Rate를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/exchange-rate?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete exchange rate');
      toast.success('Exchange Rate가 삭제되었습니다');
      fetchExchangeRates();
    } catch (error) {
      console.error('Failed to delete exchange rate:', error);
      toast.error('Exchange Rate 삭제에 실패했습니다');
    }
  };

  const handleExportRates = () => {
    const headers = ['year', 'currency', 'rate'];
    const csvContent = [headers.join(','), ...exchangeRates.map(r => [r.year, r.currency, r.rate].join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `exchange_rate_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRates = filterYear === 'all' ? exchangeRates : exchangeRates.filter(r => r.year === filterYear);
  const uniqueYears = [...new Set(exchangeRates.map(r => r.year))].sort((a, b) => b - a);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Master Mapping 관리</h1>
        <p className="text-muted-foreground mt-2">
          Item Mapping 및 Exchange Rate를 관리합니다
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="item-mapping">Item Mapping</TabsTrigger>
          <TabsTrigger value="exchange-rate">Exchange Rate</TabsTrigger>
        </TabsList>

        {/* ==================== Item Mapping Tab ==================== */}
        <TabsContent value="item-mapping" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>Excel 파일 업로드</CardTitle>
                <CardDescription>Excel 파일로 Item Mapping 데이터를 일괄 업로드합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mapping-type">Mapping 타입</Label>
                  <Select
                    value={useMaster ? 'master' : 'entity'}
                    onValueChange={(value) => {
                      setUseMaster(value === 'master');
                      if (value === 'entity' && !entity) setEntity('Japan');
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
                    <Select value={entity} onValueChange={(value) => setEntity(value as Entity)}>
                      <SelectTrigger id="mapping-entity">
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITIES_REQUIRING_MAPPING.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div
                  {...getItemRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isItemDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                  } ${uploading || (!useMaster && !ENTITIES_REQUIRING_MAPPING.includes(entity)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input {...getItemInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  {uploading ? (
                    <p className="text-sm text-muted-foreground">업로드 중...</p>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">Excel 파일을 드래그하거나 클릭하여 업로드</p>
                      <p className="text-xs text-muted-foreground mt-1">필수 컬럼: item_number, fg_classification, category, model, product</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Item Mapping List */}
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
                        <Label htmlFor="update-year" className="text-sm font-medium whitespace-nowrap">업데이트 연도:</Label>
                        <Select value={year?.toString() || 'all'} onValueChange={(value) => setYear(value === 'all' ? null : parseInt(value))}>
                          <SelectTrigger id="update-year" className="w-[140px]">
                            <SelectValue placeholder="연도 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체 연도</SelectItem>
                            {availableYears.map((y) => (
                              <SelectItem key={y} value={y.toString()}>{y}년</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-auto">
                        <Button variant="default" size="sm" onClick={handleUpdateSalesData} disabled={updatingSalesData || loading} className="min-w-[160px]">
                          <Upload className="h-4 w-4 mr-2" />
                          {updatingSalesData ? '업데이트 중...' : 'Sales Data 업데이트'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportItems}>
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteAllItems} disabled={deletingAll || loading}>
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
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : mappings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Item Mapping 데이터가 없습니다.<br />Excel 파일을 업로드하여 데이터를 추가하세요.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {mappings.map((mapping) => {
                      const isEditing = editingId === mapping.id;
                      return (
                        <div key={mapping.id || mapping.item_number} className="p-3 border rounded hover:bg-muted/50 transition-colors">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Item Number</Label>
                                  <Input value={editForm.item_number || ''} onChange={(e) => setEditForm({ ...editForm, item_number: e.target.value })} className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs">FG Classification</Label>
                                  <Input value={editForm.fg_classification || ''} onChange={(e) => setEditForm({ ...editForm, fg_classification: e.target.value })} className="h-8 text-sm" placeholder="FG/NonFG" />
                                </div>
                                <div>
                                  <Label className="text-xs">Category</Label>
                                  <Input value={editForm.category || ''} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs">Model</Label>
                                  <Input value={editForm.model || ''} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} className="h-8 text-sm" />
                                </div>
                                <div className="col-span-2">
                                  <Label className="text-xs">Product</Label>
                                  <Input value={editForm.product || ''} onChange={(e) => setEditForm({ ...editForm, product: e.target.value })} className="h-8 text-sm" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSaveItem(mapping.id!)} className="h-7"><Save className="h-3 w-3 mr-1" />저장</Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditForm({}); }} className="h-7"><X className="h-3 w-3 mr-1" />취소</Button>
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
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditItem(mapping)}><Edit2 className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteItem(mapping.id!, mapping.item_number)}><Trash2 className="h-3 w-3" /></Button>
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
        </TabsContent>

        {/* ==================== Exchange Rate Tab ==================== */}
        <TabsContent value="exchange-rate" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Upload & Add Section */}
            <Card>
              <CardHeader>
                <CardTitle>Exchange Rate 관리</CardTitle>
                <CardDescription>Excel 파일 업로드 또는 수기 입력으로 환율 데이터를 관리합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Excel Upload */}
                <div
                  {...getRateRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isRateDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                  } ${exchangeUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input {...getRateInputProps()} />
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  {exchangeUploading ? (
                    <p className="text-sm text-muted-foreground">업로드 중...</p>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">Excel 파일을 드래그하거나 클릭하여 업로드</p>
                      <p className="text-xs text-muted-foreground mt-1">필수 컬럼: year, currency, rate</p>
                    </div>
                  )}
                </div>

                {/* Manual Input */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">수기 입력</Label>
                    <Button variant="outline" size="sm" onClick={() => setShowAddRate(!showAddRate)}>
                      <Plus className="h-4 w-4 mr-1" />
                      {showAddRate ? '취소' : '새 환율 추가'}
                    </Button>
                  </div>

                  {showAddRate && (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Year</Label>
                          <Input type="number" value={newRateForm.year || ''} onChange={(e) => setNewRateForm({ ...newRateForm, year: parseInt(e.target.value) })} className="h-8 text-sm" placeholder="2026" />
                        </div>
                        <div>
                          <Label className="text-xs">Currency</Label>
                          <Select value={newRateForm.currency || 'USD'} onValueChange={(value) => setNewRateForm({ ...newRateForm, currency: value })}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CURRENCIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Rate</Label>
                          <Input type="number" step="0.0001" value={newRateForm.rate || ''} onChange={(e) => setNewRateForm({ ...newRateForm, rate: parseFloat(e.target.value) })} className="h-8 text-sm" placeholder="1455.58" />
                        </div>
                      </div>
                      <Button size="sm" onClick={handleAddRate} className="w-full"><Save className="h-4 w-4 mr-1" />저장</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Exchange Rate List */}
            <Card>
              <CardHeader>
                <div className="space-y-4">
                  <div>
                    <CardTitle className="text-2xl">Exchange Rate 목록</CardTitle>
                    <CardDescription className="mt-1">등록된 환율 데이터</CardDescription>
                  </div>
                  
                  {exchangeRates.length > 0 && (
                    <div className="flex items-center gap-3 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium whitespace-nowrap">연도 필터:</Label>
                        <Select value={filterYear.toString()} onValueChange={(value) => setFilterYear(value === 'all' ? 'all' : parseInt(value))}>
                          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            {uniqueYears.map((y) => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleExportRates} className="ml-auto">
                        <Download className="h-4 w-4 mr-2" />Export CSV
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {exchangeLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredRates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Exchange Rate 데이터가 없습니다.<br />Excel 파일을 업로드하거나 수기로 입력하세요.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredRates.map((rate) => {
                      const isEditing = editingRateId === rate.id;
                      return (
                        <div key={rate.id} className="p-3 border rounded hover:bg-muted/50 transition-colors">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Year</Label>
                                  <Input type="number" value={editRateForm.year || ''} onChange={(e) => setEditRateForm({ ...editRateForm, year: parseInt(e.target.value) })} className="h-8 text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs">Currency</Label>
                                  <Select value={editRateForm.currency || ''} onValueChange={(value) => setEditRateForm({ ...editRateForm, currency: value })}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {CURRENCIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Rate</Label>
                                  <Input type="number" step="0.0001" value={editRateForm.rate || ''} onChange={(e) => setEditRateForm({ ...editRateForm, rate: parseFloat(e.target.value) })} className="h-8 text-sm" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSaveRate(rate.id!)} className="h-7"><Save className="h-3 w-3 mr-1" />저장</Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingRateId(null); setEditRateForm({}); }} className="h-7"><X className="h-3 w-3 mr-1" />취소</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span className="font-medium text-sm w-12">{rate.year}</span>
                                <span className="text-sm w-12 text-center font-mono bg-muted px-2 py-0.5 rounded">{rate.currency}</span>
                                <span className="text-sm">{rate.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditRate(rate)}><Edit2 className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteRate(rate.id!)}><Trash2 className="h-3 w-3" /></Button>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
