import { type PipelineStage, Types } from 'mongoose';

import { normalizePagination } from '@/lib/pagination';
import { escapeRegExp } from '@/lib/utils';
import { TransactionModel } from '@/server/models/transaction';

export type TransactionQueryFilter = {
  vendorId?: string;
  productName?: string;
  keyword?: string;
  startKey?: string;
  endKey?: string;
  includeDeleted?: boolean;
};

export type TransactionListItem = {
  _id: string;
  dateKey: string;
  vendorId: string;
  vendorName: string;
  productName: string;
  productUnit: string;
  unitPrice: number;
  qty: number;
  amount: number;
  registeredTimeKST: string;
  createdAt: string;
  updatedAt: string;
};

function buildBaseMatch(filters: TransactionQueryFilter): Record<string, unknown> {
  const match: Record<string, unknown> = {};

  if (!filters.includeDeleted) {
    match.deletedAt = null;
  }

  if (filters.vendorId) {
    match.vendorId = new Types.ObjectId(filters.vendorId);
  }

  if (filters.productName) {
    match.productName = filters.productName;
  }

  if (filters.startKey || filters.endKey) {
    const dateMatch: Record<string, string> = {};
    if (filters.startKey) {
      dateMatch.$gte = filters.startKey;
    }
    if (filters.endKey) {
      dateMatch.$lte = filters.endKey;
    }
    match.dateKey = dateMatch;
  }

  return match;
}

function buildLookupAndKeywordStages(keyword?: string): PipelineStage[] {
  const stages: PipelineStage[] = [
    {
      $lookup: {
        from: 'vendors',
        localField: 'vendorId',
        foreignField: '_id',
        as: 'vendor'
      }
    },
    {
      $unwind: {
        path: '$vendor',
        preserveNullAndEmptyArrays: true
      }
    }
  ];

  if (keyword) {
    const regex = new RegExp(escapeRegExp(keyword), 'i');
    stages.push({
      $match: {
        $or: [{ productName: regex }, { productUnit: regex }, { 'vendor.name': regex }]
      }
    });
  }

  return stages;
}

function mapTransactionItem(row: Record<string, unknown>): TransactionListItem {
  return {
    _id: String(row._id),
    dateKey: String(row.dateKey),
    vendorId: String(row.vendorId),
    vendorName: String(row.vendorName ?? '-'),
    productName: String(row.productName),
    productUnit: String(row.productUnit ?? ''),
    unitPrice: Number(row.unitPrice),
    qty: Number(row.qty),
    amount: Number(row.amount),
    registeredTimeKST: String(row.registeredTimeKST),
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString()
  };
}

export function calculateAmount(unitPrice: number, qty: number): number {
  return Number((unitPrice * qty).toFixed(2));
}

export async function listTransactions(
  filters: TransactionQueryFilter,
  inputPagination: { page?: number; limit?: number }
): Promise<{ items: TransactionListItem[]; total: number; page: number; limit: number; periodTotalAmount: number }> {
  const { page, limit, skip } = normalizePagination(inputPagination.page, inputPagination.limit);
  const baseMatch = buildBaseMatch(filters);
  const lookupStages = buildLookupAndKeywordStages(filters.keyword);

  const [result] = await TransactionModel.aggregate([
    { $match: baseMatch },
    ...lookupStages,
    { $sort: { dateKey: -1, registeredTimeKST: -1, createdAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              dateKey: 1,
              vendorId: 1,
              vendorName: { $ifNull: ['$vendor.name', '삭제된 업체'] },
              productName: 1,
              productUnit: 1,
              unitPrice: 1,
              qty: 1,
              amount: 1,
              registeredTimeKST: 1,
              createdAt: 1,
              updatedAt: 1
            }
          }
        ],
        total: [{ $count: 'count' }],
        totalAmount: [
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ]
      }
    }
  ]);

  const items = ((result?.items as Record<string, unknown>[] | undefined) ?? []).map(mapTransactionItem);
  const total = Number((result?.total?.[0] as { count?: number } | undefined)?.count ?? 0);
  const periodTotalAmount = Number((result?.totalAmount?.[0] as { total?: number } | undefined)?.total ?? 0);

  return {
    items,
    total,
    page,
    limit,
    periodTotalAmount
  };
}

export async function listTransactionsForExport(filters: TransactionQueryFilter): Promise<TransactionListItem[]> {
  const baseMatch = buildBaseMatch(filters);
  const lookupStages = buildLookupAndKeywordStages(filters.keyword);

  const rows = await TransactionModel.aggregate([
    { $match: baseMatch },
    ...lookupStages,
    { $sort: { dateKey: -1, registeredTimeKST: -1, createdAt: -1 } },
    {
      $project: {
        _id: 1,
        dateKey: 1,
        vendorId: 1,
        vendorName: { $ifNull: ['$vendor.name', '삭제된 업체'] },
        productName: 1,
        productUnit: 1,
        unitPrice: 1,
        qty: 1,
        amount: 1,
        registeredTimeKST: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }
  ]);

  return (rows as Record<string, unknown>[]).map(mapTransactionItem);
}
