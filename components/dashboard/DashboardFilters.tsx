'use client';

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
import { Checkbox } from '@/components/ui/checkbox';
import { Entity } from '@/lib/types/sales';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface DashboardFiltersProps {
  year: string;
  entities: Entity[];
  quarter: string;
  countries: string[];
  fg: string;
  onYearChange: (year: string) => void;
  onEntitiesChange: (entities: Entity[]) => void;
  onQuarterChange: (quarter: string) => void;
  onCountriesChange: (countries: string[]) => void;
  onFGChange: (fg: string) => void;
  disableEntitySelection?: boolean;
  entity?: Entity;
}

export function DashboardFilters({
  year,
  entities,
  quarter,
  countries,
  fg,
  onYearChange,
  onEntitiesChange,
  onQuarterChange,
  onCountriesChange,
  onFGChange,
  disableEntitySelection = false,
  entity,
}: DashboardFiltersProps) {
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAutoSetYear = useRef(false);

  // DB에서 모든 Entity 목록 가져오기
  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const res = await fetch('/api/entities');
        const data = await res.json();
        const entitiesList = data.entities || [];
        console.log('Fetched entities from DB:', entitiesList);
        setAllEntities(entitiesList);
      } catch (error) {
        console.error('Failed to fetch entities:', error);
        setAllEntities([]);
      }
    };
    fetchEntities();
  }, []);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const entityParam = entity || (entities.length === 1 ? entities[0] : null);
        const url = entityParam ? `/api/years?entity=${entityParam}` : '/api/years';
        console.log('Fetching years from:', url, 'entity:', entityParam, 'entities:', entities);
        const res = await fetch(url);
        const data = await res.json();
        const years = data.years || [];
        console.log('Fetched years:', years, 'for entity:', entityParam);
        setAvailableYears(years);
      } catch (error) {
        console.error('Failed to fetch years:', error);
        setAvailableYears([]);
      }
    };

    fetchYears();
    fetchCountries();
    hasAutoSetYear.current = false;
  }, [entity, entities]);
  
  useEffect(() => {
    if ((!year || year.trim() === '') && availableYears.length > 0 && !hasAutoSetYear.current) {
      console.log('Auto-setting year to first available:', availableYears[0]);
      onYearChange(String(availableYears[0]));
      hasAutoSetYear.current = true;
    }
  }, [availableYears, year, onYearChange]);

  const fetchCountries = async () => {
    try {
      setAvailableCountries([]);
    } catch (error) {
      console.error('Failed to fetch countries:', error);
    }
  };

  const isAllSelected = allEntities.length > 0 && entities.length === allEntities.length;

  const handleEntityToggle = (entityToToggle: Entity) => {
    if (entities.includes(entityToToggle)) {
      onEntitiesChange(entities.filter((e) => e !== entityToToggle));
    } else {
      onEntitiesChange([...entities, entityToToggle]);
    }
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      onEntitiesChange([]);
      } else {
      onEntitiesChange(allEntities);
    }
  };

  const handleReset = () => {
    onYearChange('');
    onEntitiesChange([]);
    onQuarterChange('All');
    onCountriesChange([]);
    onFGChange('All');
  };

  return (
    <Card className="sticky top-4 z-10">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription>Filter dashboard data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Select value={year || undefined} onValueChange={onYearChange} disabled={availableYears.length === 0}>
            <SelectTrigger id="year">
              <SelectValue placeholder={availableYears.length === 0 ? "Loading years..." : "Select year"} />
            </SelectTrigger>
            {availableYears.length > 0 && (
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            )}
          </Select>
        </div>

        {!disableEntitySelection ? (
          <div className="space-y-2">
            <Label>Entities</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="entity-all"
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="entity-all" className="text-sm cursor-pointer font-medium">
                  All
                </label>
              </div>
              <div className="border-t my-2" />
              {allEntities.length > 0 ? (
                allEntities.map((ent) => (
                  <div key={ent} className="flex items-center space-x-2">
                  <Checkbox
                      id={`entity-${ent}`}
                      checked={entities.includes(ent)}
                      onCheckedChange={() => handleEntityToggle(ent)}
                  />
                    <label htmlFor={`entity-${ent}`} className="text-sm cursor-pointer">
                      {ent}
                  </label>
                </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Loading entities...</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Entity</Label>
            <div className="p-3 border rounded-md bg-muted">
              <p className="text-sm font-medium">{entities[0] || 'N/A'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Entity is fixed for this dashboard
              </p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-sm font-medium"
          >
            <span>Advanced Filters</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Quarter</Label>
                <div className="flex gap-2 flex-wrap">
                  {['All', 'Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                    <Button
                      key={q}
                      variant={quarter === q ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onQuarterChange(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>

              {/* FG filter hidden as per requirements */}
              {/* <div className="space-y-2">
                <Label>FG</Label>
                <div className="flex gap-2 flex-wrap">
                  {['All', 'FG', 'NonFG'].map((f) => (
                    <Button
                      key={f}
                      variant={fg === f ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onFGChange(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div> */}

              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
