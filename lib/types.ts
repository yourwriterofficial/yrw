// lib/types.ts

// ==================== Database Row Types ====================

export interface Profile {
  id: string; // UUID from auth.users
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
}

export type ServiceTier = 'GOLD' | 'SILVER' | 'BRONZE' | 'STANDARD' | 'CUSTOM';
export type WorkflowStatus = 'Briefing Received' | 'Quote Sent' | 'Synthesis Active' | 'Internal Audit' | 'Completed' | 'Cancelled';
export type CorrectionsStatus = 'None' | 'Requested' | 'In Progress' | 'Resubmitted';

export interface Order {
  id: number; // bigserial
  order_id: string; // e.g., RW-123456
  guest_name: string | null;
  guest_email: string | null;
  guest_whatsapp: string | null;
  legal_name: string;
  email: string;
  topic: string;
  word_count: number | null;
  page_count: number | null;
  service_tier: ServiceTier | null;
  financial_quote: number | null;
  workflow_status: WorkflowStatus;
  deadline: string | null; // ISO date string
  reference_style: string | null;
  font_specification: string | null;
  sixty_percent_paid: boolean;
  forty_percent_paid: boolean;
  work_submitted: boolean;
  corrections_status: CorrectionsStatus;
  additional_info: string | null;
  media_link: string | null;
  vault_status: string | null;
  whatsapp_sync: string | null;
  last_activity: string | null;
  created_at: string;
  updated_at: string;
  client_company: string | null;
  client_address: string | null;
  client_phone: string | null;
  payment_structure_type: '60/40' | 'CUSTOM' | null;
  payment_milestones: Array<{
    name: string;
    percentage: number;
    amount: number;
    paid: boolean;
    delivered: boolean;
    paid_at?: string | null;
    tx_ref?: string | null;
  }> | null;
}

export interface PromoCode {
  code: string;
  discount_percent: number;
  active: boolean;
  created_at: string;
}

export interface ReferenceStyle {
  id: number;
  name: string;
  category: string | null;
  active: boolean;
  sort_order: number;
}

export interface FontStyle {
  id: number;
  name: string;
  category: string | null;
  active: boolean;
  sort_order: number;
}

export type InvoiceType = 'DEPOSIT' | 'BALANCE';
export type InvoiceStatus = 'PENDING' | 'PAID';

export interface Invoice {
  id: number;
  order_id: number; // references orders.id
  amount: number;
  type: InvoiceType;
  flutterwave_transaction_ref: string;
  status: InvoiceStatus;
  invoice_pdf_url: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface EmailLog {
  id: number;
  order_id: string | null; // order_id string (RW-...), not numeric id
  recipient: string;
  subject: string;
  status: string;
  sent_at: string;
}

export interface OrderFile {
  id: number;
  order_id: number;
  file_path: string;
  file_name: string;
  file_type: 'brief' | 'extra';
  uploaded_at: string;
}

// ==================== View Types (admin_orders_view) ====================

export interface AdminOrderView {
  "Order ID": string;
  "Timestamp": string;
  "Legal Name": string;
  "Email": string;
  "Research Topic": string;
  "Workflow Status": WorkflowStatus;
  "Deadline": string | null;
  "Financial Quote": number | null;
  "Service Tier": ServiceTier | null;
  "60% Paid": boolean;
  "40% Paid": boolean;
  "Work Submitted": boolean;
  "Corrections Status": CorrectionsStatus;
  "Vault Status": string | null;
  "Reference Style": string | null;
  "Font Specification": string | null;
  "Word Count": number | null;
  "Media Sync": string | null;
  "Additional Info": string | null;
  "Last Activity": string | null;
}

// ==================== API Request/Response Types ====================

export interface CreateInvoiceRequest {
  orderId: string;
  amount: number;
  email: string;
  name: string;
  type: InvoiceType;
}

export interface CreateInvoiceResponse {
  link: string;
  tx_ref: string;
}

export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  orderId?: string;
}

export interface SendEmailResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface CreateOrderServerActionParams {
  orderData: Partial<Order> & {
    service_tier: ServiceTier;
    word_count?: number;
    financial_quote?: number;
    legal_name: string;
    email: string;
    topic: string;
    deadline?: string;
  };
  promoCode: string;
}

export interface CreateOrderServerActionResponse {
  success: boolean;
  orderDbId?: number;
  orderStringId?: string;
  finalQuote?: number;
  error?: string;
}

// ==================== Client Dashboard State ====================

export interface ClientDashboardState {
  loading: boolean;
  user: any; // Supabase user type – can be refined later
  isAdmin: boolean;
  orders: AdminOrderView[];
  currentOrder: AdminOrderView | null;
  countdown: string;
  countdownClass: string;
  lastKnownStatus: WorkflowStatus | null;
  notificationsEnabled: boolean;
  autoRefresh: boolean;
  clientNotes: string;
  correctionText: string;
  processingPayment: boolean;
  downloading: boolean;
  themeMode: 'light' | 'dark' | 'auto';
  isLight: boolean;
}

// ==================== Order Form State ====================

export interface OrderFormState {
  step: number;
  loading: boolean;
  isLoaded: boolean;
  name: string;
  email: string;
  whatsapp: string;
  topic: string;
  plan: ServiceTier;
  customPrice: number;
  refStyle: string;
  fontStyle: string;
  dbRefStyles: string[];
  dbFontStyles: string[];
  briefFile: File | null;
  extraFiles: File[];
  mediaLink: string;
  words: number;
  deadline: string;
  additionalInfo: string;
  promoCode: string;
  promoDiscount: number;
  promoMsg: string;
  accept_terms: boolean;
}

// ==================== Custom Invoice Types ====================

export interface CustomInvoiceMilestone {
  name: string;
  percentage: number;
  amount: number;
  paid: boolean;
  delivered: boolean;
  paid_at?: string | null;
  tx_ref?: string | null;
  trigger?: string;
}

export interface CustomInvoice {
  id: number;
  invoice_number: string;
  client_name: string;
  company_name: string | null;
  address: string | null;
  email: string;
  phone: string | null;
  project_title: string;
  project_description: string | null;
  deliverables: Array<{ category: string; items: string[] }> | null;
  additional_services: string[] | null;
  exclusions: string[] | null;
  timeline: Array<{ weeks: string; phase: string; deliverables: string }> | null;
  milestones: CustomInvoiceMilestone[] | null;
  payment_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
  } | null;
  terms: string[] | null;
  developer_signature_name: string | null;
  developer_signature_date: string | null;
  client_signature_name: string | null;
  client_signature_date: string | null;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}