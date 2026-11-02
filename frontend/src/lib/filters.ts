import dayjs from 'dayjs';

export const RECEIVED_OPTIONS = [
  { value: '1', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

/** "Received within N days" → ISO lower bound for created_from. */
export function receivedSince(days: string | null): string | undefined {
  if (!days) return undefined;
  const n = Number(days);
  return dayjs()
    .subtract(n - 1, 'day')
    .startOf('day')
    .toISOString();
}
