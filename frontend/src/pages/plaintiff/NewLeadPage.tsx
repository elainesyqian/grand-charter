import {
  Button,
  Grid,
  Group,
  List,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBuildingBank, IconFileText, IconSearch } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { plaintiffApi } from '../../api/plaintiff';
import type { Category, Region } from '../../api/types';
import { useUser } from '../../auth/AuthContext';
import { PageHeader } from '../../components/ui';
import { categoryOptions, regionOptions } from '../../lib/format';

const MAX_DESCRIPTION = 5000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

interface FormState {
  name: string;
  email: string;
  region: Region | null;
  category: Category | null;
  description: string;
}

export function validateLead(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!f.name.trim()) errors.name = 'Please enter your name';
  if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Please enter a valid email address';
  if (!f.region) errors.region = 'Choose the region where this happened';
  if (!f.category) errors.category = 'Choose the closest category';
  if (!f.description.trim()) errors.description = 'Tell us a little about what happened';
  return errors;
}

function NextSteps() {
  const steps = [
    {
      icon: <IconSearch size={16} />,
      title: 'We find the right firm',
      text: 'Your request is matched to a firm that handles this kind of case in your region.',
    },
    {
      icon: <IconBuildingBank size={16} />,
      title: 'The firm reviews it',
      text: "You'll see here when a firm accepts your request.",
    },
    {
      icon: <IconFileText size={16} />,
      title: 'Follow progress',
      text: 'Track updates and share documents with your firm from this site.',
    },
  ];
  return (
    <Paper p="lg" bg="navy.0" style={{ borderColor: 'var(--mantine-color-navy-1)' }}>
      <Title order={3} mb="md">
        What happens next
      </Title>
      <List spacing="md" listStyleType="none" p={0}>
        {steps.map((s) => (
          <List.Item
            key={s.title}
            icon={
              <ThemeIcon color="navy" variant="white" radius="xl">
                {s.icon}
              </ThemeIcon>
            }
          >
            <Text fw={600} size="sm">
              {s.title}
            </Text>
            <Text size="sm" c="dimmed">
              {s.text}
            </Text>
          </List.Item>
        ))}
      </List>
      <Text size="xs" c="dimmed" mt="lg">
        Your information is only shared with the firm handling your request.
      </Text>
    </Paper>
  );
}

export function NewLeadPage() {
  const user = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({
    name: user.name,
    email: user.email,
    region: null,
    category: null,
    description: '',
  });
  const [touched, setTouched] = useState(false);
  const errors = touched ? validateLead(form) : {};

  const submit = useMutation({
    mutationFn: () =>
      plaintiffApi.submitLead({
        name: form.name.trim(),
        email: form.email.trim(),
        region: form.region!,
        category: form.category!,
        description: form.description.trim(),
      }),
    onSuccess: (lead) => {
      void qc.invalidateQueries({ queryKey: ['plaintiff', 'leads'] });
      notifications.show({
        color: 'army',
        title: 'Request submitted',
        message: "We're matching you with a firm. You can add documents now.",
      });
      navigate(`/plaintiff/leads/${lead.id}`);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validateLead(form)).length === 0) submit.mutate();
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <PageHeader
        title="Request legal help"
        subtitle="Tell us about your situation. It only takes a few minutes."
        back={{ to: '/plaintiff', label: 'My requests' }}
      />
      <Grid gap="xl">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper p={{ base: 'md', sm: 'xl' }} component="form" onSubmit={onSubmit} noValidate>
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Your name"
                  description="As the firm should address you"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.currentTarget.value)}
                  error={errors.name}
                  maxLength={200}
                />
                <TextInput
                  label="Email"
                  description="Where the firm can reach you"
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.currentTarget.value)}
                  error={errors.email}
                  maxLength={254}
                />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Type of legal issue"
                  placeholder="Choose a category"
                  required
                  data={categoryOptions}
                  value={form.category}
                  onChange={(v) => update('category', v as Category | null)}
                  error={errors.category}
                />
                <Select
                  label="Region"
                  placeholder="Where did this happen?"
                  required
                  data={regionOptions}
                  value={form.region}
                  onChange={(v) => update('region', v as Region | null)}
                  error={errors.region}
                />
              </SimpleGrid>
              <Textarea
                label="What happened?"
                description="Include dates, who was involved, and what outcome you're hoping for."
                required
                autosize
                minRows={6}
                maxRows={14}
                maxLength={MAX_DESCRIPTION}
                value={form.description}
                onChange={(e) => update('description', e.currentTarget.value)}
                error={errors.description}
              />
              <Text size="xs" c="dimmed" ta="right" mt={-12}>
                {form.description.length.toLocaleString()} / {MAX_DESCRIPTION.toLocaleString()}
              </Text>
              <Group justify="flex-end" gap="sm">
                <Button component={Link} to="/plaintiff" variant="default">
                  Cancel
                </Button>
                <Button type="submit" loading={submit.isPending}>
                  Submit request
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <NextSteps />
        </Grid.Col>
      </Grid>
    </>
  );
}
