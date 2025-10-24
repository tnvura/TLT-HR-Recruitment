import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, CheckCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Notification } from "@/hooks/useNotifications";

interface NotificationDropdownProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationDropdownProps) {
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }

    // Navigate to related candidate if available
    if (notification.related_candidate_id) {
      navigate(`/candidates/${notification.related_candidate_id}`);
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Bell className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No notifications</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="w-80">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="text-xs"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>
      <ScrollArea className="h-96">
        <div className="divide-y">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                !notification.is_read ? "bg-blue-50" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {notification.type.includes("approval") ? (
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{notification.title}</p>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
