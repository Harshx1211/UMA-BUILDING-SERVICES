'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { BookOpen, ShieldAlert, Package } from 'lucide-react';
import AssetTypesTab from './AssetTypesTab';
import DefectCodesTab from './DefectCodesTab';
import InventoryTab from './InventoryTab';

const TABS = [
  { id: 'asset-types',   label: 'Asset Types',     icon: BookOpen },
  { id: 'defect-codes',  label: 'Defect Codes',     icon: ShieldAlert },
  { id: 'inventory',     label: 'Inventory Items',  icon: Package },
];

function CatalogueTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const active = params.get('tab') ?? 'asset-types';

  const setTab = (id: string) => router.replace(`/catalogue?tab=${id}`);

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title="Catalogue" subtitle="Manage asset types, defect codes and inventory items" />

      {/* Tab bar */}
      <div className="bg-white rounded-2xl border flex gap-1 p-1.5" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold flex-1 justify-center transition-all"
              style={{
                background: on ? 'linear-gradient(135deg,#1B2D4F,#243a65)' : 'transparent',
                color: on ? '#fff' : 'var(--text-secondary)',
              }}>
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {active === 'asset-types'  && <AssetTypesTab />}
      {active === 'defect-codes' && <DefectCodesTab />}
      {active === 'inventory'    && <InventoryTab />}
    </div>
  );
}

export default function CataloguePage() {
  return (
    <Suspense>
      <CatalogueTabs />
    </Suspense>
  );
}
