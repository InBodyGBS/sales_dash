'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalesPriceView } from '@/components/analysis/SalesPriceView';

export default function AnalysisPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Sales Analysis</h1>
        <p className="text-muted-foreground mt-2">
          제품별 단가 분석 및 법인별 주력 제품 분석
        </p>
      </div>

      <Tabs defaultValue="sales-price" className="w-full">
        <TabsList className="grid w-full grid-cols-1 max-w-md">
          <TabsTrigger value="sales-price">Sales Price</TabsTrigger>
        </TabsList>

        <TabsContent value="sales-price" className="mt-6">
          <SalesPriceView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

