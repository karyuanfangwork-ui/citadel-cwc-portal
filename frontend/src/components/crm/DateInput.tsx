import React, { useEffect, useRef, useState } from 'react';

type DateInputProps = {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
};

function toDisplayDate(value?: string): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

function toIsoDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return '';
  }

  return `${year}-${month}-${day}`;
}

function formatDraft(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function DateInput({ value, onChange, className, style }: DateInputProps) {
  const [draft, setDraft] = useState(() => toDisplayDate(value));
  const editingRef = useRef(false);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = nativeInputRef.current;
    if (!input) return;
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (pickerInput.showPicker) pickerInput.showPicker();
    else input.click();
  };

  useEffect(() => {
    if (!editingRef.current) setDraft(toDisplayDate(value));
  }, [value]);

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={draft}
        onFocus={() => { editingRef.current = true; }}
        onBlur={() => { editingRef.current = false; }}
        onChange={event => {
          const nextDraft = formatDraft(event.target.value);
          setDraft(nextDraft);
          onChange(toIsoDate(nextDraft));
        }}
        className={`${className ?? ''} pr-11`}
        style={style}
        aria-label="Date in DD/MM/YYYY format"
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-md text-[#006a61] hover:bg-[#eff4ff]"
        aria-label="Open calendar"
        title="Open calendar"
      >
        <span className="material-symbols-outlined text-[20px]">calendar_month</span>
      </button>
      <input
        ref={nativeInputRef}
        type="date"
        value={value?.slice(0, 10) ?? ''}
        onChange={event => {
          const nextValue = event.target.value;
          editingRef.current = false;
          setDraft(toDisplayDate(nextValue));
          onChange(nextValue);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  );
}
