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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { fetchJson } from "@/lib/client";

const createVendorSchema = z.object({
  name: z.string().trim().min(1, "업체명은 필수입니다.").max(120),
  representativeName: z
    .string()
    .trim()
    .max(80, "대표자명이 너무 깁니다.")
    .transform((value) => (value.length > 0 ? value : undefined)),
  phone: z
    .string()
    .trim()
    .max(30, "전화번호가 너무 깁니다.")
    .refine((value) => value.length === 0 || value.length >= 7, "전화번호를 입력하세요.")
    .refine(
      (value) => value.length === 0 || /^[0-9+\-\s()]+$/.test(value),
      "전화번호 형식이 올바르지 않습니다.",
    )
    .transform((value) => (value.length > 0 ? value : undefined)),
});

type CreateVendorValues = z.infer<typeof createVendorSchema>;

export type VendorFormMode = "create" | "edit";

export type VendorFormInitialValues = {
  id: string;
  name: string;
  representativeName?: string;
  phone?: string;
};

type VendorCreateFormProps = {
  onSuccess: () => void | Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
  mode?: VendorFormMode;
  initialValues?: VendorFormInitialValues | null;
};

export function VendorCreateForm({
  onSuccess,
  onCancel,
  submitting,
  mode = "create",
  initialValues = null,
}: VendorCreateFormProps): JSX.Element {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isControlledSubmitting = submitting !== undefined;
  const isSubmitting = submitting ?? internalSubmitting;
  const isEditMode = mode === "edit";
  const formInitialValues = useMemo(
    () => ({
      name: initialValues?.name ?? "",
      representativeName: initialValues?.representativeName ?? "",
      phone: initialValues?.phone ?? "",
    }),
    [initialValues?.name, initialValues?.phone, initialValues?.representativeName],
  );

  const form = useForm<CreateVendorValues>({
    resolver: zodResolver(createVendorSchema),
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
          throw new Error("수정할 거래처 정보가 없습니다.");
        }

        const payload: {
          id: string;
          name?: string;
          representativeName?: string;
          phone?: string;
        } = { id: initialValues.id };

        const initialName = initialValues.name.trim();
        const initialRepresentativeName =
          initialValues.representativeName?.trim() || undefined;
        const initialPhone = initialValues.phone?.trim() || undefined;

        if (values.name !== initialName) {
          payload.name = values.name;
        }

        if (
          values.representativeName !== undefined &&
          values.representativeName !== initialRepresentativeName
        ) {
          payload.representativeName = values.representativeName;
        }

        if (values.phone !== undefined && values.phone !== initialPhone) {
          payload.phone = values.phone;
        }

        const hasChanges =
          payload.name !== undefined ||
          payload.representativeName !== undefined ||
          payload.phone !== undefined;

        if (hasChanges) {
          await fetchJson<{ data: unknown }>("/api/vendors", {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        }
      } else {
        await fetchJson<{ data: unknown }>("/api/vendors", {
          method: "POST",
          body: JSON.stringify(values),
        });

        form.reset({
          name: "",
          representativeName: "",
          phone: "",
        });
      }

      await onSuccess();
    } catch (submitError) {
      setSubmitError(
        submitError instanceof Error
          ? submitError.message
          : isEditMode
            ? "거래처 수정 실패"
            : "거래처 등록 실패",
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
            ? "거래처 정보를 수정하고 저장해주세요."
            : "새로운 거래처 정보를 입력하여 등록해주세요."}
        </p>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>업체명 *</FormLabel>
                <FormControl>
                  <Input placeholder="업체명을 입력하세요" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="representativeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>대표자명</FormLabel>
                <FormControl>
                  <Input placeholder="대표자 성함을 입력하세요" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>전화번호</FormLabel>
                <FormControl>
                  <Input placeholder="010-0000-0000" {...field} />
                </FormControl>
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "저장중..." : isEditMode ? "수정 저장" : "저장"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
