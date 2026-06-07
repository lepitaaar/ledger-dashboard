import { ProductMappingsScreen } from '@/components/screens/product-mappings-screen';

export const metadata = {
  title: '품목 매칭 관리 - 농협 연동 대시보드',
  description: '농협 품목 코드와 상품 마스터를 매칭합니다.'
};

export default function ProductMappingsPage(): JSX.Element {
  return <ProductMappingsScreen />;
}
