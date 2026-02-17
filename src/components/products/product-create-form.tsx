"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/client";

const createProductSchema = z.object({
  name: z.string().trim().min(1, "품목은 필수입니다.").max(120),
  unit: z.string().trim().min(1, "규격은 필수입니다.").max(50),
});

type CreateProductValues = z.infer<typeof createProductSchema>;

type ProductCreateFormProps = {
  onSuccess: () => void | Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
};

export function ProductCreateForm({
  onSuccess,
  onCancel,
  submitting,
}: ProductCreateFormProps): JSX.Element {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isControlledSubmitting = submitting !== undefined;
  const isSubmitting = submitting ?? internalSubmitting;

  const form = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: "",
      unit: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    if (!isControlledSubmitting) {
      setInternalSubmitting(true);
    }

    try {
      await fetchJson<{ data: unknown }>("/api/products", {
        method: "POST",
        body: JSON.stringify(values),
      });

      form.reset();
      await onSuccess();
    } catch (submitError) {
      setSubmitError(
        submitError instanceof Error ? submitError.message : "상품 등록 실패",
      );
    } finally {
      if (!isControlledSubmitting) {
        setInternalSubmitting(false);
      }
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <p className="text-sm text-slate-500">
        새로운 상품 정보를 입력하여 등록해주세요.
      </p>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name">품목 (Product Item) *</Label>
          <Input id="name" placeholder="예: 파, 배추, 무" {...form.register("name")} />
          <p className="text-xs text-slate-500">
            등록할 상품의 품목명을 입력하세요.
          </p>
          <p className="text-xs text-red-600">{form.formState.errors.name?.message}</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="unit">규격 (Specification) *</Label>
          <Input id="unit" placeholder="예: 10kg, 박스, 1단" {...form.register("unit")} />
          <p className="text-xs text-slate-500">
            상품의 단위 및 규격을 입력하세요.
          </p>
          <p className="text-xs text-red-600">{form.formState.errors.unit?.message}</p>
        </div>
      </div>

      {submitError ? (
        <p className="text-sm text-red-600" role="alert">
          {submitError}
        </p>
      ) : null}

      <DialogFooter>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            취소
          </Button>
        ) : null}
        <Button type="submit" variant="success" disabled={isSubmitting}>
          {isSubmitting ? "저장중..." : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}
