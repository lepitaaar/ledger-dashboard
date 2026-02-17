import { Suspense } from "react";

import { ProductsScreen } from '@/components/screens/products-screen';

export default function ProductsPage(): JSX.Element {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">불러오는 중...</p>}>
      <ProductsScreen />
    </Suspense>
  );
}
