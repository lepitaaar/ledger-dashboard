import { TransactionsScreen } from '@/components/screens/transactions-screen';
import { connectMongo } from '@/lib/db';
import { getTodayDateKey } from '@/lib/kst';
import { listProductOptions } from '@/server/services/products';
import { listTransactions } from '@/server/services/transactions';
import { listVendorOptions } from '@/server/services/vendors';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage(): Promise<JSX.Element> {
  const today = getTodayDateKey();

  try {
    await connectMongo();

    const [vendors, products, transactions] = await Promise.all([
      listVendorOptions(500),
      listProductOptions(500),
      listTransactions(
        {
          startKey: today,
          endKey: today
        },
        {
          page: 1,
          limit: 50
        }
      )
    ]);

    return (
      <TransactionsScreen
        initialRows={transactions.items}
        initialMeta={{
          page: transactions.page,
          limit: transactions.limit,
          total: transactions.total,
          totalPages: Math.max(1, Math.ceil(transactions.total / transactions.limit)),
          periodTotalAmount: transactions.periodTotalAmount,
          appliedRange: {
            startKey: today,
            endKey: today
          }
        }}
        initialVendors={vendors}
        initialProducts={products}
        initialError={null}
      />
    );
  } catch (error) {
    return (
      <TransactionsScreen
        initialRows={[]}
        initialMeta={null}
        initialError={error instanceof Error ? error.message : '거래 조회 실패'}
      />
    );
  }
}
