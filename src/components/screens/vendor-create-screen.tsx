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

const createVendorSchema = z.object({
  name: z.string().trim().min(1, '업체명은 필수입니다.').max(120),
  representativeName: z.string().trim().min(1, '대표자명은 필수입니다.').max(80),
  phone: z
    .string()
    .trim()
    .min(7, '전화번호를 입력하세요.')
    .max(30)
    .regex(/^[0-9+\-\s()]+$/, '전화번호 형식이 올바르지 않습니다.')
});

type CreateVendorValues = z.infer<typeof createVendorSchema>;

export function VendorCreateScreen(): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateVendorValues>({
    resolver: zodResolver(createVendorSchema),
    defaultValues: {
      name: '',
      representativeName: '',
      phone: ''
    }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);

    try {
      await fetchJson<{ data: unknown }>('/api/vendors', {
        method: 'POST',
        body: JSON.stringify(values)
      });

      router.push('/dashboard/vendors');
      router.refresh();
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : '거래처 등록 실패');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">신규 거래처 등록</CardTitle>
          <p className="text-sm text-slate-500">새로운 거래처 정보를 입력하여 등록해주세요.</p>
        </CardHeader>

        <CardContent>
          <form className="mx-auto max-w-2xl space-y-6" onSubmit={onSubmit}>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">업체명 *</Label>
                <Input id="name" placeholder="업체명을 입력하세요" {...form.register('name')} />
                <p className="text-xs text-red-600">{form.formState.errors.name?.message}</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="representativeName">대표자명 *</Label>
                <Input id="representativeName" placeholder="대표자 성함을 입력하세요" {...form.register('representativeName')} />
                <p className="text-xs text-red-600">{form.formState.errors.representativeName?.message}</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone">전화번호 *</Label>
                <Input id="phone" placeholder="010-0000-0000" {...form.register('phone')} />
                <p className="text-xs text-red-600">{form.formState.errors.phone?.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? '저장중...' : '저장'}
              </Button>
              <Button type="button" variant="secondary" asChild>
                <Link href="/dashboard/vendors">취소</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
