'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { Entity } from '@/lib/types/sales';
import toast from 'react-hot-toast';

const ENTITIES: Entity[] = ['HQ', 'USA', 'BWA', 'Vietnam', 'Healthcare', 'Korot', 'Japan', 'China'];

const ENTITY_DISPLAY_NAMES: Record<Entity, string> = {
  HQ: 'HQ',
  USA: 'USA',
  BWA: 'BWA',
  Vietnam: 'Vietnam',
  Healthcare: 'Healthcare',
  Korot: 'Korot',
  Japan: 'Japan',
  China: 'China',
  All: 'All',
};

export default function DashboardPage() {
  const router = useRouter();
  const [entitiesWithYears, setEntitiesWithYears] = useState<Set<Entity>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 모든 entity를 항상 표시 (years API 체크 없이)
    // 데이터가 없으면 entity dashboard 페이지에서 처리
    setEntitiesWithYears(new Set(ENTITIES));
    setLoading(false);
  }, []);

  const handleEntitySelect = (entity: Entity) => {
    router.push(`/dashboard/${entity}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Sales Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Select an entity to view its sales dashboard
          </p>
        </div>

        {/* InBody Group Dashboard Card */}
        <div className="mb-8">
          <Card
            className="p-6 cursor-pointer transition-all hover:shadow-lg hover:border-primary"
            onClick={() => router.push('/dashboard/group')}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">InBody Group</h3>
                <p className="text-sm text-muted-foreground">
                  View all entities combined
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/dashboard/group');
                }}
              >
                View Group Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Entity Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ENTITIES.map((entity) => {
            const hasYears = entitiesWithYears.has(entity);
            return (
              <Card
                key={entity}
                className="p-6 cursor-pointer transition-all hover:shadow-lg hover:border-primary"
                onClick={() => handleEntitySelect(entity)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">
                      {ENTITY_DISPLAY_NAMES[entity]}
                    </h3>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEntitySelect(entity);
                    }}
                  >
                    View Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
