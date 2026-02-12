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
  const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableEntities();
  }, []);

  const fetchAvailableEntities = async () => {
    try {
      // Use optimized API endpoint that checks all entities in a single query
      // This is much faster than checking each entity individually
      const res = await fetch('/api/entities/available');
      const data = await res.json();
      
      let available: Entity[] = [];
      
      if (data.entities && Array.isArray(data.entities)) {
        // Filter to only include entities that are in our ENTITIES list
        available = data.entities.filter((e: string) => 
          ENTITIES.includes(e as Entity)
        ) as Entity[];
      }
      
      // If China is missing from API response but is in ENTITIES, check it individually
      // This ensures China is always checked even if API doesn't return it
      if (!available.includes('China') && ENTITIES.includes('China')) {
        try {
          const chinaRes = await fetch('/api/years?entity=China');
          const chinaData = await chinaRes.json();
          if (chinaData.years && chinaData.years.length > 0) {
            available.push('China');
            console.log('✅ China data found via individual check');
          }
        } catch (chinaError) {
          console.warn('⚠️ Failed to check China individually:', chinaError);
        }
      }
      
      // If Japan is missing, check it too
      if (!available.includes('Japan') && ENTITIES.includes('Japan')) {
        try {
          const japanRes = await fetch('/api/years?entity=Japan');
          const japanData = await japanRes.json();
          if (japanData.years && japanData.years.length > 0) {
            available.push('Japan');
            console.log('✅ Japan data found via individual check');
          }
        } catch (japanError) {
          console.warn('⚠️ Failed to check Japan individually:', japanError);
        }
      }
      
      setAvailableEntities(available);
    } catch (error) {
      console.error('Failed to fetch available entities:', error);
      // Fallback: if API fails, show all entities
      setAvailableEntities(ENTITIES);
    } finally {
      setLoading(false);
    }
  };

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
            const hasData = availableEntities.includes(entity);
            return (
              <Card
                key={entity}
                className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                  hasData
                    ? 'hover:border-primary'
                    : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={() => hasData && handleEntitySelect(entity)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div
                    className={`p-4 rounded-full ${
                      hasData ? 'bg-primary/10' : 'bg-muted'
                    }`}
                  >
                    <Building2
                      className={`h-8 w-8 ${
                        hasData ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">
                      {ENTITY_DISPLAY_NAMES[entity]}
                    </h3>
                    {!hasData && (
                      <p className="text-sm text-muted-foreground">
                        No data available
                      </p>
                    )}
                  </div>
                  {hasData && (
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
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {availableEntities.length === 0 && (
          <div className="mt-12 text-center">
            <Card className="p-8">
              <p className="text-muted-foreground">
                No sales data available. Please upload data first.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
