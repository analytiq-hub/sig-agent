import React, { useEffect, useState, useCallback } from 'react';
import { ChevronDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { getLLMResultApi, listPromptsApi, runLLMApi } from '@/utils/api';
import type { Prompt } from '@/types/index';
import { useOCR, OCRProvider } from '@/contexts/OCRContext';
import type { OCRBlock } from '@/types/index';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface Props {
  organizationId: string;
  id: string;
  onHighlight?: (blocks: OCRBlock[]) => void;
  onClearHighlight?: () => void;
}

const PDFLeftSidebarContent = ({ organizationId, id, onHighlight, onClearHighlight }: Props) => {
  const { loadOCRBlocks, findBlocksForText } = useOCR();
  const [llmResults, setLlmResults] = useState<Record<string, Record<string, JsonValue>>>({});
  const [matchingPrompts, setMatchingPrompts] = useState<Prompt[]>([]);
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());
  const [expandedPrompt, setExpandedPrompt] = useState<string>('default');
  const [loadingPrompts, setLoadingPrompts] = useState<Set<string>>(new Set());
  const [failedPrompts, setFailedPrompts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const promptsResponse = await listPromptsApi({organizationId: organizationId, document_id: id, limit: 100 });
        setMatchingPrompts(promptsResponse.prompts);
        
        // Fetch default prompt results
        setLoadingPrompts(prev => new Set(prev).add('default'));
        try {
          const defaultResults = await getLLMResultApi({
            organizationId: organizationId,
            documentId: id, 
            promptId: 'default',
          });
          setLlmResults(prev => ({
            ...prev,
            default: defaultResults.llm_result
          }));
        } catch (error) {
          console.error('Error fetching LLM results:', error);
          setFailedPrompts(prev => new Set(prev).add('default'));
        } finally {
          setLoadingPrompts(prev => {
            const newSet = new Set(prev);
            newSet.delete('default');
            return newSet;
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, organizationId]);

  useEffect(() => {
    // Load OCR blocks in the background
    loadOCRBlocks(organizationId, id);
  }, [id, organizationId, loadOCRBlocks]);

  const handlePromptChange = async (promptId: string) => {
    if (expandedPrompt === promptId) {
      setExpandedPrompt('');
      return;
    }

    setExpandedPrompt(promptId);
    
    if (!llmResults[promptId]) {
      setLoadingPrompts(prev => new Set(prev).add(promptId));
      try {
        const results = await getLLMResultApi({
          organizationId: organizationId,
          documentId: id, 
          promptId: promptId,
        });
        setLlmResults(prev => ({
          ...prev,
          [promptId]: results.llm_result
        }));
        setFailedPrompts(prev => {
          const newSet = new Set(prev);
          newSet.delete(promptId);
          return newSet;
        });
      } catch (error) {
        console.error('Error fetching LLM results:', error);
        setFailedPrompts(prev => new Set(prev).add(promptId));
      } finally {
        setLoadingPrompts(prev => {
          const newSet = new Set(prev);
          newSet.delete(promptId);
          return newSet;
        });
      }
    }
  };

  const handleRunPrompt = async (promptId: string) => {
    setRunningPrompts(prev => new Set(prev).add(promptId));
    setFailedPrompts(prev => {
      const newSet = new Set(prev);
      newSet.delete(promptId);
      return newSet;
    });
    
    try {
      await runLLMApi({
        organizationId: organizationId,
        documentId: id, 
        promptId: promptId,
        force: true,
      });
      const results = await getLLMResultApi({
        organizationId: organizationId,
        documentId: id, 
        promptId: promptId,
      });
      setLlmResults(prev => ({
        ...prev,
        [promptId]: results.llm_result
      }));
    } catch (error) {
      console.error('Error running prompt:', error);
      setFailedPrompts(prev => new Set(prev).add(promptId));
    } finally {
      setRunningPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }
  };

  const handleMouseEnter = useCallback((text: string) => {
    const blocks = findBlocksForText(text);
    onHighlight?.(blocks);
  }, [findBlocksForText, onHighlight]);

  const handleMouseLeave = useCallback(() => {
    onClearHighlight?.();
  }, [onClearHighlight]);

  const renderPromptResults = (promptId: string) => {
    const results = llmResults[promptId] || {};
    
    if (loadingPrompts.has(promptId)) {
      return (
        <div className="bg-white p-4 flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-sm text-gray-600">Loading...</span>
          <div className="w-4 h-4 border-2 border-gray-400/60 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    // If no results exist and the prompt has failed
    if (Object.keys(results).length === 0 && failedPrompts.has(promptId)) {
      return (
        <div className="bg-white p-4 flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-sm text-gray-600">
            No extractions available for this prompt
          </span>
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleRunPrompt(promptId);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
          >
            {runningPrompts.has(promptId) ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400/60 border-t-transparent rounded-full animate-spin" />
                Running analysis...
              </>
            ) : (
              <>
                <ArrowPathIcon className="w-4 h-4" />
                Run extraction
              </>
            )}
          </div>
        </div>
      );
    }

    // Regular results display
    return (
      <div className="bg-white pt-1">
        {Object.entries(results).map(([key, value]) => (
          <div 
            key={key} 
            className="px-4 pb-3"
            onMouseEnter={() => handleMouseEnter(String(value))}
            onMouseLeave={handleMouseLeave}
          >
            <span className="text-[0.7rem] text-black/70 mb-1 inline-block underline decoration-black/30 decoration-1 underline-offset-2">
              {key}
            </span>
            <div className="text-[0.875rem] text-gray-900 font-medium whitespace-pre-wrap break-words pl-1">
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col border-r border-black/10">
      <div className="h-12 min-h-[48px] flex items-center px-4 bg-gray-100 text-black font-bold border-b border-black/10">
        Available Prompts
      </div>
      
      <div className="overflow-auto flex-grow">
        {/* Default Prompt */}
        <div className="border-b border-black/10">
          <div
            onClick={() => handlePromptChange('default')}
            className="w-full min-h-[48px] flex items-center justify-between px-4 bg-gray-100/[0.6] hover:bg-gray-100/[0.8] transition-colors cursor-pointer"
          >
            <span className="text-sm text-gray-900">Default Prompt</span>
            <div className="flex items-center gap-2">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunPrompt('default');
                }}
                className="p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
              >
                {runningPrompts.has('default') ? (
                  <div className="w-4 h-4 border-2 border-[#2B4479]/60 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowPathIcon className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <ChevronDownIcon 
                className={`w-5 h-5 text-gray-600 transition-transform ${
                  expandedPrompt === 'default' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
          <div 
            className={`transition-all duration-200 ease-in-out bg-white ${
              expandedPrompt === 'default' ? '' : 'hidden'
            }`}
          >
            {renderPromptResults('default')}
          </div>
        </div>

        {/* Other Prompts */}
        {matchingPrompts.map((prompt) => (
          <div key={prompt.id} className="border-b border-black/10">
            <div
              onClick={() => handlePromptChange(prompt.id)}
              className="w-full min-h-[48px] flex items-center justify-between px-4 bg-gray-100/[0.6] hover:bg-gray-100/[0.8] transition-colors cursor-pointer"
            >
              <span className="text-sm text-gray-900">
                {prompt.name} <span className="text-gray-500 text-xs">(v{prompt.version})</span>
              </span>
              <div className="flex items-center gap-2">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunPrompt(prompt.id);
                  }}
                  className="p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
                >
                  {runningPrompts.has(prompt.id) ? (
                    <div className="w-4 h-4 border-2 border-[#2B4479]/60 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowPathIcon className="w-4 h-4 text-gray-600" />
                  )}
                </div>
                <ChevronDownIcon 
                  className={`w-5 h-5 text-gray-600 transition-transform ${
                    expandedPrompt === prompt.id ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
            <div 
              className={`transition-all duration-200 ease-in-out ${
                expandedPrompt === prompt.id ? '' : 'hidden'
              }`}
            >
              {renderPromptResults(prompt.id)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Wrap the component with OCRProvider
const PDFLeftSidebar = (props: Props) => {
  return (
    <OCRProvider>
      <PDFLeftSidebarContent {...props} />
    </OCRProvider>
  );
};

export default PDFLeftSidebar;
