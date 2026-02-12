import { VendorDetailScreen } from '@/components/screens/vendor-detail-screen';

export default function VendorDetailPage({ params }: { params: { id: string } }): JSX.Element {
  return <VendorDetailScreen vendorId={params.id} />;
}
