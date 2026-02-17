"use client";

import {
  VendorCreateForm,
  type VendorFormInitialValues,
  type VendorFormMode,
} from "@/components/vendors/vendor-create-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type VendorUpsertDialogProps = {
  open: boolean;
  mode: VendorFormMode;
  initialValues?: VendorFormInitialValues | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
};

export function VendorUpsertDialog({
  open,
  mode,
  initialValues,
  onOpenChange,
  onSuccess,
}: VendorUpsertDialogProps): JSX.Element {
  const isEditMode = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "거래처 수정" : "신규 거래처 등록"}</DialogTitle>
        </DialogHeader>
        <VendorCreateForm
          mode={mode}
          initialValues={isEditMode ? initialValues ?? null : null}
          onSuccess={onSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
