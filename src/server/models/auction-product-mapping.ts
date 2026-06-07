import { model, models, Schema, type Types } from 'mongoose';

export interface AuctionProductMapping {
  _id: Types.ObjectId;
  naBzplc: string;           // 사업장
  gbn: string;               // 거래구분 ('1' or '2')
  naLatc: string;            // 농협 품목코드
  productId: Types.ObjectId; // 매핑될 Product ID
  createdAt: Date;
  updatedAt: Date;
}

const auctionProductMappingSchema = new Schema<AuctionProductMapping>(
  {
    naBzplc: { type: String, required: true },
    gbn: { type: String, required: true },
    naLatc: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// 복합 유니크 인덱스로 매핑 중복 방지
auctionProductMappingSchema.index(
  { naBzplc: 1, gbn: 1, naLatc: 1 },
  { unique: true, name: 'unique_mapping' }
);

auctionProductMappingSchema.index({ productId: 1 });

export const AuctionProductMappingModel =
  models.AuctionProductMapping || model<AuctionProductMapping>('AuctionProductMapping', auctionProductMappingSchema);
