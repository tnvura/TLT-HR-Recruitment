import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HRManager {
  user_id: string;
  email: string;
}

interface SelectHRManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (hrManagerId: string, hrManagerEmail: string) => void;
}

export function SelectHRManagerDialog({ open, onOpenChange, onConfirm }: SelectHRManagerDialogProps) {
  const { toast } = useToast();
  const [hrManagers, setHRManagers] = useState<HRManager[]>([]);
  const [selectedHRManager, setSelectedHRManager] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchHRManagers();
    }
  }, [open]);

  const fetchHRManagers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("user_id, email")
        .eq("role", "hr_manager")
        .eq("is_active", true)
        .order("email");

      if (error) throw error;
      setHRManagers(data || []);

      if (data && data.length === 0) {
        toast({
          title: "No HR Managers Found",
          description: "There are no active HR managers to assign",
          variant: "destructive",
        });
      }
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

  const handleConfirm = () => {
    if (!selectedHRManager) {
      toast({
        title: "Selection Required",
        description: "Please select an HR Manager",
        variant: "destructive",
      });
      return;
    }

    const manager = hrManagers.find((m) => m.user_id === selectedHRManager);
    if (manager) {
      onConfirm(manager.user_id, manager.email);
      setSelectedHRManager("");
    }
  };

  const handleCancel = () => {
    setSelectedHRManager("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select HR Manager for Approval</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="hr-manager">
              HR Manager <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedHRManager}
              onValueChange={setSelectedHRManager}
              disabled={isLoading || hrManagers.length === 0}
            >
              <SelectTrigger id="hr-manager">
                <SelectValue placeholder={isLoading ? "Loading..." : "Select HR Manager"} />
              </SelectTrigger>
              <SelectContent>
                {hrManagers.map((manager) => (
                  <SelectItem key={manager.user_id} value={manager.user_id}>
                    {manager.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              The selected HR Manager will receive a notification to review and approve this offer.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedHRManager || isLoading}>
            Submit for Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
