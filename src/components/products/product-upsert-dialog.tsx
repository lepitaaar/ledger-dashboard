"use client";

import { ProductCreateForm } from "@/components/products/product-create-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProductUpsertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
};

export function ProductUpsertDialog({
  open,
  onOpenChange,
  onSuccess,
}: ProductUpsertDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>신규 상품 등록</DialogTitle>
        </DialogHeader>
        <ProductCreateForm
          onSuccess={onSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
