import React, { useEffect, useState } from 'react';
import { ChevronDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { getLLMResultApi, getPromptsApi, runLLMAnalysisApi } from '@/utils/api';
import type { Prompt } from '@/utils/api';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PDFLeftSidebar = ({ id }: { id: string }) => {
  const [llmResults, setLlmResults] = useState<Record<string, Record<string, JsonValue>>>({});
  const [matchingPrompts, setMatchingPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('default');
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());
  const [expandedPrompt, setExpandedPrompt] = useState<string>('default');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const promptsResponse = await getPromptsApi({ document_id: id, limit: 100 });
        setMatchingPrompts(promptsResponse.prompts);
        
        // Fetch default prompt results
        const defaultResults = await getLLMResultApi(id);
        setLlmResults(prev => ({
          ...prev,
          default: defaultResults.llm_result
        }));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const handlePromptChange = async (promptId: string) => {
    if (expandedPrompt === promptId) {
      setExpandedPrompt('');
      return;
    }

    setExpandedPrompt(promptId);
    
    if (!llmResults[promptId]) {
      try {
        const results = await getLLMResultApi(id, promptId);
        setLlmResults(prev => ({
          ...prev,
          [promptId]: results.llm_result
        }));
      } catch (error) {
        console.error('Error fetching LLM results:', error);
      }
    }
  };

  const handleRunPrompt = async (promptId: string) => {
    setRunningPrompts(prev => new Set(prev).add(promptId));
    try {
      await runLLMAnalysisApi(id, promptId, true);
      const results = await getLLMResultApi(id, promptId);
      setLlmResults(prev => ({
        ...prev,
        [promptId]: results.llm_result
      }));
    } catch (error) {
      console.error('Error running prompt:', error);
    } finally {
      setRunningPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }
  };

  const renderPromptResults = (promptId: string) => {
    const results = llmResults[promptId] || {};
    
    // If no results exist for this prompt
    if (Object.keys(results).length === 0) {
      return (
        <div className="bg-white p-4 flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-sm text-gray-600">
            No extractions available for this prompt
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRunPrompt(promptId);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
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
          </button>
        </div>
      );
    }

    // Regular results display
    return (
      <div className="bg-white pt-1">
        {Object.entries(results).map(([key, value]) => (
          <div key={key} className="px-4 pb-3">
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
          <button
            onClick={() => handlePromptChange('default')}
            className="w-full min-h-[48px] flex items-center justify-between px-4 bg-gray-100/[0.6] hover:bg-gray-100/[0.8] transition-colors"
          >
            <span className="text-sm text-gray-900">Default Prompt</span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunPrompt('default');
                }}
                className="p-1 rounded-full hover:bg-black/5 transition-colors"
              >
                {runningPrompts.has('default') ? (
                  <div className="w-4 h-4 border-2 border-[#2B4479]/60 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowPathIcon className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <ChevronDownIcon 
                className={`w-5 h-5 text-gray-600 transition-transform ${
                  expandedPrompt === 'default' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>
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
            <button
              onClick={() => handlePromptChange(prompt.id)}
              className="w-full min-h-[48px] flex items-center justify-between px-4 bg-gray-100/[0.6] hover:bg-gray-100/[0.8] transition-colors"
            >
              <span className="text-sm text-gray-900">
                {prompt.name} <span className="text-gray-500 text-xs">(v{prompt.version})</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunPrompt(prompt.id);
                  }}
                  className="p-1 rounded-full hover:bg-black/5 transition-colors"
                >
                  {runningPrompts.has(prompt.id) ? (
                    <div className="w-4 h-4 border-2 border-[#2B4479]/60 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowPathIcon className="w-4 h-4 text-gray-600" />
                  )}
                </button>
                <ChevronDownIcon 
                  className={`w-5 h-5 text-gray-600 transition-transform ${
                    expandedPrompt === prompt.id ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>
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

export default PDFLeftSidebar;
