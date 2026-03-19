import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-gray-8">404</h1>
        <p className="mt-2 text-lg text-dark-gray">Page not found</p>
        <Button className="mt-6" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    </div>
  );
}
