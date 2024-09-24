import React, { useState, useEffect } from 'react';
import axiosInstance from '../axiosConfig';

interface PDF {
  id: string;
  filename: string;
  upload_date: string;
  uploaded_by: string;
  retrieved_by: string[];
}

const Dashboard: React.FC = () => {
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchPDFs();
  }, []);

  const fetchPDFs = async () => {
    try {
      const response = await axiosInstance.get('/list', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setPdfs(response.data);
    } catch (error) {
      console.error('Failed to fetch PDFs', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axiosInstance.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      fetchPDFs();
      setFile(null);
    } catch (error) {
      console.error('Upload failed', error);
    }
  };

  const handleRetrieve = async (id: string) => {
    try {
      const response = await axiosInstance.get(`/lookup/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'document.pdf');
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('Retrieval failed', error);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold mb-4">PDF Manager Dashboard</h1>
      <form onSubmit={handleUpload} className="mb-8">
        <div className="flex items-center space-x-4">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf"
            className="border p-2 rounded"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Upload PDF
          </button>
        </div>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pdfs.map((pdf) => (
          <div key={pdf.id} className="border p-4 rounded shadow">
            <h3 className="font-bold">{pdf.filename}</h3>
            <p>Uploaded by: {pdf.uploaded_by}</p>
            <p>Upload date: {new Date(pdf.upload_date).toLocaleString()}</p>
            <p>Retrieved by: {pdf.retrieved_by.join(', ') || 'None'}</p>
            <button
              onClick={() => handleRetrieve(pdf.id)}
              className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Retrieve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;