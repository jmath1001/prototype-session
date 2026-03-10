'use client';
import { ScheduleProvider } from '@/lib/ScheduleContext';
import MasterDeployment from '@/components/MasterGrid';

export default function Home() {
  return (
    <ScheduleProvider>
      <MasterDeployment />
    </ScheduleProvider>
  );
}