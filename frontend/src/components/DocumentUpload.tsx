'use client'

import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button, Typography, CircularProgress, IconButton } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { 
  uploadDocumentsApi,
  listTagsApi
} from '@/utils/api';
import { Tag } from '@/types/index';
import { DocumentWithContent } from '@/types/index';
import { isColorLight } from '@/utils/colors';
import InfoTooltip from '@/components/InfoTooltip';

interface DocumentUploadProps {
  organizationId: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ organizationId }) => {
  const [files, setFiles] = useState<DocumentWithContent[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  // Fetch available tags on component mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await listTagsApi({ organizationId });
        setAvailableTags(response.tags);
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, [organizationId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const readFiles = acceptedFiles.map(file => 
      new Promise<DocumentWithContent>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            content: reader.result as string,
            tag_ids: selectedTags // Include selected tags with each file
          });
        };
        reader.readAsDataURL(file);
      })
    );

    Promise.all(readFiles).then(newFiles => {
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    });
  }, [selectedTags]); // Add selectedTags as dependency

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md']
    },
    multiple: true
  });

  const handleUpload = async () => {
    if (files.length === 0) return;

    // Add selected tags to each file before upload
    const filesWithTags = files.map(file => ({
      ...file,
      tag_ids: selectedTags
    }));

    setUploading(true);
    setUploadStatus(null);

    try {
      const response = await uploadDocumentsApi({
        organizationId, 
        documents: filesWithTags
      });
      
      // Create a more detailed success message
      const fileNames = files.map(file => file.name).join(", ");
      const tagNames = selectedTags.length > 0 
        ? availableTags
            .filter(tag => selectedTags.includes(tag.id))
            .map(tag => tag.name)
            .join(", ")
        : "no tags";
      
      setUploadStatus(`Successfully uploaded ${response.uploaded_documents.length} file(s): ${fileNames} with ${tagNames}`);
      
      setFiles([]);
      setSelectedTags([]); // Reset selected tags after successful upload
      setActiveStep(0); // Reset to first step
    } catch (error) {
      console.error('Error uploading files:', error);
      setUploadStatus('Error uploading files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleNextStep = useCallback(() => {
    setActiveStep((prev) => Math.min(prev + 1, 2));
    // Clear upload status when moving between steps
    if (uploadStatus) {
      setUploadStatus(null);
    }
  }, [uploadStatus]);

  const handlePrevStep = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
    // Clear upload status when moving between steps
    if (uploadStatus) {
      setUploadStatus(null);
    }
  }, [uploadStatus]);

  const handleDeleteFile = useCallback((fileName: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
    
    // If no files left, go back to step 1
    if (files.length === 1) {
      setActiveStep(0);
      // Clear upload status when returning to step 1
      if (uploadStatus) {
        setUploadStatus(null);
      }
    }
  }, [files.length, uploadStatus]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="hidden md:flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Upload Documents</h2>
        <InfoTooltip 
          title="Document Upload"
          content={
            <>
              <p className="mb-2">
                Upload documents to be processed by AI prompts. Supported file formats:
              </p>
              <ul className="list-disc list-inside space-y-1 mb-2">
                <li><strong>PDF files</strong> (.pdf)</li>
                <li><strong>Word documents</strong> (.doc, .docx)</li>
                <li><strong>Excel files</strong> (.xls, .xlsx)</li>
                <li><strong>CSV files</strong> (.csv)</li>
                <li><strong>Text files</strong> (.txt)</li>
              </ul>
              <p className="mb-2">
                <strong>Note:</strong> Select appropriate tags for your documents to control which prompts are run.
              </p>
            </>
          }
        />
      </div>
      
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div 
            className={`flex flex-col items-center ${activeStep >= 0 ? 'text-blue-600' : 'text-gray-400'}`}
            onClick={() => setActiveStep(0)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${activeStep >= 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              1
            </div>
            <span className="text-sm">Select Files</span>
          </div>
          <div className={`flex-1 h-1 mx-2 ${activeStep >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div 
            className={`flex flex-col items-center ${activeStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}
            onClick={() => files.length > 0 && setActiveStep(1)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${activeStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              2
            </div>
            <span className="text-sm">Select Tags (Optional)</span>
          </div>
          <div className={`flex-1 h-1 mx-2 ${activeStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div 
            className={`flex flex-col items-center ${activeStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}
            onClick={() => files.length > 0 && setActiveStep(2)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${activeStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              3
            </div>
            <span className="text-sm">Upload</span>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        {/* Step 1: Select Files */}
        {activeStep === 0 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Select Files</h3>
            
            <div className="flex items-center mb-3">
              <span className="mr-2">Supported formats:</span>
              <div className="flex items-center bg-gray-100 rounded-full px-3 py-1 mr-2">
                <PictureAsPdfIcon className="text-red-600 mr-1" fontSize="small" />
                <span className="text-sm">PDF</span>
              </div>
            </div>
            
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <input {...getInputProps()} />
              <CloudUploadIcon sx={{ fontSize: 48, mb: 2, color: '#4B5563' }} />
              {isDragActive ? (
                <Typography>Drop files here ...</Typography>
              ) : (
                <Typography>Drag files here, or click to select files</Typography>
              )}
            </div>
            
            {files.length > 0 && (
              <div className="mt-4">
                <Typography variant="subtitle1" className="text-left mb-2">Selected files:</Typography>
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {files.map((file) => (
                    <div key={file.name} className="text-left py-1 px-2 odd:bg-gray-50 flex justify-between items-center">
                      <span>{file.name}</span>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteFile(file.name)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <Button
                variant="contained"
                color="primary"
                onClick={handleNextStep}
                disabled={files.length === 0}
              >
                Continue
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 2: Select Tags */}
        {activeStep === 1 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Select Tags (Optional)</h3>
            
            <div className="mb-4 bg-gray-50 p-3 rounded-lg">
              <h4 className="font-medium mb-2">Selected Files:</h4>
              <div className="max-h-40 overflow-y-auto">
                {files.map((file) => (
                  <div key={file.name} className="text-left py-1 px-2 odd:bg-gray-50 flex justify-between items-center">
                    <span>{file.name}</span>
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteFile(file.name)}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Select appropriate tags for your documents to ensure they&apos;re processed by the right prompts.
                <span className="italic ml-1">This step is optional.</span>
              </p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag.id)
                          ? prev.filter(id => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                    className={`group transition-all ${
                      selectedTags.includes(tag.id)
                        ? 'ring-2 ring-blue-500 ring-offset-2'
                        : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2'
                    }`}
                  >
                    <div className="flex items-center h-full w-full">
                      <div 
                        className={`px-2 py-1 leading-none rounded shadow-sm flex items-center gap-2 text-sm ${
                          isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                        }`}
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                        {selectedTags.includes(tag.id) && (
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mt-6 flex justify-between">
              <Button
                variant="outlined"
                onClick={handlePrevStep}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleNextStep}
              >
                Continue
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Upload */}
        {activeStep === 2 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Upload Files</h3>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="mb-4">
                <h4 className="font-medium mb-2">Selected Files:</h4>
                <div className="text-sm text-gray-600">
                  {files.map((file) => (
                    <div key={file.name} className="mb-1 flex justify-between items-center">
                      <span>{file.name}</span>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteFile(file.name)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Selected Tags:</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedTags.length > 0 ? (
                    availableTags
                      .filter(tag => selectedTags.includes(tag.id))
                      .map(tag => (
                        <div
                          key={tag.id}
                          className={`px-2 py-1 rounded text-xs ${
                            isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                          }`}
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </div>
                      ))
                  ) : (
                    <span className="text-gray-500 text-sm italic">No tags selected</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-between">
              <Button
                variant="outlined"
                onClick={handlePrevStep}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleUpload}
                disabled={uploading}
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
              >
                {uploading ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {uploadStatus && (
        <div className={`mt-4 p-4 rounded-lg ${uploadStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {uploadStatus}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;