"use client";

import {
  ProductCreateForm,
  type ProductFormInitialValues,
  type ProductFormMode,
} from "@/components/products/product-create-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProductUpsertDialogProps = {
  open: boolean;
  mode: ProductFormMode;
  initialValues?: ProductFormInitialValues | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
};

export function ProductUpsertDialog({
  open,
  mode,
  initialValues,
  onOpenChange,
  onSuccess,
}: ProductUpsertDialogProps): JSX.Element {
  const isEditMode = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "상품 수정" : "신규 상품 등록"}</DialogTitle>
        </DialogHeader>
        <ProductCreateForm
          mode={mode}
          initialValues={isEditMode ? initialValues ?? null : null}
          onSuccess={onSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
