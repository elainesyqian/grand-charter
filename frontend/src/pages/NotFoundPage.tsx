import { Button } from '@mantine/core';
import { Link } from 'react-router';
import { Empty } from '../components/ui';

export function NotFoundPage() {
  return (
    <Empty
      title="Page not found"
      description="The page you're looking for doesn't exist."
      action={
        <Button component={Link} to="/" variant="light" mt="sm">
          Go to my home page
        </Button>
      }
    />
  );
}
