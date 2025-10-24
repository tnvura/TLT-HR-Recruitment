import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AccessPending() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-warning" />
          </div>
          <CardTitle className="text-2xl">Access Pending Approval</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your account is pending approval. Please contact HR administration to get access to the system.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <a href="mailto:hr.admin@talaadthai.com" className="text-primary hover:underline">
              hr.admin@talaadthai.com
            </a>
          </div>
          <div className="flex gap-2 justify-center pt-4">
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
