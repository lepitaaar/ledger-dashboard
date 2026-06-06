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
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = React.useMemo(() => {
    return options.find((option) => String(option[valueKey]) === value)
  }, [options, value, valueKey])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal text-slate-700 h-10 px-3", className)}
        >
          <span className="truncate">
            {selectedOption ? String(selectedOption[displayKey]) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={`${placeholder} 검색...`} />
          <CommandList>
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
