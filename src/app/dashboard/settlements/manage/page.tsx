import { Suspense } from "react";
import { SettlementManageScreen } from "@/components/screens/settlement-manage-screen";

export default function SettlementManagePage(): JSX.Element {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <SettlementManageScreen />
    </Suspense>
  );
}
