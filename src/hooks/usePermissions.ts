import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Permission {
  resource: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface UsePermissionsReturn {
  canCreate: (resource: string) => boolean;
  canRead: (resource: string) => boolean;
  canUpdate: (resource: string) => boolean;
  canDelete: (resource: string) => boolean;
  isHRAdmin: boolean;
  isHRStaff: boolean;
  isHRManager: boolean;
  isInterviewer: boolean;
  role: string | null;
  isLoading: boolean;
}

export const usePermissions = (): UsePermissionsReturn => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Fetch user role
        const { data: userRole } = await (supabase as any)
          .from('user_roles')
          .select('role, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!userRole) {
          setIsLoading(false);
          return;
        }

        setRole(userRole.role);

        // Fetch role permissions
        const { data: rolePermissions } = await (supabase as any)
          .from('role_permissions')
          .select('resource, can_create, can_read, can_update, can_delete')
          .eq('role', userRole.role);

        if (rolePermissions) {
          setPermissions(rolePermissions);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  const canCreate = (resource: string): boolean => {
    const permission = permissions.find(p => p.resource === resource);
    return permission?.can_create ?? false;
  };

  const canRead = (resource: string): boolean => {
    const permission = permissions.find(p => p.resource === resource);
    return permission?.can_read ?? false;
  };

  const canUpdate = (resource: string): boolean => {
    const permission = permissions.find(p => p.resource === resource);
    return permission?.can_update ?? false;
  };

  const canDelete = (resource: string): boolean => {
    const permission = permissions.find(p => p.resource === resource);
    return permission?.can_delete ?? false;
  };

  return {
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    isHRAdmin: role === 'hr_admin',
    isHRStaff: role === 'hr_staff',
    isHRManager: role === 'hr_manager',
    isInterviewer: role === 'interviewer',
    role,
    isLoading,
  };
};
