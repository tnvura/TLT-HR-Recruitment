import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          navigate('/login');
          return;
        }

        // Check if user has a role
        const { data: roleData } = await (supabase as any)
          .from('user_roles')
          .select('role, is_active')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!roleData) {
          // User doesn't have a role record - create a pending one
          console.log('Creating pending user_roles record for:', user.email);
          console.log('User ID:', user.id);

          const { data: insertData, error: insertError } = await (supabase as any)
            .from('user_roles')
            .insert({
              user_id: user.id,
              email: user.email,
              role: 'pending',
              is_active: false,
              department: null,
            })
            .select();

          if (insertError) {
            console.error('❌ Error creating user_roles record:', insertError);
            console.error('Error details:', JSON.stringify(insertError, null, 2));
          } else {
            console.log('✅ Successfully created user_roles record:', insertData);
          }

          // User not approved yet
          toast({
            title: "Account Pending Approval",
            description: "Your account needs HR approval. Please contact hr.admin@talaadthai.com",
            variant: "destructive",
          });
          navigate('/access-pending');
        } else if (!roleData.is_active) {
          // User exists but not active
          toast({
            title: "Account Pending Approval",
            description: "Your account needs HR approval. Please contact hr.admin@talaadthai.com",
            variant: "destructive",
          });
          navigate('/access-pending');
        } else {
          // User has active role, proceed to candidates page
          toast({
            title: "Success",
            description: "Logged in successfully",
          });
          navigate('/candidates');
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        navigate('/login');
      } finally {
        setIsChecking(false);
      }
    };

    checkUserRole();
  }, [navigate, toast]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return null;
}
