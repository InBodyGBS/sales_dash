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
    fetchAvailableEntities();
  }, []);

  const fetchAvailableEntities = async () => {
    try {
      // Check which entities have years data
      // Show all entities, but mark which ones have valid years
      const entityChecks = await Promise.all(
        ENTITIES.map(async (entity) => {
          try {
            const res = await fetch(`/api/years?entity=${entity}`);
            const data = await res.json();
            // Return entity if it has years
            return data.years && data.years.length > 0 ? entity : null;
          } catch {
            // On error, return null (will still show entity but mark as "no data")
            return null;
          }
        })
      );

      // Track which entities have years
      const withYears = new Set<Entity>(
        entityChecks.filter((e): e is Entity => e !== null)
      );
      setEntitiesWithYears(withYears);
    } catch (error) {
      console.error('Failed to fetch available entities:', error);
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
            const hasYears = entitiesWithYears.has(entity);
            return (
              <Card
                key={entity}
                className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                  hasYears
                    ? 'hover:border-primary'
                    : 'opacity-60'
                }`}
                onClick={() => handleEntitySelect(entity)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div
                    className={`p-4 rounded-full ${
                      hasYears ? 'bg-primary/10' : 'bg-muted'
                    }`}
                  >
                    <Building2
                      className={`h-8 w-8 ${
                        hasYears ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">
                      {ENTITY_DISPLAY_NAMES[entity]}
                    </h3>
                    {!hasYears && (
                      <p className="text-sm text-muted-foreground">
                        No data available
                      </p>
                    )}
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
