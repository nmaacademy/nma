import { apiGet } from "../lib/apiClient";

// ─── API response shapes ──────────────────────────────────────────────────────

export interface Announcement {
  id: number;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string | null;
}

export interface AnnouncementMeta {
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

export interface GetAnnouncementsParams {
  page?: number;
  per_page?: number;
}

export interface GetAnnouncementsResponse {
  success: boolean;
  message: string;
  data: {
    course: { id: number; title: string; slug: string };
    announcements: Announcement[];
    meta: AnnouncementMeta;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const announcementService = {
  // GET /api/user/courses/{slug}/announcements
  getCourseAnnouncements: async (
    slug: string,
    params: GetAnnouncementsParams = {},
  ): Promise<GetAnnouncementsResponse> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    return apiGet<GetAnnouncementsResponse>(
      `/user/courses/${slug}/announcements${query ? `?${query}` : ""}`,
    );
  },
};
