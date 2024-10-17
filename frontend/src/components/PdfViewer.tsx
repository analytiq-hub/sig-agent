// components/PDFViewer.js
"use client"

import { useEffect, useState, useRef, useCallback } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { downloadFileApi } from '@/utils/api';
import { Toolbar, Typography, IconButton, TextField, Menu, MenuItem, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Button, List, Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { styled } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import PrintIcon from '@mui/icons-material/Print';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { saveAs } from 'file-saver';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  fontSize: '0.875rem',
  padding: '4px 16px',
  '& .MuiListItemIcon-root': {
    minWidth: '32px',
  },
  '& .MuiSvgIcon-root': {
    color: alpha(theme.palette.text.primary, 0.6), // This makes the icons slightly grayer
  },
}));

// Add this styled component
const StyledListItem = styled('li')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-child': {
    borderBottom: 'none',
  },
  '& .property-key': {
    fontWeight: 'bold',
    marginRight: theme.spacing(2),
  },
  '& .property-value': {
    textAlign: 'right',
    wordBreak: 'break-word',
    maxWidth: '60%',
  },
}));

// Add this interface near the top of your file, before the PDFViewer component
interface PDFMetadata {
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  CreationDate?: string;
  ModDate?: string;
  Creator?: string;
  Producer?: string;
  PDFFormatVersion?: string;
}

const PDFViewer = ({ id }: { id: string }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use a fileRef to store the file URL, which doesn't trigger re-renders when it changes.
  // The cleanup function now uses this ref to revoke the URL.
  //This approach resolves the dependency warning without causing unnecessary re-renders.
  const fileRef = useRef<string | null>(null);

  // This is a tricky effect hook. It needs to clean up
  // the file URL when the component unmounts. The hook cleanup can be called while
  // the hook is still running, for example, before the axios request completes.
  // We handle this by checking if isMounted is true before setting the file URL.
  useEffect(() => {
    let isMounted = true;
    //console.log('PDF effect running for id:', id);

    const fetchPDF = async () => {
      try {
        //console.log('Fetching PDF for id:', id);
        const response = await downloadFileApi(id);
        //console.log('PDF download complete for id:', id);
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(blob);
        if (isMounted) {
          setFile(fileURL);
          fileRef.current = fileURL;
          setLoading(false);
          //console.log('PDF loaded successfully for id:', id);

          // Get the filename from the Content-Disposition header
          const contentDisposition = response.headers['content-disposition'];
          console.log('contentDisposition:', contentDisposition);
          const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
          const matches = filenameRegex.exec(contentDisposition);
          const filename = matches && matches[1] ? matches[1].replace(/['"]/g, '') : `Document_${id}.pdf`;

          // Save the file name and file size
          setFileName(filename);
          setFileSize(blob.size);
        } else {
          //console.log('Component unmounted before PDF could be set, cleaning up');
          if (fileURL) {
            URL.revokeObjectURL(fileURL);
          }
        }
      } catch (error) {
        console.error('Error fetching PDF for id:', id, error);
        if (isMounted) {
          setError('Failed to load PDF. Please try again.');
          setLoading(false);
        }
      }
    };

    fetchPDF();

    return () => {
      // The hook cleanup function - called when the component unmounts.
      // It can be called while the hook is still running.
      
      //console.log('PDF effect cleaning up for id:', id);
      isMounted = false;
      if (fileRef.current) {
        URL.revokeObjectURL(fileRef.current);
        //console.log('PDF unloaded from state for id:', id);
      }
      
      setFile(null);
    };
  }, [id]);

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToPage = useCallback((pageNum: number) => {
    if (pageRefs.current[pageNum - 1]) {
      pageRefs.current[pageNum - 1]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToPage(pageNumber);
  }, [pageNumber, scrollToPage]);

  const [showProperties, setShowProperties] = useState(false);
  const [documentProperties, setDocumentProperties] = useState<Record<string, string> | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const extractDocumentProperties = useCallback(async (pdf: pdfjs.PDFDocumentProxy) => {
    try {
      const metadata = await pdf.getMetadata();
      const info = metadata.info as PDFMetadata;

      const properties: Record<string, string> = {
        'File name': fileName,
        'File size': `${formatFileSize(fileSize)} (${fileSize.toLocaleString()} bytes)`,
        'Title': info.Title || 'N/A',
        'Author': info.Author || 'N/A',
        'Subject': info.Subject || 'N/A',
        'Keywords': info.Keywords || 'N/A',
        'Creation Date': info.CreationDate ? new Date(info.CreationDate).toLocaleString() : 'N/A',
        'Modification Date': info.ModDate ? new Date(info.ModDate).toLocaleString() : 'N/A',
        'Creator': info.Creator || 'N/A',
        'Producer': info.Producer || 'N/A',
        'Version': info.PDFFormatVersion || 'N/A',
        'Number of Pages': pdf.numPages.toString(),
      };

      console.log('Extracted properties:', properties);
      setDocumentProperties(properties);
    } catch (error) {
      console.error('Error extracting document properties:', error);
      setDocumentProperties({ 'Error': 'Failed to extract document properties' });
    }
  }, [fileName, fileSize]);

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    pageRefs.current = new Array(numPages).fill(null);
    
    pdfjs.getDocument(file!).promise.then((pdf) => {
      extractDocumentProperties(pdf);  // Extract properties here
      pdf.getPage(1).then((page) => {
        const viewport = page.getViewport({ scale: 1 });
        setPdfDimensions({ width: viewport.width, height: viewport.height });
      });
    });
  };

  const handleLoadError = (error: { message: string }) => {
    setError(error.message);
    console.error('PDF Load Error:', error);
  };

  const goToNextPage = () => {
    if (pageNumber < numPages!) {
      const newPageNumber = pageNumber + 1;
      setPageNumber(newPageNumber);
      setInputPageNumber(newPageNumber.toString());
    }
  };

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      const newPageNumber = pageNumber - 1;
      setPageNumber(newPageNumber);
      setInputPageNumber(newPageNumber.toString());
    }
  };

  const zoomIn = () => setScale(prevScale => Math.min(prevScale + 0.25, 3));
  const zoomOut = () => setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  const rotateLeft = () => setRotation(prevRotation => (prevRotation - 90) % 360);
  const rotateRight = () => setRotation(prevRotation => (prevRotation + 90) % 360);

  // New useEffect to handle auto-zoom
  useEffect(() => {
    if (pdfDimensions.width && pdfDimensions.height && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      const widthScale = containerWidth / pdfDimensions.width;
      const heightScale = containerHeight / pdfDimensions.height;

      // Use the smaller scale to ensure the entire page fits
      // Increase the scaling factor to make the initial display larger
      const optimalScale = Math.min(widthScale, heightScale) * 0.95; // Increased from 0.9 to 0.95

      // Add a minimum scale to ensure the PDF isn't too small
      const adjustedScale = Math.max(optimalScale, 1.0); // Ensure scale is at least 1.0

      setScale(adjustedScale);
    }
  }, [pdfDimensions]);

  const [inputPageNumber, setInputPageNumber] = useState('1');

  const handlePageNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputPageNumber(event.target.value);
  };

  const handlePageNumberSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newPageNumber = parseInt(inputPageNumber, 10);
    if (newPageNumber >= 1 && newPageNumber <= (numPages || 0)) {
      setPageNumber(newPageNumber);
    } else {
      // Reset input to current page number if invalid
      setInputPageNumber(pageNumber.toString());
    }
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handlePrint = () => {
    // Implement print functionality
    handleMenuClose();
  };

  const handleSave = () => {
    if (file) {
      fetch(file)
        .then(response => response.blob())
        .then(blob => {
          const defaultFileName = fileName || `Document_${id}.pdf`;
          saveAs(blob, defaultFileName);
        })
        .catch(error => {
          console.error('Error saving the file:', error);
          // Optionally, you can show an error message to the user here
        });
    }
    handleMenuClose();
  };

  const handleGoToFirstPage = () => {
    setPageNumber(1);
    handleMenuClose();
  };

  const handleGoToLastPage = () => {
    if (numPages) setPageNumber(numPages);
    handleMenuClose();
  };

  const handleDocumentProperties = useCallback(() => {
    setShowProperties(true);
    handleMenuClose();
  }, [handleMenuClose]);

  return (
    <div>
      <Toolbar 
        variant='dense'
        sx={{ 
          backgroundColor: theme => theme.palette.accent.main,
          minHeight: '48px',
          '& .MuiIconButton-root': {
            padding: '4px',
          },
          '& .MuiTypography-root': {
            fontSize: '0.875rem',
          },
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ width: '200px', marginRight: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title={fileName || 'Untitled Document'} arrow>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  maxWidth: '100%',
                  color: theme => theme.palette.accent.contrastText,
                  fontWeight: 'bold',
                  cursor: 'default',
                }}
              >
                {fileName || 'Untitled Document'}
              </Typography>
            </Tooltip>
          </div>
          <IconButton onClick={goToPrevPage} disabled={pageNumber <= 1} color="inherit" size="small">
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)} color="inherit" size="small">
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
          <form onSubmit={handlePageNumberSubmit} style={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              value={inputPageNumber}
              onChange={handlePageNumberChange}
              onBlur={() => setInputPageNumber(pageNumber.toString())}
              type="number"
              size="small"
              slotProps={{
                input: {
                  inputProps: {
                    min: 1,
                    max: numPages || 1,
                    style: { textAlign: 'center' }
                  }
                }
              }}
              sx={{ 
                mx: 0.5,
                width: '50px', // Slightly reduced width
                '& .MuiInputBase-root': {
                  height: '28px', // Make the input field shorter
                },
                '& input': {
                  appearance: 'textfield',
                  '-moz-appearance': 'textfield',
                  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                    '-webkit-appearance': 'none',
                    margin: 0,
                  },
                }
              }}
            />
            <Typography variant="body2" sx={{ mx: 0.5, color: theme => theme.palette.accent.contrastText }}>
              of {numPages}
            </Typography>
          </form>
          <IconButton onClick={zoomOut} color="inherit" size="small">
            <ZoomOutIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={zoomIn} color="inherit" size="small">
            <ZoomInIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={rotateLeft} color="inherit" size="small">
            <RotateLeftIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={rotateRight} color="inherit" size="small">
            <RotateRightIcon fontSize="small" />
          </IconButton>
        </div>
        <IconButton
          color="inherit"
          size="small"
          onClick={handleMenuClick}
          aria-label="more"
          aria-controls={open ? 'pdf-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu
          id="pdf-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          MenuListProps={{
            'aria-labelledby': 'more-button',
          }}
        >
          <StyledMenuItem onClick={handlePrint}>
            <PrintIcon fontSize="small" sx={{ mr: 1 }} />
            Print
          </StyledMenuItem>
          <StyledMenuItem onClick={handleSave}>
            <SaveOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
            Save
          </StyledMenuItem>
          <Divider />
          <StyledMenuItem onClick={handleGoToFirstPage}>
            <VerticalAlignTopIcon fontSize="small" sx={{ mr: 1 }} />
            Go to First Page
          </StyledMenuItem>
          <StyledMenuItem onClick={handleGoToLastPage}>
            <VerticalAlignBottomIcon fontSize="small" sx={{ mr: 1 }} />
            Go to Last Page
          </StyledMenuItem>
          <Divider />
          <StyledMenuItem onClick={rotateRight}>
            <RotateRightIcon fontSize="small" sx={{ mr: 1 }} />
            Rotate Clockwise
          </StyledMenuItem>
          <StyledMenuItem onClick={rotateLeft}>
            <RotateLeftIcon fontSize="small" sx={{ mr: 1 }} />
            Rotate Counterclockwise
          </StyledMenuItem>
          <Divider />
          <StyledMenuItem onClick={handleDocumentProperties}>
            <DescriptionOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
            Document Properties...
          </StyledMenuItem>
        </Menu>
      </Toolbar>
      <div 
        ref={containerRef} 
        style={{ overflowY: 'scroll', height: '80vh', padding: '16px' }}
      >
        {loading ? (
          <div>Loading PDF...</div>
        ) : error ? (
          <Typography color="error" align="center">
            {error}
          </Typography>
        ) : file ? (
          <Document
            file={file}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div 
                key={`page_container_${index + 1}`}
                ref={el => pageRefs.current[index] = el}
              >
                <Page 
                  key={`page_${index + 1}`} 
                  pageNumber={index + 1} 
                  width={pdfDimensions.width * scale}
                  height={pdfDimensions.height * scale}
                  rotate={rotation}
                />
                {index < numPages! - 1 && <hr style={{ border: '2px solid black' }} />}
              </div>
            ))}
          </Document>
        ) : (
          <Typography color="error" align="center">
            No PDF file available.
          </Typography>
        )}
      </div>
      <Dialog 
        open={showProperties} 
        onClose={() => setShowProperties(false)}
        aria-labelledby="document-properties-dialog-title"
        maxWidth="xs" // Changed from "sm" to "xs" for a narrower dialog
        fullWidth
      >
        <DialogTitle id="document-properties-dialog-title">Document Properties</DialogTitle>
        <DialogContent>
          {documentProperties === null ? (
            <Typography>Loading properties...</Typography>
          ) : Object.keys(documentProperties).length === 0 ? (
            <Typography>No properties available</Typography>
          ) : (
            <List sx={{ padding: 0 }}>
              {Object.entries(documentProperties).map(([key, value]) => (
                <StyledListItem key={key}>
                  <Typography component="span" className="property-key">
                    {key}:
                  </Typography>
                  <Typography component="span" className="property-value">
                    {value}
                  </Typography>
                </StyledListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProperties(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default PDFViewer;
