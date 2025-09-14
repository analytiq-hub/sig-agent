import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { Tag } from '@/types/index';
import { Prompt } from '@/types/prompts';
import { listPromptsApi, getLLMResultApi, runLLMApi, listDocumentsApi } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import SingleTagSelector from './SingleTagSelector';

// Batch size constant - will be increased to 25 later
const BATCH_SIZE = 3;

interface DocumentBulkRunLLMProps {
  organizationId: string;
  searchParameters: {
    searchTerm: string;
    selectedTagFilters: Tag[];
    metadataSearch: string;
    paginationModel: { page: number; pageSize: number };
  };
  totalDocuments: number;
  disabled?: boolean;
  onProgress?: (processed: number) => void;
  onComplete?: () => void;
  availableTags: Tag[];
  onDataChange?: (data: any) => void;
}

interface PromptExecution {
  prompt: Prompt;
  documentId: string;
  documentName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

interface PromptExecutionGroup {
  prompt: Prompt;
  executions: PromptExecution[];
  totalExecutions: number;
  completedExecutions: number;
}

export interface DocumentBulkRunLLMRef {
  executeRunLLM: () => Promise<void>;
}

export const DocumentBulkRunLLM = forwardRef<DocumentBulkRunLLMRef, DocumentBulkRunLLMProps>(
  ({ organizationId, searchParameters, disabled, onProgress, onComplete, availableTags, onDataChange }, ref) => {
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
    const [promptGroups, setPromptGroups] = useState<PromptExecutionGroup[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [totalExecutions, setTotalExecutions] = useState(0);
    const [completedExecutions, setCompletedExecutions] = useState(0);

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

    // Analyze what needs to be executed when tag selection changes
    useEffect(() => {
      if (selectedTag) {
        analyzeExecutions();
      } else {
        setPromptGroups([]);
        setTotalExecutions(0);
      }
    }, [selectedTag]);

    // Update parent component with data changes
    useEffect(() => {
      if (onDataChange) {
        onDataChange(selectedTag);
      }
    }, [selectedTag, onDataChange]);

    // Helper function to fetch all prompts with pagination
    const fetchAllPrompts = async () => {
      const allPrompts: Prompt[] = [];
      let skip = 0;
      const limit = 100; // API maximum

      while (true) {
        const response = await listPromptsApi({
          organizationId,
          tag_ids: selectedTag!.id,
          skip,
          limit
        });

        allPrompts.push(...response.prompts);

        // If we got less than the limit, we've reached the end
        if (response.prompts.length < limit) {
          break;
        }

        skip += limit;
      }

      return allPrompts;
    };

    // Helper function to fetch all documents with pagination
    const fetchAllDocuments = async () => {
      const allDocuments: any[] = [];
      let skip = 0;
      const limit = 100; // API maximum

      while (true) {
        const response = await listDocumentsApi({
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

        allDocuments.push(...response.documents);

        // If we got less than the limit, we've reached the end
        if (response.documents.length < limit) {
          break;
        }

        skip += limit;
      }

      return allDocuments;
    };

    const analyzeExecutions = async () => {
      if (!selectedTag) return;

      setIsAnalyzing(true);
      try {
        // Get all prompts for the selected tag using pagination
        const allPrompts = await fetchAllPrompts();

        if (allPrompts.length === 0) {
          toast('No prompts found for the selected tag');
          setPromptGroups([]);
          setTotalExecutions(0);
          return;
        }

        // Get all documents that match the current filters using pagination
        const allDocuments = await fetchAllDocuments();

        if (allDocuments.length === 0) {
          toast('No documents match the current filters');
          setPromptGroups([]);
          setTotalExecutions(0);
          return;
        }

        // For each prompt, check which documents need LLM execution
        const groups: PromptExecutionGroup[] = [];
        let totalExecs = 0;

        for (const prompt of allPrompts) {
          const executions: PromptExecution[] = [];

          // Check each document to see if it needs this prompt executed
          for (const document of allDocuments) {
            try {
              // Try to get existing LLM result
              await getLLMResultApi({
                organizationId,
                documentId: document.id,
                promptRevId: prompt.prompt_revid,
                latest: true
              });
              // If we get here, result exists - skip execution
            } catch (error) {
              // Result doesn't exist - needs execution
              executions.push({
                prompt,
                documentId: document.id,
                documentName: document.document_name,
                status: 'pending'
              });
            }
          }

          if (executions.length > 0) {
            groups.push({
              prompt,
              executions,
              totalExecutions: executions.length,
              completedExecutions: 0
            });
            totalExecs += executions.length;
          }
        }

        setPromptGroups(groups);
        setTotalExecutions(totalExecs);

      } catch (error) {
        console.error('Error analyzing executions:', error);
        toast.error('Failed to analyze required executions');
      } finally {
        setIsAnalyzing(false);
      }
    };

    const executeRunLLM = async () => {
      if (!selectedTag || promptGroups.length === 0) {
        toast('Please select a tag and ensure there are executions to run');
        return;
      }

      setIsExecuting(true);
      setCompletedExecutions(0);

      try {
        // Process all executions in batches
        for (const group of promptGroups) {
          const executions = [...group.executions];

          // Process in batches of BATCH_SIZE
          for (let i = 0; i < executions.length; i += BATCH_SIZE) {
            const batch = executions.slice(i, i + BATCH_SIZE);

            // Execute batch in parallel
            const batchPromises = batch.map(async (execution) => {
              try {
                // Update status to running
                setPromptGroups(prev => prev.map(g =>
                  g.prompt.prompt_revid === group.prompt.prompt_revid
                    ? {
                        ...g,
                        executions: g.executions.map(e =>
                          e.documentId === execution.documentId
                            ? { ...e, status: 'running' as const }
                            : e
                        )
                      }
                    : g
                ));

                // Run the LLM
                await runLLMApi({
                  organizationId,
                  documentId: execution.documentId,
                  promptRevId: execution.prompt.prompt_revid,
                  force: false
                });

                // Update status to completed
                setPromptGroups(prev => prev.map(g =>
                  g.prompt.prompt_revid === group.prompt.prompt_revid
                    ? {
                        ...g,
                        executions: g.executions.map(e =>
                          e.documentId === execution.documentId
                            ? { ...e, status: 'completed' as const }
                            : e
                        ),
                        completedExecutions: g.completedExecutions + 1
                      }
                    : g
                ));

                // Update progress
                setCompletedExecutions(prev => {
                  const newCompleted = prev + 1;
                  if (onProgress) {
                    onProgress(newCompleted);
                  }
                  return newCompleted;
                });

              } catch (error) {
                console.error(`Error running LLM for document ${execution.documentId}:`, error);

                // Update status to error
                setPromptGroups(prev => prev.map(g =>
                  g.prompt.prompt_revid === group.prompt.prompt_revid
                    ? {
                        ...g,
                        executions: g.executions.map(e =>
                          e.documentId === execution.documentId
                            ? {
                                ...e,
                                status: 'error' as const,
                                error: error instanceof Error ? error.message : 'Unknown error'
                              }
                            : e
                        )
                      }
                    : g
                ));

                // Still update progress counter for failed executions
                setCompletedExecutions(prev => {
                  const newCompleted = prev + 1;
                  if (onProgress) {
                    onProgress(newCompleted);
                  }
                  return newCompleted;
                });
              }
            });

            // Wait for batch to complete before starting next batch
            await Promise.all(batchPromises);
          }
        }

        toast.success(`Completed LLM execution on ${totalExecutions} document-prompt combinations`);

        if (onComplete) {
          onComplete();
        }

      } catch (error) {
        console.error('Error during bulk LLM execution:', error);
        toast.error('Failed to complete bulk LLM execution');
      } finally {
        setIsExecuting(false);
      }
    };

    useImperativeHandle(ref, () => ({
      executeRunLLM
    }));

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'running':
          return <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
        case 'completed':
          return <div className="w-3 h-3 bg-green-500 rounded-full" />;
        case 'error':
          return <div className="w-3 h-3 bg-red-500 rounded-full" />;
        default:
          return <div className="w-3 h-3 bg-gray-300 rounded-full" />;
      }
    };

    return (
      <div className="space-y-4">
        {/* Tag Selection */}
        <SingleTagSelector
          availableTags={availableTags}
          selectedTag={selectedTag}
          onChange={setSelectedTag}
          disabled={disabled || isExecuting}
          placeholder="Select a tag for LLM operations..."
          label="Select Tag for LLM Operations"
        />

        {/* Analysis Status */}
        {isAnalyzing && (
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Analyzing required executions...
          </div>
        )}

        {/* Execution Summary */}
        {selectedTag && !isAnalyzing && (
          <div className="bg-gray-50 rounded-md p-3">
            <div className="text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-medium">Tag: {selectedTag.name}</span>
                <span className="text-gray-500">
                  {totalExecutions} executions needed
                </span>
              </div>
              {isExecuting && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Progress</span>
                    <span>{completedExecutions} / {totalExecutions}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prompt Groups */}
        {promptGroups.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Execution Details</h4>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {promptGroups.map((group) => (
                <div key={group.prompt.prompt_revid} className="border border-gray-200 rounded-md">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-sm text-gray-900">
                          {group.prompt.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          v{group.prompt.prompt_version}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {group.completedExecutions} / {group.totalExecutions}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-1 max-h-32 overflow-y-auto">
                    {group.executions.map((execution) => (
                      <div key={`${execution.documentId}`} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 truncate max-w-[200px]">
                          {execution.documentName}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getStatusIcon(execution.status)}
                          <span className={`capitalize ${
                            execution.status === 'completed' ? 'text-green-600' :
                            execution.status === 'error' ? 'text-red-600' :
                            execution.status === 'running' ? 'text-blue-600' :
                            'text-gray-500'
                          }`}>
                            {execution.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No executions needed */}
        {selectedTag && !isAnalyzing && promptGroups.length === 0 && totalExecutions === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">
            All documents already have the latest prompt results for this tag.
          </div>
        )}
      </div>
    );
  }
);

DocumentBulkRunLLM.displayName = 'DocumentBulkRunLLM';