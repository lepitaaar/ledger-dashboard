'use client'

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps<T> {
  options: T[]
  value: string
  onSelect: (option: T) => void
  placeholder?: string
  displayKey?: keyof T
  valueKey?: keyof T
  emptyMessage?: string
  className?: string
  disabled?: boolean
  allowCustomValue?: boolean
  id?: string
  ariaLabel?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Combobox<T extends Record<string, any>>({
  options,
  value,
  onSelect,
  placeholder = "선택...",
  displayKey = "name" as keyof T,
  valueKey = "_id" as keyof T,
  emptyMessage = "검색 결과가 없습니다.",
  className,
  disabled,
  allowCustomValue = false,
  id,
  ariaLabel,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  React.useEffect(() => {
    if (!open) {
      setSearchValue("")
    }
  }, [open])

  const selectedOption = React.useMemo(() => {
    return options.find((option) => String(option[valueKey]) === value)
  }, [options, value, valueKey])

  const displayLabel = React.useMemo(() => {
    if (selectedOption) {
      return String(selectedOption[displayKey])
    }
    if (allowCustomValue && value) {
      return value
    }
    return placeholder
  }, [selectedOption, allowCustomValue, value, displayKey, placeholder])

  const showCustomOption = React.useMemo(() => {
    if (!allowCustomValue || !searchValue.trim()) {
      return false
    }
    const hasExactMatch = options.some(
      (option) => String(option[displayKey]).toLowerCase() === searchValue.trim().toLowerCase()
    )
    return !hasExactMatch
  }, [allowCustomValue, searchValue, options, displayKey])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("h-11 w-full justify-between px-3.5 text-base font-normal text-slate-700", className)}
        >
          <span className="truncate">
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={`${placeholder} 검색...`}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {showCustomOption && (
              <CommandGroup heading="직접 입력">
                <CommandItem
                  value={searchValue.trim()}
                  onSelect={() => {
                    const customOption = {
                      [valueKey]: searchValue.trim(),
                      [displayKey]: searchValue.trim(),
                    } as unknown as T
                    onSelect(customOption)
                    setOpen(false)
                  }}
                  className="font-medium text-blue-600 cursor-pointer"
                >
                  <span className="truncate">&ldquo;{searchValue.trim()}&rdquo; 품목으로 추가</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const optValue = String(option[valueKey])
                const optLabel = String(option[displayKey])
                return (
                  <CommandItem
                    key={optValue}
                    value={optLabel}
                    onSelect={() => {
                      onSelect(option)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === optValue ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {optLabel}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
