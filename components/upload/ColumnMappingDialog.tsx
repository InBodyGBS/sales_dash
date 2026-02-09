'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Entity } from '@/lib/types/sales';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: Entity;
  file: File | null;
  onMappingComplete: (mapping: Record<string, string>) => void;
}

export function ColumnMappingDialog({
  open,
  onOpenChange,
  entity,
  file,
  onMappingComplete,
}: ColumnMappingDialogProps) {
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [savedMapping, setSavedMapping] = useState<Record<string, string>>({});

  // Load existing mapping for entity
  useEffect(() => {
    if (open && entity && entity !== 'All') {
      loadExistingMapping();
    }
  }, [open, entity]);

  // Detect columns from file
  useEffect(() => {
    if (open && file) {
      detectColumns();
    }
  }, [open, file]);

  const loadExistingMapping = async () => {
    try {
      const response = await fetch(`/api/column-mapping?entity=${entity}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.mapping) {
          setSavedMapping(data.mapping);
          setMapping(data.mapping);
        }
      }
    } catch (error) {
      console.error('Failed to load existing mapping:', error);
    }
  };

  const detectColumns = async () => {
    if (!file) return;

    setDetecting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/column-mapping/detect', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to detect columns');
      }

      const data = await response.json();
      if (data.success) {
        setExcelColumns(data.excelColumns || []);
        setDbColumns(data.dbColumns || []);

        // Auto-map if saved mapping exists
        if (Object.keys(savedMapping).length > 0) {
          const autoMapping: Record<string, string> = {};
          data.excelColumns.forEach((excelCol: string) => {
            if (savedMapping[excelCol]) {
              autoMapping[excelCol] = savedMapping[excelCol];
            }
          });
          setMapping(autoMapping);
        }
      }
    } catch (error) {
      console.error('Failed to detect columns:', error);
      toast.error('Failed to detect columns from file');
    } finally {
      setDetecting(false);
    }
  };

  const handleMappingChange = (excelColumn: string, dbColumn: string) => {
    setMapping((prev) => {
      const newMapping = { ...prev };
      // If "__skip__" is selected, remove the mapping for this column
      if (dbColumn === '__skip__') {
        delete newMapping[excelColumn];
      } else {
        newMapping[excelColumn] = dbColumn;
      }
      return newMapping;
    });
  };

  const handleSaveMapping = async () => {
    if (!entity || entity === 'All') {
      toast.error('Please select an entity');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/column-mapping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity,
          mappings: mapping,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save mapping');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Column mapping saved successfully');
        setSavedMapping(mapping);
      }
    } catch (error) {
      console.error('Failed to save mapping:', error);
      toast.error('Failed to save column mapping');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (Object.keys(mapping).length === 0) {
      toast.error('Please map at least one column');
      return;
    }

    // Note: invoice_date is not required - users can choose which date field to use
    // Year/quarter will be calculated from any date field that maps to invoice_date, due_date, or created_date

    onMappingComplete(mapping);
    onOpenChange(false);
  };

  const unmappedColumns = excelColumns.filter((col) => !mapping[col]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Column Mapping - {entity}</DialogTitle>
          <DialogDescription>
            Map Excel columns to database columns. This mapping will be saved for future uploads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {detecting ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Detecting columns from file...</span>
            </div>
          ) : excelColumns.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>No columns detected. Please upload a valid Excel file.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {excelColumns.length} Excel columns detected
                  </p>
                  {unmappedColumns.length > 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      {unmappedColumns.length} columns not mapped
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveMapping}
                  disabled={loading || Object.keys(mapping).length === 0}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Mapping
                </Button>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {excelColumns.map((excelColumn) => {
                  const mappedDbColumn = mapping[excelColumn];
                  // No required fields - all mappings are optional

                  return (
                    <Card key={excelColumn} className="p-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <Label className="text-sm font-medium">
                            {excelColumn}
                          </Label>
                          <p className="text-xs text-muted-foreground truncate">
                            Excel Column
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">→</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <Select
                            value={mappedDbColumn ? mappedDbColumn : undefined}
                            onValueChange={(value) => handleMappingChange(excelColumn, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select DB column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__">-- Skip --</SelectItem>
                              {dbColumns.map((dbCol) => (
                                <SelectItem key={dbCol} value={dbCol}>
                                  {dbCol}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Map columns as needed - all mappings are optional</li>
                      <li>Unmapped columns will be skipped during import</li>
                      <li>Save the mapping to reuse it for future uploads</li>
                      <li>If you map a date column, year/quarter will be automatically calculated</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={detecting || Object.keys(mapping).length === 0}
          >
            Continue with Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

