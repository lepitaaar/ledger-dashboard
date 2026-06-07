import mongoose from "mongoose";

import { connectMongo } from "@/lib/db";
import { ProductModel } from "@/server/models/product";
import { TransactionModel } from "@/server/models/transaction";
import { ensureProductByName } from "@/server/services/products";

type TransactionProductGroup = {
  _id: string;
};

async function main(): Promise<void> {
  await connectMongo();

  const groups = await TransactionModel.aggregate<TransactionProductGroup>([
    { $match: { deletedAt: null } },
    {
      $project: {
        name: { $trim: { input: "$productName" } },
      },
    },
    { $match: { name: { $ne: "" } } },
    { $group: { _id: "$name" } },
    { $sort: { _id: 1 } },
  ]);

  let createdProductCount = 0;

  for (const group of groups) {
    const existing = await ProductModel.exists({
      name: group._id,
      deletedAt: null,
    });

    if (!existing) {
      await ensureProductByName(group._id);
      createdProductCount += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        transactionProductCount: groups.length,
        createdProductCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
