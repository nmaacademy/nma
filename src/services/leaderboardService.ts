import { apiGet } from "../lib/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  initials: string;
  progress_percent: number;
  completed_videos_count: number;
  total_videos_count: number;
  is_completed: boolean;
  completed_at_course: string | null;
  joined_at: string | null;
}

export interface LeaderboardCurrentUser {
  rank: number;
  progress_percent: number;
  completed_videos_count: number;
  total_videos_count: number;
  is_completed: boolean;
  completed_at_course: string | null;
  joined_at: string | null;
}

export interface LeaderboardMeta {
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

export interface LeaderboardResponse {
  success: boolean;
  message: string;
  data: {
    course: { id: number; title: string; slug: string };
    leaderboard: LeaderboardEntry[];
    current_user: LeaderboardCurrentUser | null;
    meta: LeaderboardMeta;
  };
}

export interface GetLeaderboardParams {
  page?: number;
  per_page?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const leaderboardService = {
  // GET /api/user/courses/{slug}/leaderboard
  getCourseLeaderboard: async (
    slug: string,
    params: GetLeaderboardParams = {},
  ): Promise<LeaderboardResponse> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.per_page) qs.set("per_page", String(params.per_page));
    const query = qs.toString();
    return apiGet<LeaderboardResponse>(
      `/user/courses/${slug}/leaderboard${query ? `?${query}` : ""}`,
    );
  },
};
