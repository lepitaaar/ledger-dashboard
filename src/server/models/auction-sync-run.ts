import { model, models, Schema, type Types } from 'mongoose';

export interface AuctionSyncRun {
  _id: Types.ObjectId;
  startDateKey: string;     // 대상 시작일 ('YYYY-MM-DD')
  endDateKey: string;       // 대상 종료일 ('YYYY-MM-DD')
  status: 'running' | 'success' | 'failed';
  queryCount: number;       // 조회 건수 (API 응답 cCnt 합)
  insertedCount: number;    // 신규 추가 건수
  updatedCount: number;     // 수정 건수
  canceledCount: number;    // 취소 상태 변경 건수
  failedCount: number;      // 실패 건수
  error?: string | null;    // 에러 메시지
  executionTimeMs: number;  // 실행 시간 (ms)
  createdAt: Date;
}

const auctionSyncRunSchema = new Schema<AuctionSyncRun>(
  {
    startDateKey: { type: String, required: true },
    endDateKey: { type: String, required: true },
    status: { type: String, enum: ['running', 'success', 'failed'], required: true },
    queryCount: { type: Number, default: 0 },
    insertedCount: { type: Number, default: 0 },
    updatedCount: { type: Number, default: 0 },
    canceledCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    error: { type: String, default: null },
    executionTimeMs: { type: Number, default: 0 }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

auctionSyncRunSchema.index({ createdAt: -1 });

export const AuctionSyncRunModel =
  models.AuctionSyncRun || model<AuctionSyncRun>('AuctionSyncRun', auctionSyncRunSchema);
