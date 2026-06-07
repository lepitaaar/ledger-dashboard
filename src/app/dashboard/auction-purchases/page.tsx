import { AuctionPurchasesScreen } from '@/components/screens/auction-purchases-screen';

export const metadata = {
  title: '경매 매입 내역 - 농협 연동 대시보드',
  description: '농협 공판장 연동을 통한 실시간 매입 내역을 조회합니다.'
};

export default function AuctionPurchasesPage(): JSX.Element {
  return <AuctionPurchasesScreen />;
}
