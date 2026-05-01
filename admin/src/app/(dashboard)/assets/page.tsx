// Asset Types are now managed in the Catalogue section.
import { redirect } from 'next/navigation';
export default function AssetsPage() {
  redirect('/catalogue?tab=asset-types');
}
