import { VendorDetailScreen } from '@/components/screens/vendor-detail-screen';
import { connectMongo } from '@/lib/db';
import { getVendorDetailView } from '@/server/services/vendor-detail';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: { id: string } }): Promise<JSX.Element> {
  try {
    await connectMongo();

    const detail = await getVendorDetailView({
      vendorId: params.id,
      page: 1,
      limit: 20
    });

    return (
      <VendorDetailScreen
        vendorId={params.id}
        initialData={detail.data}
        initialMeta={detail.meta}
        initialError={null}
      />
    );
  } catch (error) {
    return (
      <VendorDetailScreen
        vendorId={params.id}
        initialData={null}
        initialMeta={null}
        initialError={error instanceof Error ? error.message : '거래처 상세 조회 실패'}
      />
    );
  }
}
