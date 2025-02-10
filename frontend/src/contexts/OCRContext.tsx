import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getOCRBlocksApi } from '@/utils/api';

// Define and export the OCR block types
export interface OCRGeometry {
  BoundingBox: {
    Width: number;
    Height: number;
    Left: number;
    Top: number;
  };
  Polygon: Array<{ X: number; Y: number }>;
}

export interface OCRBlock {
  BlockType: 'PAGE' | 'LINE' | 'WORD';
  Confidence: number;
  Text?: string;
  Geometry: OCRGeometry;
  Id: string;
  Relationships?: Array<{
    Type: string;
    Ids: string[];
  }>;
  Page: number;
}

export interface HighlightInfo {
  blocks: OCRBlock[];
  promptId: string;
  key?: string;
  value: string;
}

interface OCRContextType {
  ocrBlocks: OCRBlock[] | null;
  loadOCRBlocks: (organizationId: string, documentId: string) => Promise<void>;
  findBlocksWithContext: (text: string, promptId: string, key?: string) => HighlightInfo;
  isLoading: boolean;
  error: string | null;
}

const OCRContext = createContext<OCRContextType | undefined>(undefined);

export function OCRProvider({ children }: { children: React.ReactNode }) {
  const [ocrBlocks, setOCRBlocks] = useState<OCRBlock[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Move blockCache to useMemo
  const blockCache = useMemo(() => new Map<string, OCRBlock[]>(), []);

  const loadOCRBlocks = useCallback(async (organizationId: string, documentId: string) => {
    const cacheKey = `${organizationId}-${documentId}`;
    
    // Check cache first
    if (blockCache.has(cacheKey)) {
      setOCRBlocks(blockCache.get(cacheKey)!);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const blocks = await getOCRBlocksApi({ organizationId, documentId });
      
      // Cache the result
      blockCache.set(cacheKey, blocks);
      setOCRBlocks(blocks);
    } catch (err) {
      console.error('Error loading OCR blocks:', err);
      setError('Failed to load OCR data');
    } finally {
      setIsLoading(false);
    }
  }, [blockCache]);

  const findBlocksWithContext = useCallback((searchText: string, promptId: string, key?: string): HighlightInfo => {
    if (!ocrBlocks) return { blocks: [], promptId, key, value: searchText };

    let foundBlocks: OCRBlock[];
    
    // If searchText has no spaces, search for individual words
    if (!searchText.includes(' ')) {
      foundBlocks = ocrBlocks.filter(block => 
        block.BlockType === 'WORD' && 
        block.Text && 
        block.Text.toLowerCase() === searchText.toLowerCase()
      );
    } else {
      // For phrases, search in LINE blocks
      foundBlocks = ocrBlocks.filter(block => {
        if (block.BlockType !== 'LINE' || !block.Text) return false;
        return block.Text.toLowerCase().includes(searchText.toLowerCase());
      });
    }

    return {
      blocks: foundBlocks,
      promptId,
      key,
      value: searchText
    };
  }, [ocrBlocks]);

  return (
    <OCRContext.Provider value={{ 
      ocrBlocks, 
      loadOCRBlocks, 
      findBlocksWithContext,
      isLoading,
      error 
    }}>
      {children}
    </OCRContext.Provider>
  );
}

export function useOCR(): OCRContextType {
  const context = useContext(OCRContext);
  if (context === undefined) {
    throw new Error('useOCR must be used within an OCRProvider');
  }
  return context;
} 