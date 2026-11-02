import { Button, Group, Paper, Select, TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconSearch, IconX } from '@tabler/icons-react';
import { type ReactNode, useState } from 'react';

/** Search box that updates the URL after the user pauses typing. */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(value ?? '');
  const [lastValue, setLastValue] = useState(value);
  const commit = useDebouncedCallback((v: string) => onChange(v.trim() || null), 350);

  // The URL changed from outside this box (e.g. "Clear filters", back button): show the new value.
  // Compared against the trimmed text so a trailing space mid-typing isn't wiped out.
  if (value !== lastValue) {
    setLastValue(value);
    if ((value ?? '') !== text.trim()) setText(value ?? '');
  }

  return (
    <TextInput
      aria-label="Search"
      placeholder={placeholder}
      leftSection={<IconSearch size={16} />}
      value={text}
      onChange={(e) => {
        setText(e.currentTarget.value);
        commit(e.currentTarget.value);
      }}
      style={{ flex: '1 1 260px' }}
    />
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  data,
  width = 180,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  data: { value: string; label: string }[];
  width?: number;
}) {
  return (
    <Select
      aria-label={label}
      placeholder={label}
      data={data}
      value={value}
      onChange={onChange}
      clearable
      searchable={data.length > 8}
      w={{ base: '100%', xs: width }}
      comboboxProps={{ shadow: 'md' }}
    />
  );
}

export function FiltersBar({
  children,
  onClear,
  active,
}: {
  children: ReactNode;
  onClear: () => void;
  active: boolean;
}) {
  return (
    <Paper p="sm" mb="md">
      <Group gap="sm" wrap="wrap">
        {children}
        {active && (
          <Button
            variant="subtle"
            color="stone"
            leftSection={<IconX size={14} />}
            onClick={onClear}
          >
            Clear filters
          </Button>
        )}
      </Group>
    </Paper>
  );
}
