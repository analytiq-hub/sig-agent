'use client'

import React, { useEffect, useState } from 'react';

interface FeedbackItem {
  _id: string;
  content: string;
  email: string;
  userName: string | null;
  createdAt: string;
  status: string;
}

const FeedbackAdmin: React.FC = () => {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Format date without date-fns
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    
    // Format date: "Mar 15, 2023 2:30 PM"
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const response = await fetch('/api/admin/feedback');
        
        if (!response.ok) {
          throw new Error('Failed to fetch feedback');
        }
        
        const data = await response.json();
        setFeedback(data.feedback);
      } catch (err) {
        setError('Error loading feedback. Please try again later.');
        console.error('Error fetching feedback:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, []);

  if (isLoading) {
    return <div className="text-center py-8">Loading feedback...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }

  if (feedback.length === 0) {
    return <div className="text-center py-8">No feedback submissions yet.</div>;
  }

  return (
    <div className="space-y-6">
      {feedback.map((item) => (
        <div key={item._id} className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-medium text-gray-900">
                {item.userName || 'Anonymous User'}
              </h3>
              <p className="text-sm text-gray-500">{item.email}</p>
            </div>
            <div className="text-sm text-gray-500">
              {formatDate(item.createdAt)}
            </div>
          </div>
          
          <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
          
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
            <span className={`px-2 py-1 text-xs rounded-full ${
              item.status === 'new' 
                ? 'bg-blue-100 text-blue-800' 
                : item.status === 'reviewed' 
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {item.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FeedbackAdmin;