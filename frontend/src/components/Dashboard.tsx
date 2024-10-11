import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { AppSession } from '@/app/types/AppSession';

interface File {
  id: string;
  filename: string;
  upload_date: string;
  uploaded_by: string;
  retrieved_by: string[];
}

const Dashboard: React.FC = () => {
  const { data: session } = useSession() as { data: AppSession | null };
  const [files, setFiles] = useState<File[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  console.log('session', session);

  const fetchFiles = useCallback(async () => {
    try {
      if (session?.apiAccessToken) {
        const response = await axios.get<File[]>(
          `http://localhost:8000/list?skip=${(currentPage - 1) * itemsPerPage}&limit=${itemsPerPage}`,
          {
            headers: { Authorization: `Bearer ${session.apiAccessToken}` }
          }
        );
        setFiles(response.data);
        const totalCount = parseInt(response.headers['x-total-count'] || '0', 10);
        setTotalPages(Math.ceil(totalCount / itemsPerPage));
      } else {
        console.error('No API access token available');
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  }, [currentPage, session?.apiAccessToken]);

  useEffect(() => {
    fetchFiles();
  }, [currentPage, fetchFiles]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="dashboard">
      <h2>File Dashboard</h2>
      <table>
        <thead>
          <tr>
            <th>Filename</th>
            <th>Upload Date</th>
            <th>Uploaded By</th>
            <th>Retrieved By</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <td>{file.filename}</td>
              <td>{new Date(file.upload_date).toLocaleString()}</td>
              <td>{file.uploaded_by}</td>
              <td>{file.retrieved_by.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
