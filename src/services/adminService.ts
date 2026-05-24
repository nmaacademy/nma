import { apiGet, apiPost, apiPut, apiDelete } from "../lib/apiClient";
import { Lead, User } from "../types";

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalLeads: number;
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  archivedCourses: number;
  activeAccesses: number;
  pendingAccesses: number;
  revenue: number;
  paymentPending: number;
  emailsSent: number;
  emailsFailed: number;
  recentActivity: Array<{ id: string; action: string; time: string | null }>;
}

export interface AdminUserDetail extends User {
  raw_role?: "user" | "admin" | "superadmin";
  status?: "unverified" | "active" | "suspended";
  marketing_consent?: boolean;
  last_login_at?: string | null;
  email_verified_at?: string | null;
  active_courses_count?: number;
  active_sessions_count?: number;
  courses?: Array<{
    id: number;
    course_id: number;
    course_title: string | null;
    access_status: string;
    source: string | null;
    purchased_at: string | null;
    created_at: string | null;
  }>;
  sessions?: Array<{
    id: number;
    device_name: string | null;
    browser: string | null;
    ip_address: string | null;
    last_active_at: string | null;
    is_active: boolean;
  }>;
  emails?: Array<{
    id: number;
    type: string;
    subject: string;
    status: string;
    sent_at: string | null;
  }>;
}

// ─── Admin Announcement types ─────────────────────────────────────────────────

export type AnnouncementStatus = "draft" | "published" | "hidden";

export interface AdminAnnouncement {
  id: number;
  course_id: number;
  title: string;
  body_excerpt: string;
  body?: string;
  status: AnnouncementStatus;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  creator: { id: number; name: string } | null;
}

export interface AdminAnnouncementPayload {
  title: string;
  body: string;
  status: AnnouncementStatus;
  is_pinned?: boolean;
  published_at?: string | null;
}

export interface AdminAnnouncementListParams {
  page?: number;
  per_page?: number;
  status?: AnnouncementStatus | "";
  search?: string;
  pinned?: "0" | "1" | "";
}

export interface AdminAnnouncementMeta {
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

export const adminService = {
  getAdminStats: async (): Promise<AdminStats> => {
    const res = await apiGet<{ success: boolean; data: { stats: AdminStats } }>("/admin/stats");
    return res.data.stats;
  },

  getUsers: async (): Promise<AdminUserDetail[]> => {
    const res = await apiGet<{ success: boolean; data: { users: AdminUserDetail[] } }>("/admin/users");
    return res.data.users;
  },

  getUserById: async (userId: string): Promise<AdminUserDetail | undefined> => {
    try {
      const res = await apiGet<{ success: boolean; data: { user: AdminUserDetail } }>(`/admin/users/${userId}`);
      return res.data.user;
    } catch {
      return undefined;
    }
  },

  updateUserStatus: async (
    userId: string,
    status: "unverified" | "active" | "suspended",
  ): Promise<AdminUserDetail> => {
    const res = await apiPut<{ success: boolean; data: { user: AdminUserDetail } }>(
      `/admin/users/${userId}/status`,
      { status },
    );
    return res.data.user;
  },

  getLeads: async (): Promise<Lead[]> => {
    const res = await apiGet<{ success: boolean; data: { leads: Lead[] } }>("/admin/leads");
    return res.data.leads;
  },

  sendEmailCampaign: async (payload: {
    subject: string;
    body?: string;
    segment?: "all" | "leads" | "active_buyers" | "non_buyers";
  }): Promise<{ sent_count: number; segment: string }> => {
    const res = await apiPost<{
      success: boolean;
      data: { sent_count: number; segment: string };
    }>("/admin/email-campaigns", payload);
    return res.data;
  },

  // ─── Announcements ─────────────────────────────────────────────────────────

  getAdminCourseAnnouncements: async (
    courseId: number,
    params: AdminAnnouncementListParams = {},
  ): Promise<{ announcements: AdminAnnouncement[]; meta: AdminAnnouncementMeta; course: { id: number; title: string; slug: string } }> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page", String(params.page));
    if (params.per_page) qs.set("per_page", String(params.per_page));
    if (params.status)   qs.set("status", params.status);
    if (params.search)   qs.set("search", params.search);
    if (params.pinned)   qs.set("pinned", params.pinned);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    const res = await apiGet<{ success: boolean; data: { announcements: AdminAnnouncement[]; meta: AdminAnnouncementMeta; course: { id: number; title: string; slug: string } } }>(
      `/admin/courses/${courseId}/announcements${query}`,
    );
    return res.data;
  },

  createAdminAnnouncement: async (
    courseId: number,
    payload: AdminAnnouncementPayload,
  ): Promise<AdminAnnouncement> => {
    const res = await apiPost<{ success: boolean; data: { announcement: AdminAnnouncement } }>(
      `/admin/courses/${courseId}/announcements`,
      payload,
    );
    return res.data.announcement;
  },

  getAdminAnnouncement: async (id: number): Promise<AdminAnnouncement> => {
    const res = await apiGet<{ success: boolean; data: { announcement: AdminAnnouncement } }>(
      `/admin/announcements/${id}`,
    );
    return res.data.announcement;
  },

  updateAdminAnnouncement: async (
    id: number,
    payload: AdminAnnouncementPayload,
  ): Promise<AdminAnnouncement> => {
    const res = await apiPut<{ success: boolean; data: { announcement: AdminAnnouncement } }>(
      `/admin/announcements/${id}`,
      payload,
    );
    return res.data.announcement;
  },

  deleteAdminAnnouncement: async (id: number): Promise<void> => {
    await apiDelete<{ success: boolean }>(`/admin/announcements/${id}`);
  },
};
