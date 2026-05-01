import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd MMM yyyy, h:mm a'); } catch { return dateStr; }
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }); } catch { return dateStr; }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
