import React, { createContext, useContext, useState, useCallback } from 'react';
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

interface OCRContextType {
  ocrBlocks: OCRBlock[] | null;
  loadOCRBlocks: (organizationId: string, documentId: string) => Promise<void>;
  findBlocksForText: (text: string) => OCRBlock[];
  isLoading: boolean;
  error: string | null;
}

const OCRContext = createContext<OCRContextType | undefined>(undefined);

export function OCRProvider({ children }: { children: React.ReactNode }) {
  const [ocrBlocks, setOCRBlocks] = useState<OCRBlock[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use a simple in-memory cache
  const blockCache = new Map<string, OCRBlock[]>();

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
  }, []);

  const findBlocksForText = useCallback((searchText: string): OCRBlock[] => {
    if (!ocrBlocks) return [];

    // Find blocks that contain the exact text
    return ocrBlocks.filter(block => 
      block.BlockType === 'WORD' && 
      block.Text && 
      block.Text.toLowerCase() === searchText.toLowerCase()
    );
  }, [ocrBlocks]);

  return (
    <OCRContext.Provider value={{ 
      ocrBlocks, 
      loadOCRBlocks, 
      findBlocksForText,
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