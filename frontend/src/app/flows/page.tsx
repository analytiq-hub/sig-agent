'use client'

import { FlowProvider } from '@/contexts/FlowContext';
import Flows from '@/components/Flows';

export default function FlowsPage() {
  return (
    <FlowProvider>
      <Flows />
    </FlowProvider>
  );
}
