# DatePicker 컴포넌트

커스텀 달력 팝업 기반 날짜 선택 컴포넌트입니다.

## 기술 선택

| 항목      | 선택                        | 이유                                               |
| --------- | --------------------------- | -------------------------------------------------- |
| 구현 방식 | 직접 구현 (Zero Dependency) | 추가 번들 없이 디자인 시스템 완전 통합             |
| 날짜 처리 | `luxon`                     | 프로젝트 전역에서 이미 사용 중                     |
| 아이콘    | `lucide-react`              | 프로젝트 표준 아이콘 라이브러리                    |
| 스타일    | TailwindCSS                 | 기존 디자인 토큰(`primary`, `border` 등) 직접 활용 |

### 외부 라이브러리를 사용하지 않은 이유

- `react-datepicker`, `react-day-picker` 등은 별도 CSS 및 스타일 오버라이드가 필요하여 디자인 일관성 유지가 어려움
- `luxon`이 이미 프로젝트에 포함되어 있어 날짜 계산에 추가 의존성이 불필요
- 이 프로젝트의 DatePicker 요구사항이 단순(단일 날짜 선택)하여 직접 구현의 복잡도가 낮음

## 사용법

```tsx
import { DatePicker } from '@/components/ui/date-picker';

// 기본 사용
<DatePicker value={dateKey} onChange={setDateKey} />

// react-hook-form과 함께 사용
<Controller
  name="dateKey"
  control={form.control}
  render={({ field }) => (
    <DatePicker value={field.value} onChange={field.onChange} />
  )}
/>
```

## Props

| Prop          | 타입                      | 필수 | 설명                                      |
| ------------- | ------------------------- | ---- | ----------------------------------------- |
| `value`       | `string`                  | ✅   | 선택된 날짜 (YYYY-MM-DD 형식)             |
| `onChange`    | `(value: string) => void` | ✅   | 날짜 변경 콜백                            |
| `className`   | `string`                  | ❌   | 컨테이너 추가 클래스                      |
| `id`          | `string`                  | ❌   | `<label htmlFor>` 연결용 ID               |
| `placeholder` | `string`                  | ❌   | 미선택 시 표시 텍스트 (기본: "날짜 선택") |

## 기능

- **달력 팝업**: 트리거 버튼 클릭 시 아래로 열리는 달력 패널
- **월 이동**: `<` / `>` 버튼으로 이전/다음 달 탐색
- **오늘 바로가기**: 하단 "오늘" 버튼으로 현재 날짜 즉시 선택
- **외부 클릭 닫기**: 달력 바깥 클릭 시 자동 닫힘
- **Escape 키**: 키보드로 닫기 가능
- **시각적 구분**: 오늘 날짜(파란 텍스트), 선택된 날짜(파란 배경), 타 월 날짜(회색)

## 사용 화면

| 화면                                     | 용도                                |
| ---------------------------------------- | ----------------------------------- |
| 거래 입력 (`transactions-screen`)        | 거래 날짜 선택, 조회 기간 시작/종료 |
| 계산서 관리 (`settlement-manage-screen`) | 거래일자 선택                       |
| 거래처 상세 (`vendor-detail-screen`)     | 입금일자 선택                       |

## 파일 위치

```
src/components/ui/date-picker.tsx
```
