import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function RoleGuard({ allowedRoles, children }) {
  const { role, loading } = useAuth();
  
  if (loading) return null;
  
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}
