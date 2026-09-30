import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPersonName(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word
      .split(/([-'’])/g)
      .map((part) => /^[-'’]$/.test(part) ? part : part ? `${part.charAt(0).toLocaleUpperCase('az-AZ')}${part.slice(1).toLocaleLowerCase('az-AZ')}` : '')
      .join(''))
    .join(' ');
}

export function formatFullName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return formatPersonName([firstName, lastName].filter(Boolean).join(' '));
}
