import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, UserCheck, UserX } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminUsers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('HR');

  // Approval dialog state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedPendingUser, setSelectedPendingUser] = useState<any>(null);
  const [approvalRole, setApprovalRole] = useState('');
  const [approvalDepartment, setApprovalDepartment] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    checkAccess();
    fetchUsers();
    fetchPendingUsers();
  }, []);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }

    const { data: roleData } = await (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!roleData || roleData.role !== 'hr_admin') {
      navigate('/unauthorized');
    }
  };

  const fetchUsers = async () => {
    // Fetch ALL users from user_roles table
    const { data, error } = await (supabase as any)
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('Fetched all users from user_roles:', data);
    console.log('Fetch error:', error);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
      return;
    }

    // Separate users into approved (with actual role) and pending (role is 'pending')
    const approved = data?.filter((u: any) => u.role && u.role !== 'pending') || [];
    const pending = data?.filter((u: any) => u.role === 'pending' || u.role === null) || [];

    console.log('Approved users:', approved);
    console.log('Pending users:', pending);

    setUsers(approved);
    setPendingUsers(pending);
  };

  const fetchPendingUsers = async () => {
    // This is now handled in fetchUsers()
    // Keeping this function for compatibility but it does nothing
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await (supabase as any)
        .from('user_roles')
        .insert({
          email: email.toLowerCase(),
          role,
          department,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User added successfully",
      });

      setEmail('');
      setRole('');
      setDepartment('HR');
      fetchUsers();
      fetchPendingUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('user_roles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openApprovalDialog = (user: any) => {
    setSelectedPendingUser(user);
    setApprovalRole('');
    setApprovalDepartment('');
    setShowApprovalDialog(true);
  };

  const handleApproveUser = async () => {
    if (!selectedPendingUser || !approvalRole) {
      toast({
        title: "Error",
        description: "Please select a role",
        variant: "destructive",
      });
      return;
    }

    if (!approvalDepartment) {
      toast({
        title: "Error",
        description: "Please enter a department",
        variant: "destructive",
      });
      return;
    }

    setIsApproving(true);

    try {
      const { error } = await (supabase as any)
        .from('user_roles')
        .update({
          role: approvalRole,
          department: approvalDepartment,
          is_active: true,
        })
        .eq('id', selectedPendingUser.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User ${selectedPendingUser.email} approved as ${approvalRole}`,
      });

      setShowApprovalDialog(false);
      setSelectedPendingUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/candidates')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Candidates
        </Button>

        <div className="grid gap-6">
          {/* Add New User */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New User
              </CardTitle>
              <CardDescription>
                Pre-approve a user by adding their email and role. They will gain access when they log in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUser} className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@talaadthai.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={setRole} required>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr_admin">HR Admin</SelectItem>
                      <SelectItem value="hr_staff">HR Staff</SelectItem>
                      <SelectItem value="interviewer">Interviewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? 'Adding...' : 'Add User'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Pending Users */}
          {pendingUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-warning" />
                  Pending Approval ({pendingUsers.length})
                </CardTitle>
                <CardDescription>
                  Users who have logged in but don't have assigned roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Logged In</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => openApprovalDialog(user)}
                          >
                            Approve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Approved Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Approved Users
              </CardTitle>
              <CardDescription>
                Manage existing user roles and access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'hr_admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>
                        {user.user_id ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Linked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Waiting
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={() => toggleUserStatus(user.id, user.is_active)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve User Access</DialogTitle>
            <DialogDescription>
              Assign a role and department to {selectedPendingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approval-role">Role *</Label>
              <Select value={approvalRole} onValueChange={setApprovalRole}>
                <SelectTrigger id="approval-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hr_admin">HR Admin</SelectItem>
                  <SelectItem value="hr_staff">HR Staff</SelectItem>
                  <SelectItem value="interviewer">Interviewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="approval-department">Department *</Label>
              <Input
                id="approval-department"
                value={approvalDepartment}
                onChange={(e) => setApprovalDepartment(e.target.value)}
                placeholder="e.g., HR, IT, Sales"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveUser}
              disabled={isApproving || !approvalRole || !approvalDepartment}
            >
              {isApproving ? 'Approving...' : 'Approve User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
