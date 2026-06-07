import { InventoryScreen } from '@/components/screens/inventory-screen';

export const metadata = {
  title: '공동재고 현황 - 농협 연동 대시보드',
  description: '최신 이동평균 원가 기준 공동재고 현황을 모니터링합니다.'
};

export default function InventoryPage(): JSX.Element {
  return <InventoryScreen />;
}
