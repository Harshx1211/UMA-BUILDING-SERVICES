// Display names for job types — same wording as the job detail screen and
// the Schedule list (app/(app)/jobs/[id]/index.tsx, app/(app)/jobs/index.tsx).
import { JobType } from '@/constants/Enums';

export const JOB_TYPE_LABEL: Record<string, string> = {
  [JobType.RoutineServiceMonthly]:  'Monthly Service',
  [JobType.RoutineService3Monthly]: '3-Monthly Service',
  [JobType.RoutineService6Monthly]: '6-Monthly Service',
  [JobType.RoutineServiceAnnual]:   'Annual Service',
  [JobType.RoutineService5Yearly]:  '5-Yearly Service',
  [JobType.DefectRepairQuote]:      'Defect Repair Quote',
  [JobType.DefectRepair]:           'Defect Repair',
  [JobType.Quote]:                  'Quote',
  [JobType.Installation]:           'Installation',
  [JobType.Emergency]:              'Emergency',
};

export const jobTypeLabel = (t: string | null | undefined): string => (t ? JOB_TYPE_LABEL[t] ?? t : '');
