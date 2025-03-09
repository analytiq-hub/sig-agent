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
      if (searchLower.length < 4 && !searchLower.includes(' ')) {
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
              // Instead of adding all blocks, identify the specific words that match
              const matchedSubstring = findMatchedSubstring(match.text, searchLower);
              if (matchedSubstring) {
                const relevantWords = identifyRelevantWords(match.blocks, match.text, matchedSubstring);
                foundBlocks = [...foundBlocks, ...relevantWords];
              } else {
                foundBlocks = [...foundBlocks, ...match.blocks]; // Fallback to all blocks if can't pinpoint
              }
            }
          }
        }
        
        // If no proximity matches, fall back to line matches with word-level precision
        if (!foundInProximity) {
          for (const pageNum in pageIndices) {
            const lineMatches = pageIndices[pageNum].lines.filter(line => 
              line.text.includes(searchLower)
            );
            
            for (const lineMatch of lineMatches) {
              // Find the specific words in the line that contribute to the match
              const wordsInLine = pageIndices[pageNum].words.filter(word => {
                const wordBlock = word.block;
                const lineBlock = lineMatch.block;
                
                // Check if word is contained within this line's bounding box
                return wordBlock.Page === lineBlock.Page &&
                       wordBlock.Geometry.BoundingBox.Left >= lineBlock.Geometry.BoundingBox.Left - 0.01 &&
                       wordBlock.Geometry.BoundingBox.Top >= lineBlock.Geometry.BoundingBox.Top - 0.01 &&
                       wordBlock.Geometry.BoundingBox.Left + wordBlock.Geometry.BoundingBox.Width <= 
                         lineBlock.Geometry.BoundingBox.Left + lineBlock.Geometry.BoundingBox.Width + 0.01 &&
                       wordBlock.Geometry.BoundingBox.Top + wordBlock.Geometry.BoundingBox.Height <= 
                         lineBlock.Geometry.BoundingBox.Top + lineBlock.Geometry.BoundingBox.Height + 0.01;
              });
              
              // For single words, find exact matches within the line
              if (!searchLower.includes(' ')) {
                const exactWordMatches = wordsInLine.filter(word => 
                  word.text === searchLower || 
                  word.text.startsWith(searchLower + ',') || 
                  word.text.startsWith(searchLower + '.') ||
                  word.text.includes(searchLower)
                );
                
                if (exactWordMatches.length > 0) {
                  foundBlocks = [...foundBlocks, ...exactWordMatches.map(w => w.block)];
                } else {
                  // If no exact word matches, fall back to using the line
                  foundBlocks.push(lineMatch.block);
                }
              } 
              // For multi-word searches, try to identify the sequence of words
              else {
                // Create a combined text from words in the line
                const lineWordsText = wordsInLine.map(w => w.text).join(' ');
                
                if (lineWordsText.includes(searchLower)) {
                  // Try to identify the specific sequence of words that match
                  const searchWords = searchLower.split(' ');
                  const matchedWords = identifyMatchingWordSequence(wordsInLine, searchWords);
                  
                  if (matchedWords.length > 0) {
                    foundBlocks = [...foundBlocks, ...matchedWords.map(w => w.block)];
                  } else {
                    // Fallback to using the line
                    foundBlocks.push(lineMatch.block);
                  }
                } else {
                  // If cannot match the sequence, use the line
                  foundBlocks.push(lineMatch.block);
                }
              }
            }
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

// Helper functions to identify specific matches

// Find the start and end indices of the matched substring within the text
function findMatchedSubstring(text: string, search: string): { start: number, end: number } | null {
  const index = text.indexOf(search);
  if (index === -1) return null;
  return { start: index, end: index + search.length };
}

// Identify which word blocks contribute to the matched substring
function identifyRelevantWords(blocks: OCRBlock[], fullText: string, match: { start: number, end: number }): OCRBlock[] {
  // This is a simplified implementation - in a real scenario, you'd need to track
  // character offsets to precisely map text positions to blocks
  
  // As a simple approach, if search is a single word, find blocks that match it
  const searchText = fullText.substring(match.start, match.end);
  const words = searchText.split(' ');
  
  if (words.length === 1) {
    // For single word search, find exact matches
    return blocks.filter(block => 
      block.Text?.toLowerCase() === searchText || 
      block.Text?.toLowerCase().startsWith(searchText + ',') ||
      block.Text?.toLowerCase().startsWith(searchText + '.')
    );
  } else {
    // For multi-word search, try to find the sequence of words
    return identifyMatchingWordSequence(
      blocks.map(block => ({ text: block.Text?.toLowerCase() || '', block })),
      words
    ).map(match => match.block);
  }
}

// Identify a sequence of word blocks that match the search words
function identifyMatchingWordSequence(
  wordEntries: { text: string, block: OCRBlock }[], 
  searchWords: string[]
): { text: string, block: OCRBlock }[] {
  const result: { text: string, block: OCRBlock }[] = [];
  
  // Sort words by position (left to right)
  const sortedWords = [...wordEntries].sort((a, b) => {
    return a.block.Geometry.BoundingBox.Left - b.block.Geometry.BoundingBox.Left;
  });
  
  // Try to find consecutive words that match the search sequence
  let matchStartIdx = -1;
  
  for (let i = 0; i <= sortedWords.length - searchWords.length; i++) {
    let allMatch = true;
    
    for (let j = 0; j < searchWords.length; j++) {
      const wordText = sortedWords[i + j].text;
      const searchWord = searchWords[j];
      
      // Check if word matches, including with trailing punctuation
      if (!wordText.startsWith(searchWord) && 
          wordText !== searchWord && 
          !wordText.startsWith(searchWord + ',') && 
          !wordText.startsWith(searchWord + '.')) {
        allMatch = false;
        break;
      }
    }
    
    if (allMatch) {
      matchStartIdx = i;
      break;
    }
  }
  
  // If we found a matching sequence, collect those blocks
  if (matchStartIdx >= 0) {
    for (let i = 0; i < searchWords.length; i++) {
      result.push(sortedWords[matchStartIdx + i]);
    }
  }
  
  return result;
} 