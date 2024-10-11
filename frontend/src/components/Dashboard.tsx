import React, { useState, useEffect, useCallback } from 'react';
import ListFiles from './ListFiles';
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

  return (
    <div className="dashboard">
      <h2>File Dashboard</h2>
      <ListFiles />
    </div>
  );
};

export default Dashboard;
