import { Suspense } from 'react';

import { VendorsScreen } from '@/components/screens/vendors-screen';

export default function VendorsPage(): JSX.Element {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">불러오는 중...</p>}>
      <VendorsScreen />
    </Suspense>
  );
}
