import { useState, forwardRef, useImperativeHandle } from 'react'
import { getDocumentApi, listDocumentsApi } from '@/utils/api'
import { DocumentMetadata } from '@/types/index'
import { toast } from 'react-hot-toast'

interface DocumentBulkDownloadProps {
  organizationId: string
  searchParameters: {
    searchTerm: string
    selectedTagFilters: any[]
    metadataSearch: string
    paginationModel: { page: number; pageSize: number }
  }
  totalDocuments: number
  disabled?: boolean
  onProgress?: (processed: number, total: number) => void
}

export interface DocumentBulkDownloadRef {
  executeDownload: () => Promise<void>
}

export const DocumentBulkDownload = forwardRef<DocumentBulkDownloadRef, DocumentBulkDownloadProps>(({
  organizationId,
  searchParameters,
  totalDocuments,
  onProgress
}, ref) => {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadedCount, setDownloadedCount] = useState(0)

  // Parse and URL-encode metadata search to handle special characters
  const parseAndEncodeMetadataSearch = (searchStr: string): string | null => {
    try {
      const pairs: string[] = [];
      const rawPairs = searchStr.split(',');

      for (const rawPair of rawPairs) {
        const trimmed = rawPair.trim();
        if (!trimmed) continue;

        const equalIndex = trimmed.indexOf('=');
        if (equalIndex === -1) continue;

        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();

        if (key && value) {
          const encodedKey = encodeURIComponent(key);
          const encodedValue = encodeURIComponent(value);
          pairs.push(`${encodedKey}=${encodedValue}`);
        }
      }

      return pairs.length > 0 ? pairs.join(',') : null;
    } catch (error) {
      console.error('Error parsing metadata search:', error);
      return null;
    }
  };

  const downloadDocument = async (doc: DocumentMetadata, folderName: string): Promise<boolean> => {
    try {
      const response = await getDocumentApi({
        organizationId,
        documentId: doc.id,
        fileType: "original"
      });

      const fileName = doc.document_name || response.metadata.document_name;
      const serverType: string | undefined = response.metadata?.type as string | undefined;
      const blob = new Blob([response.content], { type: serverType });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}/${doc.id}/${fileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error(`Failed to download document ${doc.document_name}:`, error);
      return false;
    }
  }

  const handleBulkDownload = async () => {
    if (totalDocuments === 0) {
      toast.error('No documents to download');
      return;
    }

    setIsDownloading(true);
    setDownloadedCount(0);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const folderName = `DocumentBulkDownload_${timestamp}`;

      let successCount = 0;
      let failureCount = 0;
      let skip = 0;
      const limit = 100;
      const BATCH_SIZE = 10; // Maximum concurrent downloads

      while (true) {
        // Fetch next batch of documents
        const batchResponse = await listDocumentsApi({
          organizationId,
          skip,
          limit,
          nameSearch: searchParameters.searchTerm.trim() || undefined,
          tagIds: searchParameters.selectedTagFilters.length > 0
            ? searchParameters.selectedTagFilters.map(tag => tag.id).join(',')
            : undefined,
          metadataSearch: searchParameters.metadataSearch.trim()
            ? parseAndEncodeMetadataSearch(searchParameters.metadataSearch.trim()) || undefined
            : undefined,
        });

        const documentsInBatch = batchResponse.documents;

        if (documentsInBatch.length === 0) {
          break;
        }

        // Process documents in batches of BATCH_SIZE
        for (let i = 0; i < documentsInBatch.length; i += BATCH_SIZE) {
          const batch = documentsInBatch.slice(i, i + BATCH_SIZE);

          const downloadPromises = batch.map((doc: any) => downloadDocument(doc, folderName));
          const results = await Promise.all(downloadPromises);

          // Count successes and failures
          results.forEach(success => {
            if (success) {
              successCount++;
            } else {
              failureCount++;
            }
          });

          const newTotal = successCount + failureCount;
          setDownloadedCount(newTotal);
          if (onProgress) {
            onProgress(newTotal, totalDocuments);
          }

          // Add a small delay between batches to prevent overwhelming the browser
          if (i + BATCH_SIZE < documentsInBatch.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (documentsInBatch.length < limit) {
          break;
        }

        skip += limit;
      }

      if (successCount > 0) {
        toast.success(`Successfully downloaded ${successCount} document${successCount !== 1 ? 's' : ''} to ${folderName}`);
      }

      if (failureCount > 0) {
        toast.error(`Failed to download ${failureCount} document${failureCount !== 1 ? 's' : ''}`);
      }

    } catch (error) {
      console.error('Bulk download error:', error);
      toast.error('Failed to perform bulk download');
    } finally {
      setIsDownloading(false);
      setDownloadedCount(0);
    }
  }

  useImperativeHandle(ref, () => ({
    executeDownload: handleBulkDownload
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-gray-700">
            Download all matching documents to your Downloads folder in organized subfolders.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Documents will be saved as: Downloads/DocumentBulkDownload_[timestamp]/[document_id]/[filename]
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Downloads are processed in batches of 10 to avoid overwhelming your browser.
          </p>
        </div>
      </div>

      {isDownloading && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">
              Downloading Documents...
            </span>
            <span className="text-sm text-blue-600">
              {downloadedCount} / {totalDocuments}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${totalDocuments > 0 ? (downloadedCount / totalDocuments) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      )}

    </div>
  )
});