import { model, models, Schema, type Types } from 'mongoose';

export interface AuctionPurchase {
  _id: Types.ObjectId;
  dateKey: string;             // 경매일자 ('YYYY-MM-DD')
  naBzplc: string;             // 경제통합사업장코드
  gbn: string;                 // 거래구분 ('1': 공판장, '2': 전자거래)
  oslpNo: number;              // 출하전표번호
  aucNo: number;               // 경매번호
  naLatc: string;              // 공판품목코드
  wmcLatcnm: string;           // 품목명
  wmSogmnm: string;            // 출하명/번호
  wmWt: number;                // 중량 (Kg)
  grdWmBaseInfCnm: string;     // 등급
  budlCn: number;              // 묶음수
  szeWmBaseInfCnm: string;     // 크기 구분
  trqt: number;                // 거래수량
  actoUpr: number;             // 낙찰 단가
  selAm: number;               // 낙찰 금액 (trqt * actoUpr)
  etcRmkCntn?: string | null;  // 비고/특이사항
  productId: Types.ObjectId | null; // 연결된 상품 ID
  isActive: boolean;           // 활성 상태 (취소 시 false)
  createdAt: Date;
  updatedAt: Date;
}

const auctionPurchaseSchema = new Schema<AuctionPurchase>(
  {
    dateKey: { type: String, required: true },
    naBzplc: { type: String, required: true },
    gbn: { type: String, required: true },
    oslpNo: { type: Number, required: true },
    aucNo: { type: Number, required: true },
    naLatc: { type: String, required: true },
    wmcLatcnm: { type: String, required: true },
    wmSogmnm: { type: String, required: true },
    wmWt: { type: Number, required: true },
    grdWmBaseInfCnm: { type: String, required: true },
    budlCn: { type: Number, required: true },
    szeWmBaseInfCnm: { type: String, required: true },
    trqt: { type: Number, required: true },
    actoUpr: { type: Number, required: true },
    selAm: { type: Number, required: true },
    etcRmkCntn: { type: String, default: null },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    isActive: { type: Boolean, default: true, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// 복합 유니크 인덱스로 중복 수집 방지
auctionPurchaseSchema.index(
  { dateKey: 1, naBzplc: 1, gbn: 1, oslpNo: 1, aucNo: 1, naLatc: 1 },
  { unique: true, name: 'unique_purchase' }
);

auctionPurchaseSchema.index({ productId: 1 });
auctionPurchaseSchema.index({ dateKey: 1 });
auctionPurchaseSchema.index({ isActive: 1 });

export const AuctionPurchaseModel =
  models.AuctionPurchase || model<AuctionPurchase>('AuctionPurchase', auctionPurchaseSchema);
