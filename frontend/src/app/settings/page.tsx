'use client'

import React, { useState } from 'react';
import SettingsLayout from '@/components/SettingsLayout';

const SettingsPage: React.FC = () => {
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);

  return (
    <SettingsLayout
      selectedMenu={selectedMenu ?? undefined}
      onMenuSelect={setSelectedMenu}
    />
  );
};

export default SettingsPage;
