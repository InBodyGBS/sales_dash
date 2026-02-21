'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PriceChart } from './PriceChart';
import { TopProductsChart } from './TopProductsChart';

type ViewType = 'product' | 'corp';

interface PriceData {
  [model: string]: {
    [year: string]: {
      [entity: string]: {
        qty: number;
        amt: number;
        price: number;
      };
    };
  };
}

interface TopProduct {
  model: string;
  qty: number;
  amt: number;
  price: number;
  share: number;
}

interface TopProductsData {
  [entity: string]: {
    [year: string]: TopProduct[];
  };
}

export function SalesPriceView() {
  const [currentView, setCurrentView] = useState<ViewType>('product');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  
  const [categories, setCategories] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [productCategories, setProductCategories] = useState<{ [product: string]: string }>({});
  const [entities, setEntities] = useState<string[]>([]);
  const [priceData, setPriceData] = useState<PriceData>({});
  const [topProductsData, setTopProductsData] = useState<TopProductsData>({});
  const [loading, setLoading] = useState(false);

  // Load models list
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetch('/api/analysis/product-price');
        const data = await res.json();
        if (data.success && data.data.models) {
          setCategories(data.data.categories || []);
          setModels(data.data.models);
          setProductCategories(data.data.productCategories || {});
          setPriceData(data.data.priceData || {});
          if (data.data.categories && data.data.categories.length > 0 && !selectedCategory) {
            setSelectedCategory(data.data.categories[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

  // Filter products by selected category
  const filteredModels = selectedCategory
    ? models.filter((model) => productCategories[model] === selectedCategory)
    : models;

  // Reset product selection when category changes
  useEffect(() => {
    if (selectedCategory && filteredModels.length > 0) {
      if (!filteredModels.includes(selectedModel)) {
        setSelectedModel(filteredModels[0]);
      }
    } else if (selectedCategory && filteredModels.length === 0) {
      setSelectedModel('');
    }
  }, [selectedCategory, filteredModels]);

  // Load entities and top products
  useEffect(() => {
    const loadTopProducts = async () => {
      try {
        const res = await fetch('/api/analysis/corp-top-products');
        const data = await res.json();
        if (data.success) {
          setEntities(data.data.entities || []);
          setTopProductsData(data.data.topProducts || {});
          if (data.data.entities.length > 0 && !selectedEntity) {
            setSelectedEntity(data.data.entities[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load top products:', error);
      }
    };
    loadTopProducts();
  }, []);

  const handleProductClick = (model: string) => {
    setSelectedModel(model);
    setCurrentView('product');
  };

  return (
    <div className="space-y-6">
      {/* View 1: 제품별 단가 분석 */}
      {currentView === 'product' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">제품별 단가 분석</h2>
              <p className="text-muted-foreground mt-1">
                제품을 선택하여 법인별 평균 판매 단가를 비교합니다
              </p>
            </div>
            <Button
              onClick={() => setCurrentView('corp')}
              variant="outline"
              className="flex items-center gap-2"
            >
              법인별 주력 제품 분석으로 이동
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>필터 선택</CardTitle>
              <CardDescription>
                카테고리를 먼저 선택한 후, 제품을 선택하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">카테고리</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="카테고리를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">제품</label>
                  <Select 
                    value={selectedModel} 
                    onValueChange={setSelectedModel}
                    disabled={!selectedCategory || filteredModels.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={selectedCategory ? "제품을 선택하세요" : "먼저 카테고리를 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCategory && filteredModels.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      선택한 카테고리에 제품이 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedModel && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>2024년</CardTitle>
                </CardHeader>
                <CardContent>
                  <PriceChart
                    data={priceData[selectedModel]?.['2024'] || {}}
                    year={2024}
                    model={selectedModel}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>2025년</CardTitle>
                </CardHeader>
                <CardContent>
                  <PriceChart
                    data={priceData[selectedModel]?.['2025'] || {}}
                    year={2025}
                    model={selectedModel}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* View 2: 법인별 주력 제품 분석 */}
      {currentView === 'corp' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">법인별 주력 제품 분석</h2>
              <p className="text-muted-foreground mt-1">
                법인을 선택하여 Top 10 제품 매출을 확인합니다
              </p>
            </div>
            <Button
              onClick={() => setCurrentView('product')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              제품별 단가 분석으로 이동
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>법인 선택</CardTitle>
              <CardDescription>
                분석할 법인을 선택하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="법인을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity} value={entity}>
                      {entity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-4">
                💡 팁: 그래프 막대를 클릭하면 해당 제품의 단가 분석 화면으로 이동합니다.
              </p>
            </CardContent>
          </Card>

          {selectedEntity && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>2024년</CardTitle>
                </CardHeader>
                <CardContent>
                  <TopProductsChart
                    data={topProductsData[selectedEntity]?.['2024'] || []}
                    year={2024}
                    entity={selectedEntity}
                    onProductClick={handleProductClick}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>2025년</CardTitle>
                </CardHeader>
                <CardContent>
                  <TopProductsChart
                    data={topProductsData[selectedEntity]?.['2025'] || []}
                    year={2025}
                    entity={selectedEntity}
                    onProductClick={handleProductClick}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

