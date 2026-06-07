import { ProfitLossScreen } from '@/components/screens/profit-loss-screen';

export const metadata = {
  title: '손익 및 마진 분석 - 농협 연동 대시보드',
  description: '매출액, 매출원가 및 예상 매출총이익 마진율을 요약 및 대시보드화합니다.'
};

export default function ProfitLossPage(): JSX.Element {
  return <ProfitLossScreen />;
}
