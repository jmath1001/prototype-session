'use client';
import { Suspense } from 'react';
import { ScheduleProvider } from '@/lib/ScheduleContext';
import MasterDeployment from '@/components/schedule/MasterDeployment';

export default function Home() {
  return (
    <ScheduleProvider>
      <Suspense fallback={null}>
        <MasterDeployment />
      </Suspense>
    </ScheduleProvider>
  );
}