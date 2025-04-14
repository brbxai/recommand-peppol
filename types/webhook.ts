export type Webhook = {
  id: string;
  teamId: string;
  companyId: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type WebhookFormData = {
  url: string;
  companyId?: string | null;
};

export const defaultWebhookFormData: WebhookFormData = {
  url: "",
  companyId: undefined,
}; 