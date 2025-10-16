import { useState, useEffect } from "react";
import { Button } from "@core/components/ui/button";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Checkbox } from "@core/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/components/ui/card";
import { AsyncButton } from "@core/components/async-button";
import { toast } from "@core/components/ui/sonner";
import { Plus, Edit, Trash2, X, Check, Mail } from "lucide-react";
import { rc } from "@recommand/lib/client";
import type { CompanyNotificationEmailAddresses } from "@peppol/api/company-notification-emails";
import type { CompanyNotificationEmailAddress } from "@peppol/data/company-notification-emails";
import { stringifyActionFailure } from "@recommand/lib/utils";

const client = rc<CompanyNotificationEmailAddresses>("peppol");

type CompanyNotificationsManagerProps = {
  teamId: string;
  companyId: string;
};

type NotificationEmailFormData = {
  email: string;
  notifyIncoming: boolean;
  notifyOutgoing: boolean;
};

export function CompanyNotificationsManager({ teamId, companyId }: CompanyNotificationsManagerProps) {
  const [notificationEmails, setNotificationEmails] = useState<CompanyNotificationEmailAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NotificationEmailFormData>({
    email: "",
    notifyIncoming: false,
    notifyOutgoing: false,
  });
  const [editFormData, setEditFormData] = useState<NotificationEmailFormData>({
    email: "",
    notifyIncoming: false,
    notifyOutgoing: false,
  });

  useEffect(() => {
    fetchNotificationEmails();
  }, [teamId, companyId]);

  const fetchNotificationEmails = async () => {
    try {
      setIsLoading(true);
      const response = await client[":teamId"]["companies"][":companyId"]["notification-email-addresses"].$get({
        param: { teamId, companyId },
      });
      const json = await response.json();

      if (!json.success) {
        toast.error(stringifyActionFailure(json.errors));
        return;
      }

      setNotificationEmails(
        (json.notificationEmailAddresses || []).map((ne) => ({
          ...ne,
          createdAt: new Date(ne.createdAt),
          updatedAt: new Date(ne.updatedAt),
        }))
      );
    } catch (error) {
      console.error("Error fetching notification email addresses:", error);
      toast.error("Failed to load notification email addresses: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!formData.notifyIncoming && !formData.notifyOutgoing) {
      toast.error("Please select at least one notification type");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await client[":teamId"]["companies"][":companyId"]["notification-email-addresses"].$post({
        param: { teamId, companyId },
        json: formData,
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Notification email address added successfully");
      setFormData({ email: "", notifyIncoming: false, notifyOutgoing: false });
      setIsAdding(false);
    } catch (error) {
      toast.error("Failed to add notification email address: " + error);
    } finally {
      setIsSubmitting(false);
      fetchNotificationEmails();
    }
  };

  const handleEdit = async () => {
    if (!editingId) {
      toast.error("No notification email address selected for editing");
      return;
    }
    if (!editFormData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!editFormData.notifyIncoming && !editFormData.notifyOutgoing) {
      toast.error("Please select at least one notification type");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await client[":teamId"]["companies"][":companyId"]["notification-email-addresses"][":notificationEmailAddressId"].$put({
        param: { teamId, companyId, notificationEmailAddressId: editingId },
        json: editFormData,
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Notification email address updated successfully");
      setEditingId(null);
      setEditFormData({ email: "", notifyIncoming: false, notifyOutgoing: false });
    } catch (error) {
      toast.error("Failed to update notification email address: " + error);
    } finally {
      setIsSubmitting(false);
      fetchNotificationEmails();
    }
  };

  const handleDelete = async (notificationEmailId: string) => {
    try {
      const response = await client[":teamId"]["companies"][":companyId"]["notification-email-addresses"][":notificationEmailAddressId"].$delete({
        param: { teamId, companyId, notificationEmailAddressId: notificationEmailId },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Notification email address deleted successfully");
    } catch (error) {
      toast.error("Failed to delete notification email address: " + error);
    } finally {
      fetchNotificationEmails();
    }
  };

  const startEdit = (notificationEmailAddress: CompanyNotificationEmailAddress) => {
    setEditingId(notificationEmailAddress.id);
    setEditFormData({
      email: notificationEmailAddress.email,
      notifyIncoming: notificationEmailAddress.notifyIncoming,
      notifyOutgoing: notificationEmailAddress.notifyOutgoing,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({ email: "", notifyIncoming: false, notifyOutgoing: false });
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setFormData({ email: "", notifyIncoming: false, notifyOutgoing: false });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Manage email notifications for documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription className="text-balance">
              Configure email addresses to receive notifications when documents are sent or received.
            </CardDescription>
          </div>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="h-4 w-4" />
              Add Email
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-email">Email Address</Label>
                <Input
                  id="add-email"
                  type="email"
                  placeholder="notifications@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label>Notify for</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="add-incoming"
                    checked={formData.notifyIncoming}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notifyIncoming: checked === true })
                    }
                  />
                  <label
                    htmlFor="add-incoming"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Incoming documents
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="add-outgoing"
                    checked={formData.notifyOutgoing}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notifyOutgoing: checked === true })
                    }
                  />
                  <label
                    htmlFor="add-outgoing"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Outgoing documents
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <AsyncButton onClick={handleAdd} size="sm" disabled={isSubmitting}>
                <Check className="h-4 w-4" />
                Add
              </AsyncButton>
              <Button onClick={cancelAdd} variant="outline" size="sm" disabled={isSubmitting}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {notificationEmails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notification emails configured</p>
              <p className="text-sm">Add an email address to receive notifications</p>
            </div>
          ) : (
            notificationEmails.map((notificationEmail) => (
              <div key={notificationEmail.id} className="flex items-center justify-between p-3 border rounded-lg gap-4">
                {editingId === notificationEmail.id ? (
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-email-${notificationEmail.id}`} className="text-xs">
                        Email Address
                      </Label>
                      <Input
                        id={`edit-email-${notificationEmail.id}`}
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs">Notify for</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-incoming-${notificationEmail.id}`}
                          checked={editFormData.notifyIncoming}
                          onCheckedChange={(checked) =>
                            setEditFormData({ ...editFormData, notifyIncoming: checked === true })
                          }
                        />
                        <label
                          htmlFor={`edit-incoming-${notificationEmail.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Incoming invoices
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-outgoing-${notificationEmail.id}`}
                          checked={editFormData.notifyOutgoing}
                          onCheckedChange={(checked) =>
                            setEditFormData({ ...editFormData, notifyOutgoing: checked === true })
                          }
                        />
                        <label
                          htmlFor={`edit-outgoing-${notificationEmail.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Outgoing invoices
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <AsyncButton onClick={handleEdit} size="sm" variant="default" disabled={isSubmitting}>
                        <Check className="h-4 w-4" />
                        Save Changes
                      </AsyncButton>
                      <Button onClick={cancelEdit} size="sm" variant="outline" disabled={isSubmitting}>
                        <X className="h-4 w-4" />
                        Cancel Edit
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="font-medium">{notificationEmail.email}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                        {notificationEmail.notifyIncoming && <span>Incoming</span>}
                        {notificationEmail.notifyIncoming && notificationEmail.notifyOutgoing && <span>•</span>}
                        {notificationEmail.notifyOutgoing && <span>Outgoing</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => startEdit(notificationEmail)} size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AsyncButton onClick={() => handleDelete(notificationEmail.id)} size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4" />
                      </AsyncButton>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
