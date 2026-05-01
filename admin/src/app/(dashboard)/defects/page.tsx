// Defect Codes are now managed in the Catalogue section.
import { redirect } from 'next/navigation';
export default function DefectsPage() {
  redirect('/catalogue?tab=defect-codes');
}
