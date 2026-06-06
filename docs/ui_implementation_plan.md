# shadcn/ui 정식 도입 구현 플랜

## 배경

현재 프로젝트는 shadcn/ui와 동일한 기술 스택(Radix UI + CVA + Tailwind)을 사용하고 있으나, 7개 기본 컴포넌트만 수동으로 구현한 상태입니다. 그 결과 다음 문제가 발생하고 있습니다:

- `alert()` 19건, `confirm()` 1건 → 쓰레드 차단, UX 저하
- 네이티브 `<select>` 2건 → 스타일 불일치, 500개 항목에 검색 불가
- 커스텀 콤보박스 2건 → setTimeout 핵 사용, 접근성 미지원
- 로딩 상태 8건 → 단순 텍스트 "불러오는 중..."
- 페이지네이션 4곳 중복, 배지/체크박스 등 비표준 구현

> [!IMPORTANT]
> 이 플랜은 **전면 재작성이 아닙니다**. 기존 코드를 유지하면서 shadcn/ui 컴포넌트를 점진적으로 추가·교체하는 **확장 방식**입니다. 각 단계는 독립적으로 배포 가능합니다.

---

## 교체 대상 전체 현황

| 우선순위 | 분류 | 건수 | 도입 컴포넌트 |
|---|---|---|---|
| 🔴 HIGH | `alert()` 호출 | 19 | **Sonner** (Toast) |
| 🔴 HIGH | `confirm()` 호출 | 1 | **AlertDialog** |
| 🔴 HIGH | 커스텀 업체 콤보박스 | 2 | **Combobox** (Popover + Command) |
| 🔴 HIGH | 네이티브 `<select>` | 2 | **Select** 또는 **Combobox** |
| 🔴 HIGH | Tailwind 설정 마이그레이션 | 1 | CSS 변수 체계 |
| 🟡 MED | 로딩 상태 텍스트 | 8 | **Skeleton** |
| 🟡 MED | 행 액션 아이콘 버튼 | 3 스크린 | **DropdownMenu** |
| 🟡 MED | 수동 배지 패턴 | 3 | **Badge** |
| 🟡 MED | 수동 폼 검증 | 2 폼 | **Form** |
| 🟡 MED | 중복 페이지네이션 | 4 스크린 | 공유 **Pagination** |
| 🟢 LOW | 네이티브 체크박스 | 3 | **Checkbox** |
| 🟢 LOW | 상태 토글 | 1 | **Switch** |

---

## 단계별 구현 계획

---

### Phase 1 — 기반 설정 (shadcn/ui 초기화)

> 기존 코드 동작에 **영향 없이** shadcn/ui 기반만 세팅합니다.

---

#### [NEW] `components.json`

shadcn CLI 설정 파일 생성:
- 스타일: `default`
- Tailwind CSS 사용
- 컴포넌트 경로: `src/components/ui`
- 유틸 경로: `src/lib/utils.ts`
- 별칭: `@/components`, `@/lib`

#### [MODIFY] [globals.css](file:///Users/lockpick/Desktop/ledger-dashboard/src/app/globals.css)

shadcn/ui가 요구하는 CSS 커스텀 속성을 `:root`에 추가:

```css
:root {
  --background: 210 20% 96%;      /* #f3f4f6 현재값 유지 */
  --foreground: 222 47% 11%;      /* #0f172a 현재값 유지 */
  --card: 0 0% 100%;              /* #ffffff */
  --card-foreground: 222 47% 11%;
  --primary: 212 68% 37%;         /* #1e5fa0 현재값 유지 */
  --primary-foreground: 0 0% 100%;
  --secondary: 210 14% 89%;
  --secondary-foreground: 222 47% 11%;
  --muted: 220 9% 46%;            /* #6b7280 현재값 유지 */
  --muted-foreground: 215 16% 47%;
  --accent: 24 95% 53%;           /* #f97316 현재값 유지 */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 214 22% 83%;          /* #dbe3ed 현재값 유지 */
  --input: 214 22% 83%;
  --ring: 212 68% 37%;
  --radius: 0.5rem;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
}
```

> [!NOTE]
> 기존 색상값을 HSL 변수로 1:1 매핑하므로 시각적 변화 없음

#### [MODIFY] [tailwind.config.ts](file:///Users/lockpick/Desktop/ledger-dashboard/src/tailwind.config.ts)

- 하드코딩된 hex 색상 → `hsl(var(--primary))` 등 CSS 변수 참조로 전환
- `tailwindcss-animate` 플러그인 추가
- 기존 `borderRadius` 값 유지

#### 의존성 추가

```bash
npm install tailwindcss-animate
# shadcn CLI로 Sonner 추가 시 자동 설치되는 것들:
# @radix-ui/react-popover, @radix-ui/react-select, cmdk, sonner 등
```

#### 검증
- `npm run typecheck` 통과
- `npm run lint` 통과
- 기존 화면에 시각적 변화 없음 확인

---

### Phase 2 — 핵심 컴포넌트 추가

> 프로젝트 전반에 영향이 큰 **공통 컴포넌트**를 먼저 도입합니다.

---

#### 2-1. Sonner (Toast) — `alert()` 19건 교체

##### [NEW] [sonner.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/sonner.tsx)

shadcn/ui의 Sonner 래퍼 추가

##### [MODIFY] [layout.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/app/layout.tsx)

루트 레이아웃에 `<Toaster />` 프로바이더 추가

##### [MODIFY] 6개 스크린 파일

`alert(...)` → `toast.error(...)` 또는 `toast.success(...)` 교체:

| 파일 | 교체 건수 |
|---|---|
| [settlement-manage-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx) | 12 |
| [settlements-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlements-screen.tsx) | 1 |
| [transactions-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/transactions-screen.tsx) | 2 |
| [products-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/products-screen.tsx) | 1 |
| [vendor-detail-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/vendor-detail-screen.tsx) | 2 |
| [vendors-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/vendors-screen.tsx) | 1 |

---

#### 2-2. AlertDialog — `confirm()` 1건 교체

##### [NEW] [alert-dialog.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/alert-dialog.tsx)

Radix AlertDialog 기반 확인 대화상자

##### [MODIFY] [products-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/products-screen.tsx)

`window.confirm("해당 상품을 삭제하시겠습니까?")` → `AlertDialog` 컴포넌트로 교체

---

#### 2-3. Badge

##### [NEW] [badge.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/badge.tsx)

CVA 기반 배지 (default / secondary / destructive / outline 변형)

##### [MODIFY] 수동 배지 패턴 교체

| 파일 | 위치 | 내용 |
|---|---|---|
| [vendor-detail-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/vendor-detail-screen.tsx) | L172-180 | 상태 배지 "거래중"/"거래중지" |
| [vendor-detail-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/vendor-detail-screen.tsx) | L280-288 | 유형 배지 "매출"/"입금" |
| [settlement-manage-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx) | L960-988 | 자동 저장 상태 배지 |

---

#### 2-4. Skeleton

##### [NEW] [skeleton.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/skeleton.tsx)

애니메이션 로딩 플레이스홀더

##### [MODIFY] 로딩 상태 8곳 교체

"불러오는 중..." 텍스트 → 레이아웃에 맞는 Skeleton 컴포넌트 (테이블 행 스켈레톤, 카드 스켈레톤 등)

---

#### 2-5. Pagination (공유 컴포넌트)

##### [NEW] [pagination.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/pagination.tsx)

4곳에서 중복된 이전/다음 버튼 + 페이지 정보 패턴을 공유 컴포넌트로 추출

##### [MODIFY] 4개 스크린

| 파일 | 현재 코드 |
|---|---|
| [vendors-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/vendors-screen.tsx) | L379-399 |
| [products-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/products-screen.tsx) | L289-309 |
| [vendor-detail-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/vendor-detail-screen.tsx) | L314-334 |
| [transactions-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/transactions-screen.tsx) | L547-567 |

중복 코드 → `<Pagination page={page} totalPages={totalPages} onPageChange={setPage} />` 로 통일

---

#### Phase 2 검증
- `npm run typecheck` 통과
- `npm run lint` 통과
- `npm run test` 통과
- 모든 alert() 제거 확인 → Toast로 동작
- 모든 로딩 상태 → Skeleton 애니메이션 표시

---

### Phase 3 — 스크린별 컴포넌트 적용

> 각 스크린의 구체적인 UI 문제를 해결합니다.

---

#### 3-1. Combobox + Select 도입

##### 신규 의존성

```bash
# Popover + Command (cmdk) → Combobox 구현에 필요
npx shadcn@latest add popover command select
```

##### [NEW] [popover.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/popover.tsx)
##### [NEW] [command.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/command.tsx)
##### [NEW] [select.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/select.tsx)

##### [MODIFY] [settlement-manage-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx)

**업체 검색 콤보박스 교체** (L891-918, ~50줄 커스텀 코드 제거):

```diff
- <Input onFocus={() => setVendorDropdownOpen(true)} ... />
- {vendorDropdownOpen && (
-   <div className="absolute z-10 ...">
-     {vendorSuggestions.map(vendor => (
-       <button onMouseDown={e => e.preventDefault()} ...>
-     ))}
-   </div>
- )}
+ <Combobox
+   options={vendors}
+   value={selectedVendorId}
+   onSelect={selectVendor}
+   placeholder="업체 검색..."
+   displayKey="name"
+   valueKey="_id"
+ />
```

**상품 자동완성 교체** (L1110-1131, 행별 커스텀 드롭다운 제거):
- `activeProductRowId` 상태 및 관련 로직 제거
- Combobox 기반 상품 선택기로 교체

관련 제거 대상 상태:
- `vendorInput`, `vendorDropdownOpen` → Combobox 내부 관리
- `activeProductRowId` → Combobox 내부 관리

##### [MODIFY] [transactions-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/transactions-screen.tsx)

네이티브 `<select>` 2건 교체 (L340-370):

```diff
- <select className="h-10 rounded-md border ..." value={vendorFilter} ...>
-   <option value="">전체 업체명</option>
-   {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
- </select>
+ <Combobox
+   options={[{ _id: "", name: "전체 업체명" }, ...vendors]}
+   value={vendorFilter}
+   onSelect={(v) => { setVendorFilter(v._id); setPage(1); }}
+   placeholder="업체 검색..."
+ />
```

> [!NOTE]
> 500개 항목 리스트이므로 `Select`가 아닌 **Combobox**(검색 가능)를 사용합니다.

---

#### 3-2. DropdownMenu — 행 액션 통합

##### [NEW] [dropdown-menu.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/dropdown-menu.tsx)

Radix DropdownMenu 기반

##### [MODIFY] [settlement-manage-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx)

3개 아이콘 버튼 (Pencil/RotateCcw/Trash2, L1222-1258) → 단일 DropdownMenu로 통합:

```diff
- <button title="수정" onClick={...}><Pencil /></button>
- <button title="반품" onClick={...}><RotateCcw /></button>
- <button title="삭제" onClick={...}><Trash2 /></button>
+ <DropdownMenu>
+   <DropdownMenuTrigger asChild>
+     <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
+   </DropdownMenuTrigger>
+   <DropdownMenuContent>
+     <DropdownMenuItem onClick={...}><Pencil /> 수정</DropdownMenuItem>
+     <DropdownMenuItem onClick={...}><RotateCcw /> 반품</DropdownMenuItem>
+     <DropdownMenuSeparator />
+     <DropdownMenuItem className="text-destructive" onClick={...}><Trash2 /> 삭제</DropdownMenuItem>
+   </DropdownMenuContent>
+ </DropdownMenu>
```

---

#### 3-3. Checkbox + Switch

##### [NEW] [checkbox.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/checkbox.tsx)
##### [NEW] [switch.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/switch.tsx)

##### [MODIFY] [settlement-manage-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx)

네이티브 `<input type="checkbox">` (L996, L1058-1068) → shadcn **Checkbox**

##### [MODIFY] [vendors-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/vendors-screen.tsx)

거래처 활성/비활성 토글 (L326-334) → shadcn **Switch**

---

#### Phase 3 검증
- `npm run typecheck` 통과
- `npm run lint` 통과
- 업체 검색 콤보박스 동작 확인 (settlement manage, transactions)
- 상품 자동완성 동작 확인
- 드롭다운 메뉴 동작 확인
- 네이티브 `<select>` 완전 제거 확인

---

### Phase 4 — 고급 컴포넌트 및 리팩토링

> settlement-manage-screen.tsx 42KB 분리 및 폼 개선

---

#### 4-1. settlement-manage-screen.tsx 분해

42KB 단일 파일을 다음과 같이 분리:

##### [NEW] `src/components/settlements/settlement-toolbar.tsx`

상단 도구 모음 (업체 Combobox + 날짜 내비게이션 + 엑셀/인쇄 버튼)
- 현재 L870-990 영역 분리 (~120줄)

##### [NEW] `src/components/settlements/settlement-row-editor.tsx`

인라인 편집 테이블 행 컴포넌트
- 현재 L1048-1270 영역 (개별 행 렌더링 로직, ~220줄)
- Props: `row`, `onFieldChange`, `onBlur`, `onReturn`, `onDelete`, `products`, `validationErrors`

##### [NEW] `src/components/settlements/settlement-table.tsx`

테이블 전체 래퍼 (헤더 + 행 목록 + 푸터)
- 현재 L992-1290 영역 분리
- `SettlementRowEditor`를 사용하여 각 행 렌더링

##### [NEW] `src/components/settlements/use-settlement-manage.ts`

핵심 비즈니스 로직 커스텀 훅:
- 24개 useState → 훅으로 캡슐화
- `loadMeta`, `loadRows`, `persistRow`, `autoSaveRow`, `returnRow`, `deleteRow` 등 핸들러
- 현재 L205-820 영역 (~600줄)

##### [MODIFY] [settlement-manage-screen.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx)

위 컴포넌트들을 조합하는 **얇은 오케스트레이터**로 축소:

```tsx
export function SettlementManageScreen(): JSX.Element {
  const settlement = useSettlementManage();

  return (
    <div className="space-y-6">
      <SettlementToolbar
        vendors={settlement.vendors}
        selectedVendor={settlement.selectedVendor}
        dateKey={settlement.dateKey}
        onSelectVendor={settlement.selectVendor}
        onDateChange={settlement.applyDate}
        onExport={settlement.exportExcel}
        onPrint={settlement.printPage}
        autoSaveState={settlement.autoSaveState}
      />
      <SettlementTable
        rows={settlement.rows}
        products={settlement.products}
        totalAmount={settlement.totalAmount}
        loading={settlement.loadingRows}
        onFieldChange={settlement.updateRowField}
        onRowBlur={settlement.handleRowBlur}
        onAddRow={settlement.addRow}
        onReturnRow={settlement.returnRow}
        onDeleteRow={settlement.deleteRow}
        validationErrors={settlement.rowValidationErrors}
      />
    </div>
  );
}
```

예상 결과: **42KB → 메인 ~3KB + 훅 ~15KB + 컴포넌트 3개 ~8KB씩**

---

#### 4-2. Form 컴포넌트 도입 (선택)

##### [NEW] [form.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/form.tsx)

react-hook-form + Zod 통합 래퍼 (이미 둘 다 사용 중)

##### [MODIFY] [vendor-create-form.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/vendors/vendor-create-form.tsx)
##### [MODIFY] [product-create-form.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/products/product-create-form.tsx)

수동 `<Label>` + `<Input>` + 에러 `<p>` → `<FormField>` + `<FormItem>` + `<FormMessage>` 패턴으로 정리

---

#### Phase 4 검증
- `npm run typecheck` 통과
- `npm run lint` 통과
- `npm run test` 통과
- settlement-manage-screen.tsx 42KB → 메인 파일 5KB 이하로 축소 확인
- 계산서 관리 화면 전체 기능 정상 동작 (행 편집, 자동 저장, 반품, 삭제, 인쇄, 엑셀)

---

## 변경 파일 전체 요약

### 신규 파일

| 파일 | Phase | 설명 |
|---|---|---|
| `components.json` | 1 | shadcn CLI 설정 |
| `src/components/ui/sonner.tsx` | 2 | Toast 래퍼 |
| `src/components/ui/alert-dialog.tsx` | 2 | 확인 대화상자 |
| `src/components/ui/badge.tsx` | 2 | 배지 |
| `src/components/ui/skeleton.tsx` | 2 | 로딩 스켈레톤 |
| `src/components/ui/pagination.tsx` | 2 | 공유 페이지네이션 |
| `src/components/ui/popover.tsx` | 3 | Popover (Combobox용) |
| `src/components/ui/command.tsx` | 3 | Command (Combobox용) |
| `src/components/ui/select.tsx` | 3 | Select |
| `src/components/ui/dropdown-menu.tsx` | 3 | 드롭다운 메뉴 |
| `src/components/ui/checkbox.tsx` | 3 | 체크박스 |
| `src/components/ui/switch.tsx` | 3 | 스위치 토글 |
| `src/components/settlements/settlement-toolbar.tsx` | 4 | 도구 모음 분리 |
| `src/components/settlements/settlement-row-editor.tsx` | 4 | 행 편집기 분리 |
| `src/components/settlements/settlement-table.tsx` | 4 | 테이블 래퍼 분리 |
| `src/components/settlements/use-settlement-manage.ts` | 4 | 비즈니스 로직 훅 |
| `src/components/ui/form.tsx` | 4 | 폼 래퍼 (선택) |

### 수정 파일

| 파일 | Phase | 변경 내용 |
|---|---|---|
| `globals.css` | 1 | CSS 커스텀 속성 추가 |
| `tailwind.config.ts` | 1 | CSS 변수 참조 + animate 플러그인 |
| `package.json` | 1-3 | 의존성 추가 |
| `app/layout.tsx` | 2 | `<Toaster />` 추가 |
| `settlement-manage-screen.tsx` | 2-4 | alert→toast, 콤보박스, 드롭다운, 파일 분해 |
| `settlements-screen.tsx` | 2 | alert→toast |
| `transactions-screen.tsx` | 2-3 | alert→toast, select→combobox |
| `products-screen.tsx` | 2 | alert→toast, confirm→AlertDialog |
| `vendor-detail-screen.tsx` | 2 | alert→toast, 배지 적용 |
| `vendors-screen.tsx` | 2-3 | alert→toast, 스위치 적용 |
| `vendor-create-form.tsx` | 4 | Form 컴포넌트 적용 (선택) |
| `product-create-form.tsx` | 4 | Form 컴포넌트 적용 (선택) |

---

## 추가 의존성

| 패키지 | 용도 | Phase |
|---|---|---|
| `tailwindcss-animate` | shadcn/ui 애니메이션 | 1 |
| `sonner` | Toast 알림 | 2 |
| `@radix-ui/react-alert-dialog` | AlertDialog | 2 |
| `@radix-ui/react-popover` | Popover (Combobox) | 3 |
| `@radix-ui/react-select` | Select | 3 |
| `@radix-ui/react-dropdown-menu` | DropdownMenu | 3 |
| `@radix-ui/react-checkbox` | Checkbox | 3 |
| `@radix-ui/react-switch` | Switch | 3 |
| `cmdk` | Command (Combobox 검색) | 3 |
| `@radix-ui/react-label` | Form Label 연동 | 4 |

> [!TIP]
> 이미 설치된 패키지: `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `react-hook-form`, `zod`

---

## 검증 계획

### 자동 테스트

```bash
npm run typecheck   # TypeScript 컴파일 검증
npm run lint        # ESLint 통과
npm run test        # 기존 3개 Vitest 통과
```

### 수동 검증 (Phase별)

| Phase | 검증 항목 |
|---|---|
| 1 | 기존 화면 시각적 변화 없음 (색상, 레이아웃, 폰트 동일) |
| 2 | Toast 알림 정상 표시 (성공/에러 구분, 자동 사라짐), AlertDialog 확인/취소 동작, Skeleton 애니메이션 |
| 3 | 업체 Combobox 검색/선택 동작, 상품 자동완성 동작, 드롭다운 메뉴 항목 정상 실행, 네이티브 `<select>` 완전 제거 |
| 4 | 계산서 관리 전체 플로우: 업체 선택 → 행 편집 → 자동 저장 → 반품 → 삭제 → 엑셀 → A5 인쇄 |

---

## Open Questions

> [!IMPORTANT]
> **Q1.** Phase 4의 settlement-manage-screen.tsx 분해 범위를 어디까지 할까요?
> - **옵션 A**: 위 플랜대로 4개 파일로 분리 (toolbar + row-editor + table + hook)
> - **옵션 B**: 훅만 분리하고 UI는 현재 파일에 유지 (최소 변경)
> - **옵션 C**: 더 세밀하게 분리 (인쇄 로직, 엑셀 로직도 별도 훅으로)

> [!IMPORTANT]
> **Q2.** 기존 수동 구현 UI 컴포넌트([button.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/button.tsx), [table.tsx](file:///Users/lockpick/Desktop/ledger-dashboard/src/components/ui/table.tsx) 등)를 shadcn/ui 표준 버전으로 **교체**할까요, 아니면 현재 코드를 **그대로 유지**할까요?
> - **옵션 A**: 기존 컴포넌트 유지 (동작 중인 코드 건드리지 않음)
> - **옵션 B**: shadcn/ui 표준 버전으로 교체 (코드 일관성 확보, 단 variant 차이 조정 필요 — 현재 Button에 `success`/`secondary` 변형이 있음)
