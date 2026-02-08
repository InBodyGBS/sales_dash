'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileUploader } from '@/components/upload/FileUploader';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Entity, UploadHistory } from '@/lib/types/sales';
import { formatDate } from '@/lib/utils/formatters';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_ERROR_PREVIEW_LENGTH = 50;

export default function UploadPage() {
  const [entity, setEntity] = useState<Entity>('HQ');
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: '',
    message: '',
  });

  const fetchUploadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/upload/history?entity=${entity}&limit=20`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch upload history');
      }
      
      const data = await response.json();
      setUploadHistory(data.history || []);
    } catch (error) {
      console.error('Failed to fetch upload history:', error);
      setUploadHistory([]);
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    fetchUploadHistory();
  }, [fetchUploadHistory]);

  const handleUploadSuccess = () => {
    fetchUploadHistory();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return '성공';
      case 'failed':
        return '실패';
      case 'processing':
        return '처리 중';
      default:
        return status;
    }
  };

  const toggleErrorExpansion = (uploadId: string) => {
    setExpandedErrors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uploadId)) {
        newSet.delete(uploadId);
      } else {
        newSet.add(uploadId);
      }
      return newSet;
    });
  };

  const showFullError = (fileName: string, errorMessage: string) => {
    setErrorDialog({
      open: true,
      title: `에러 상세: ${fileName}`,
      message: errorMessage,
    });
  };

  const handleDelete = async (uploadId: string, fileName: string) => {
    if (!confirm(`정말 "${fileName}" 업로드 기록을 삭제하시겠습니까?`)) {
      return;
    }

    setDeletingId(uploadId);
    try {
      const response = await fetch(`/api/upload/history?id=${uploadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete upload history');
      }

      toast.success('업로드 기록이 삭제되었습니다');
      fetchUploadHistory();
    } catch (error) {
      console.error('Failed to delete upload history:', error);
      toast.error('업로드 기록 삭제에 실패했습니다');
    } finally {
      setDeletingId(null);
    }
  };

  const formatErrorPreview = (errorMessage: string | null, uploadId: string): string => {
    if (!errorMessage) return '';
    if (errorMessage.length <= MAX_ERROR_PREVIEW_LENGTH) return errorMessage;
    return errorMessage.substring(0, MAX_ERROR_PREVIEW_LENGTH) + '...';
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Sales Dashboard - Data Upload</h1>
        <p className="text-muted-foreground mt-2">
          Upload Excel files containing sales data for each entity
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entity">Select Entity</Label>
            <Select
              value={entity}
              onValueChange={(value) => setEntity(value as Entity)}
            >
              <SelectTrigger id="entity">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HQ">HQ</SelectItem>
                <SelectItem value="USA">USA</SelectItem>
                <SelectItem value="BWA">BWA</SelectItem>
                <SelectItem value="Vietnam">Vietnam</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Korot">Korot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <FileUploader entity={entity} onUploadSuccess={handleUploadSuccess} />
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>Recent file uploads</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : uploadHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No upload history yet
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadHistory.map((upload) => {
                    const isErrorExpanded = expandedErrors.has(upload.id);
                    const isSkipMessage = upload.error_message?.includes('Skip') || upload.error_message?.includes('skip');
                    const hasError = upload.error_message && !isSkipMessage;

                    return (
                      <div
                        key={upload.id}
                        className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 transition-colors"
                      >
                        {getStatusIcon(upload.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{upload.file_name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                              upload.status === 'success' || upload.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : upload.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {getStatusText(upload.status)}
                            </span>
                            <span className="text-xs text-muted-foreground">{upload.entity}</span>
                            {upload.rows_uploaded !== null && upload.rows_uploaded > 0 && (
                              <span className="text-xs text-muted-foreground">{upload.rows_uploaded.toLocaleString()}행</span>
                            )}
                            {isSkipMessage && (
                              <span className="text-xs text-amber-600">{upload.error_message}</span>
                            )}
                            <span className="text-xs text-muted-foreground">{formatDate(upload.uploaded_at)}</span>
                          </div>
                          {hasError && (
                            <div className="mt-1">
                              {!isErrorExpanded ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-xs text-primary hover:text-primary/80"
                                  onClick={() => toggleErrorExpansion(upload.id)}
                                >
                                  에러 상세
                                  <ChevronDown className="h-3 w-3 ml-0.5" />
                                </Button>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-red-600 font-medium">에러</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1.5 text-xs text-primary hover:text-primary/80"
                                      onClick={() => toggleErrorExpansion(upload.id)}
                                    >
                                      접기
                                      <ChevronUp className="h-3 w-3 ml-0.5" />
                                    </Button>
                                  </div>
                                  <div className="bg-red-50 border border-red-200 rounded p-1.5">
                                    <p className="text-xs text-red-700 whitespace-pre-wrap break-words">
                                      {upload.error_message}
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-5 text-xs"
                                    onClick={() => showFullError(upload.file_name, upload.error_message!)}
                                  >
                                    전체 보기
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(upload.id, upload.file_name)}
                          disabled={deletingId === upload.id}
                          title="삭제"
                        >
                          {deletingId === upload.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Error Detail Dialog */}
      <Dialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {errorDialog.title}
            </DialogTitle>
            <DialogDescription>
              전체 에러 메시지
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-md">
            <pre className="text-sm whitespace-pre-wrap break-words font-mono">
              {errorDialog.message}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setErrorDialog({ ...errorDialog, open: false })}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
