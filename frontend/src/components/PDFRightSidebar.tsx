import React, { useEffect, useState } from 'react';
import { Box, Typography, Divider, CircularProgress } from '@mui/material';
import { getOCRMetadataApi, getOCRTextApi } from '@/utils/api';
import { GetOCRMetadataResponse } from '@/types/index';

const PDFRightSidebar = ({ id }: { id: string }) => {
  const [metadata, setMetadata] = useState<GetOCRMetadataResponse | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOCRData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First get metadata to know number of pages
        const meta = await getOCRMetadataApi({
          organizationId: "org_unknown",
          documentId: id
        });
        setMetadata(meta);

        // Then fetch text for each page
        const pagePromises = Array.from({ length: meta.n_pages }, (_, i) => 
          getOCRTextApi({
            organizationId: "org_unknown",
            documentId: id,
            pageNum: i + 1
          })
        );
        const pageTexts = await Promise.all(pagePromises);
        setPages(pageTexts);
      } catch (err) {
        console.error('Error fetching OCR data:', err);
        setError('Failed to load OCR data');
      } finally {
        setLoading(false);
      }
    };

    fetchOCRData();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, color: 'error.main' }}>
        <Typography>{error}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        overflow: 'auto',
      }}
    >
      <Typography variant="h6" sx={{ p: 2 }}>
        OCR Text
      </Typography>
      {metadata && (
        <Typography variant="body2" sx={{ px: 2, pb: 1, color: 'text.secondary' }}>
          Processed: {new Date(metadata.ocr_date).toLocaleString()}
        </Typography>
      )}
      {pages.map((pageText, index) => (
        <React.Fragment key={index}>
          {index > 0 && <Divider sx={{ my: 2 }} />}
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              Page {index + 1}
            </Typography>
            <Typography
              variant="body2"
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace'
              }}
            >
              {pageText}
            </Typography>
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
};

export default PDFRightSidebar;
