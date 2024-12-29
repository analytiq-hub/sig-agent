'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import Link from 'next/link';
import { Button, Divider } from '@mui/material';

const DevelopmentPage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="system_development" />
  );
};

export default DevelopmentPage;
