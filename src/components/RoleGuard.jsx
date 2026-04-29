import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RoleGuard({ allowed, children }) {
  const { role } = useAuth();
  
  // super_admin always has access
  if (role === 'super_admin' || allowed.includes(role)) {
    return children;
  }
  
  return <Navigate to="/" replace />;
}
