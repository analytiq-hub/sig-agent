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

    // 1. Pre-process the search text for better matching
    const searchLower = searchText.toLowerCase().trim();
    
    // 2. Build page-level text indices for more natural searching
    const pageIndices: Record<number, {
      lines: { text: string; block: OCRBlock }[];
      words: { text: string; block: OCRBlock }[];
      proximityGroups: { text: string; blocks: OCRBlock[] }[];
    }> = {};
    
    // Organize blocks by page
    for (const block of ocrBlocks) {
      if (!block.Text) continue;
      
      const page = block.Page;
      if (!pageIndices[page]) {
        pageIndices[page] = { 
          lines: [], 
          words: [],
          proximityGroups: []
        };
      }
      
      if (block.BlockType === 'LINE') {
        pageIndices[page].lines.push({ text: block.Text.toLowerCase(), block });
      } else if (block.BlockType === 'WORD') {
        pageIndices[page].words.push({ text: block.Text.toLowerCase(), block });
      }
    }
    
    // 3. Build proximity groups (words that are close to each other)
    for (const pageNum in pageIndices) {
      const page = pageIndices[pageNum];
      
      // Simple implementation: group words in the same line
      // You could enhance this with more sophisticated spatial grouping
      for (const line of page.lines) {
        const lineWords = page.words.filter(word => {
          const wordBlock = word.block;
          const lineBlock = line.block;
          
          // Check if word is contained within line's bounding box (with some margin)
          return wordBlock.Page === lineBlock.Page &&
                 wordBlock.Geometry.BoundingBox.Left >= lineBlock.Geometry.BoundingBox.Left - 0.01 &&
                 wordBlock.Geometry.BoundingBox.Top >= lineBlock.Geometry.BoundingBox.Top - 0.01 &&
                 wordBlock.Geometry.BoundingBox.Left + wordBlock.Geometry.BoundingBox.Width <= 
                   lineBlock.Geometry.BoundingBox.Left + lineBlock.Geometry.BoundingBox.Width + 0.01 &&
                 wordBlock.Geometry.BoundingBox.Top + wordBlock.Geometry.BoundingBox.Height <= 
                   lineBlock.Geometry.BoundingBox.Top + lineBlock.Geometry.BoundingBox.Height + 0.01;
        });
        
        if (lineWords.length > 0) {
          page.proximityGroups.push({
            text: lineWords.map(w => w.text).join(' '),
            blocks: lineWords.map(w => w.block)
          });
        }
      }
    }
    
    // 4. PDF.js-like search function
    let foundBlocks: OCRBlock[] = [];
    
    // Search logic inspired by PDF.js
    const searchForText = () => {
      // For exact word matches (especially short terms)
      if (searchLower.length < 4 && !searchLower.includes(' ') && !/[+#*@$&%]/.test(searchLower)) {
        // Find exact word matches for short terms without special chars
        for (const pageNum in pageIndices) {
          const exactMatches = pageIndices[pageNum].words.filter(word => 
            word.text === searchLower || 
            word.text.startsWith(searchLower + ',') || 
            word.text.startsWith(searchLower + '.') ||
            word.text.startsWith(searchLower + ';') ||
            word.text.startsWith(searchLower + ':')
          );
          foundBlocks = [...foundBlocks, ...exactMatches.map(match => match.block)];
        }
      }
      
      // For terms with special characters (like C++, C#)
      else if (/[+#*@$&%]/.test(searchLower)) {
        // Special handling for programming languages and terms with special chars
        for (const pageNum in pageIndices) {
          // Check both individual words and proximity groups
          const wordMatches = pageIndices[pageNum].words.filter(word => 
            word.text.includes(searchLower) || 
            word.text.startsWith(searchLower.replace(/[+#]/g, '')) // Also match C for C++
          );
          
          const lineMatches = pageIndices[pageNum].lines.filter(line =>
            line.text.includes(searchLower)
          );
          
          foundBlocks = [
            ...foundBlocks, 
            ...wordMatches.map(match => match.block),
            ...lineMatches.map(match => match.block)
          ];
        }
      }
      
      // For phrases and longer terms
      else {
        // First try proximity groups (for better phrase matching)
        let foundInProximity = false;
        
        for (const pageNum in pageIndices) {
          const proximityMatches = pageIndices[pageNum].proximityGroups.filter(group => 
            group.text.includes(searchLower)
          );
          
          if (proximityMatches.length > 0) {
            foundInProximity = true;
            for (const match of proximityMatches) {
              foundBlocks = [...foundBlocks, ...match.blocks];
            }
          }
        }
        
        // If no proximity matches, fall back to line matches
        if (!foundInProximity) {
          for (const pageNum in pageIndices) {
            const lineMatches = pageIndices[pageNum].lines.filter(line => 
              line.text.includes(searchLower)
            );
            foundBlocks = [...foundBlocks, ...lineMatches.map(match => match.block)];
          }
        }
      }
    };
    
    searchForText();
    
    // If no results, try fuzzy matching for programming terms
    if (foundBlocks.length === 0 && /^(c\+\+|javascript|typescript|python|java|c#|\.net|ruby|go|rust|php)$/i.test(searchLower)) {
      // Try more lenient matching for common programming languages
      for (const pageNum in pageIndices) {
        // Remove special chars and try again
        const normalizedSearch = searchLower.replace(/[+#.]/g, '');
        
        const wordMatches = pageIndices[pageNum].words.filter(word => 
          word.text.startsWith(normalizedSearch) || 
          (searchLower === 'c++' && word.text === 'c') ||
          (searchLower === 'javascript' && word.text.includes('js'))
        );
        
        foundBlocks = [...foundBlocks, ...wordMatches.map(match => match.block)];
      }
    }
    
    // 5. Return results in HighlightInfo format
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