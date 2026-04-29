import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function RoleGuard({ allowed, children }) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // super_admin always has access
  if (role === 'super_admin' || allowed.includes(role)) {
    return children;
  }
  
  return <Navigate to="/" replace />;
}
