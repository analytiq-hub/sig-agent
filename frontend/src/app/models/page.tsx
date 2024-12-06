'use client'

import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import Schemas from '@/components/Schemas';
import Models from '@/components/Models';

const ModelsPage = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <div className="container mx-auto p-4">
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              minWidth: 120,
            },
            '& .Mui-selected': {
              color: 'primary.main',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'primary.main',
              height: 3,
            },
          }}
        >
          <Tab label="Schemas" />
          <Tab label="Models" />
        </Tabs>
      </Box>

      <div role="tabpanel" hidden={activeTab !== 0}>
        {activeTab === 0 && <Schemas />}
      </div>
      <div role="tabpanel" hidden={activeTab !== 1}>
        {activeTab === 1 && <Models />}
      </div>
    </div>
  );
};

export default ModelsPage;
