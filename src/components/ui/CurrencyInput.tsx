import { useState, useEffect, useRef, ChangeEvent } from 'react';

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
  className?: string;
  min?: number;
  max?: number;
  autoFocus?: boolean;
}

function formatDisplayValue(val: string) {
  if (val === '') return '';
  let cleanValue = String(val).replace(/[^\d,-.]/g, '');
  cleanValue = cleanValue.replace('.', ',');

  if (cleanValue.split(',').length > 2) {
    const parts = cleanValue.split(',');
    cleanValue = parts[0] + ',' + parts.slice(1).join('');
  }

  if (!cleanValue.includes(',') && cleanValue.length > 0) {
    cleanValue = `${cleanValue},00`;
  }

  if (cleanValue) {
    const parts = cleanValue.split(',');
    const intPart = parts[0] || '0';
    const decPart = parts[1] || '00';
    const paddedDec = decPart.padEnd(2, '0').slice(0, 2);
    return `${intPart},${paddedDec}`;
  }
  return '';
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  inputMode = 'decimal',
  className = '',
  min = 0,
  max = 999999.99,
  autoFocus = false
}: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prevPropValue, setPrevPropValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(formatDisplayValue(value));

  // Deriva o estado a partir das props se o parent modificar de fora
  if (value !== prevPropValue) {
    setPrevPropValue(value);
    setDisplayValue(formatDisplayValue(value));
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const start = input.selectionStart;

    let val = e.target.value;

    val = val.replace(/[^\d.,]/g, '');

    if (val.includes(',')) {
      const parts = val.split(',');
      val = parts[0] + '.' + parts.slice(1).join('');
    }

    if (val.split('.').length > 2) {
      const parts = val.split('.');
      val = parts[0] + '.' + parts.slice(1).join('');
    }

    if (val.includes('.')) {
      const parts = val.split('.');
      val = parts[0] + ',' + parts[1];
    }

    if (val) {
      const parts = val.split(',');
      const intPart = parts[0];
      const decPart = parts[1] || '0';
      if (decPart.length > 2) {
        val = `${intPart},${decPart.slice(0, 2)}`;
      }
    }

    const numericValue = val === '' ? 0 : parseFloat(val.replace(',', '.'));

    let finalValue = val;
    if (numericValue < min) {
      finalValue = `${String(min).replace('.', ',')}`;
    } else if (numericValue > max) {
      finalValue = `${String(max).replace('.', ',')}`;
    }

    setDisplayValue(finalValue);
    // Emite o valor padronizado com ponto (ex: "10.50") para o state pai processar matematicamente sem quebrar parseFloat
    onChange(finalValue.replace(',', '.'));

    const end = input.selectionEnd;
    if (start !== null && end !== null) {
      const newStart = Math.min(start, finalValue.length);
      const newEnd = Math.min(end, finalValue.length);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newStart, newEnd);
        }
      });
    }
  };

  return (
    <input
      ref={inputRef}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      inputMode={inputMode}
      className={className}
      autoFocus={autoFocus}
    />
  );
}
