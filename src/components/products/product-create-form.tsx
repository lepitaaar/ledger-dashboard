"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { fetchJson } from "@/lib/client";

const createProductSchema = z.object({
  name: z.string().trim().min(1, "품목은 필수입니다.").max(120),
  unit: z.string().trim().max(50),
});

type CreateProductValues = z.infer<typeof createProductSchema>;

export type ProductFormMode = "create" | "edit";

export type ProductFormInitialValues = {
  id: string;
  name: string;
  unit?: string;
};

type ProductCreateFormProps = {
  onSuccess: () => void | Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
  mode?: ProductFormMode;
  initialValues?: ProductFormInitialValues | null;
};

export function ProductCreateForm({
  onSuccess,
  onCancel,
  submitting,
  mode = "create",
  initialValues = null,
}: ProductCreateFormProps): JSX.Element {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isControlledSubmitting = submitting !== undefined;
  const isSubmitting = submitting ?? internalSubmitting;
  const isEditMode = mode === "edit";
  const formInitialValues = useMemo(
    () => ({
      name: initialValues?.name ?? "",
      unit: initialValues?.unit ?? "",
    }),
    [initialValues?.name, initialValues?.unit],
  );

  const form = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: formInitialValues,
  });

  useEffect(() => {
    form.reset(formInitialValues);
    setSubmitError(null);
  }, [form, formInitialValues]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    if (!isControlledSubmitting) {
      setInternalSubmitting(true);
    }

    try {
      if (isEditMode) {
        if (!initialValues?.id) {
          throw new Error("수정할 상품 정보가 없습니다.");
        }

        const payload: { id: string; name?: string; unit?: string } = {
          id: initialValues.id,
        };

        const initialName = initialValues.name.trim();
        const initialUnit = initialValues.unit?.trim() || "";

        if (values.name !== initialName) {
          payload.name = values.name;
        }

        if (values.unit !== initialUnit) {
          payload.unit = values.unit;
        }

        if (payload.name !== undefined || payload.unit !== undefined) {
          await fetchJson<{ data: unknown }>("/api/products", {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        }
      } else {
        await fetchJson<{ data: unknown }>("/api/products", {
          method: "POST",
          body: JSON.stringify(values),
        });

        form.reset({
          name: "",
          unit: "",
        });
      }

      await onSuccess();
    } catch (submitError) {
      setSubmitError(
        submitError instanceof Error
          ? submitError.message
          : isEditMode
            ? "상품 수정 실패"
            : "상품 등록 실패",
      );
    } finally {
      if (!isControlledSubmitting) {
        setInternalSubmitting(false);
      }
    }
  });

  return (
    <Form {...form}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <p className="text-sm text-slate-500">
          {isEditMode
            ? "상품 정보를 수정하고 저장해주세요."
            : "새로운 상품 정보를 입력하여 등록해주세요."}
        </p>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>품목 (Product Item) *</FormLabel>
                <FormControl>
                  <Input placeholder="예: 파, 배추, 무" {...field} />
                </FormControl>
                <FormDescription>
                  등록할 상품의 품목명을 입력하세요.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>규격 (선택)</FormLabel>
                <FormControl>
                  <Input placeholder="예: 10kg, 박스, 1단" {...field} />
                </FormControl>
                <FormDescription>
                  필요한 경우에만 상품의 단위나 규격을 입력하세요.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
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
            {isSubmitting ? "저장중..." : isEditMode ? "수정 저장" : "저장"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
