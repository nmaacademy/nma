import { apiGet, apiPost } from "../lib/apiClient";

export interface NetopiaCustomerAction {
  type?: string | null;
  url?: string | null;
  authentication_token?: string | null;
  form_data?: Record<string, string>;
}

export interface CheckoutPaymentResponse {
  order_id?: string;
  ntp_id?: string | null;
  status: string;
  amount?: number;
  currency?: string;
  error_message?: string | null;
  customer_action?: NetopiaCustomerAction;
  course?: { slug: string };
}

export const paymentService = {
  // POST /api/payments/checkout
  createCheckoutSession: async (
    courseSlug: string,
    discountCode?: string,
  ) => {
    const res = await apiPost<{ success: boolean; data: { payment: CheckoutPaymentResponse } }>("/payments/checkout", {
      course_slug: courseSlug,
      discount_code: discountCode,
    });

    return res.data.payment;
  },

  getPaymentStatus: async (orderId: string) => {
    const res = await apiGet<{ success: boolean; data: { payment: CheckoutPaymentResponse } }>(`/payments/${orderId}/status`);
    return res.data.payment;
  },

  // Future API: POST /api/payments/validate-discount
  validateDiscount: async (code: string) => {
    return new Promise<{valid: boolean; percentage: number}>((resolve) => {
      setTimeout(() => {
        if (code === "NMA20") {
          resolve({ valid: true, percentage: 20 });
        } else {
          resolve({ valid: false, percentage: 0 });
        }
      }, 500);
    });
  }
}
