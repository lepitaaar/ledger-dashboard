'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchJson } from '@/lib/client';

const createProductSchema = z.object({
  name: z.string().trim().min(1, '품목은 필수입니다.').max(120),
  unit: z.string().trim().min(1, '규격은 필수입니다.').max(50)
});

type CreateProductValues = z.infer<typeof createProductSchema>;

export function ProductCreateScreen(): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '',
      unit: ''
    }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);

    try {
      await fetchJson<{ data: unknown }>('/api/products', {
        method: 'POST',
        body: JSON.stringify(values)
      });

      router.push('/dashboard/products');
      router.refresh();
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : '상품 등록 실패');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-xl">신규 상품 등록</CardTitle>
            <Link href="/dashboard/products" className="text-sm text-slate-500 hover:text-primary">
              목록으로 돌아가기
            </Link>
          </div>
        </CardHeader>

        <CardContent>
          <form className="mx-auto max-w-3xl space-y-6" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">품목 (Product Item) *</Label>
                <Input id="name" placeholder="예: 파, 배추, 무" {...form.register('name')} />
                <p className="text-xs text-slate-500">등록할 상품의 품목명을 입력하세요.</p>
                <p className="text-xs text-red-600">{form.formState.errors.name?.message}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">규격 (Specification) *</Label>
                <Input id="unit" placeholder="예: 10kg, 박스, 1단" {...form.register('unit')} />
                <p className="text-xs text-slate-500">상품의 단위 및 규격을 입력하세요.</p>
                <p className="text-xs text-red-600">{form.formState.errors.unit?.message}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
              <Button type="button" variant="secondary" onClick={() => router.push('/dashboard/products')}>
                취소
              </Button>
              <Button type="submit" variant="success" disabled={submitting}>
                {submitting ? '저장중...' : '저장'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
