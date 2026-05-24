import { apiGet, apiPost, apiDelete } from "../lib/apiClient";

// ─── API response shapes ──────────────────────────────────────────────────────

export interface CommunityAuthor {
  user_id: number;
  name: string;
  initials: string;
}

export interface CommunityPostListItem {
  id: number;
  title: string;
  body_excerpt: string;
  author: CommunityAuthor;
  replies_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  last_reply_at: string | null;
  created_at: string | null;
}

export interface CommunityPost {
  id: number;
  title: string;
  body: string;
  author: CommunityAuthor;
  replies_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  last_reply_at: string | null;
  created_at: string | null;
}

export interface CommunityReply {
  id: number;
  body: string;
  author: CommunityAuthor;
  created_at: string | null;
}

export interface CommunityMeta {
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

export interface GetCommunityPostsParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: "latest_activity" | "newest" | "most_replies" | "pinned_first";
}

export interface GetCommunityPostsResponse {
  success: boolean;
  message: string;
  data: {
    course: { id: number; title: string; slug: string };
    posts: CommunityPostListItem[];
    meta: CommunityMeta;
  };
}

export interface GetCommunityPostResponse {
  success: boolean;
  message: string;
  data: {
    course: { id: number; title: string; slug: string };
    post: CommunityPost;
    replies: CommunityReply[];
    replies_meta: CommunityMeta;
  };
}

export interface CreatePostPayload {
  title: string;
  body: string;
}

export interface CreatePostResponse {
  success: boolean;
  message: string;
  data: { post: CommunityPost };
}

export interface CreateReplyPayload {
  body: string;
}

export interface CreateReplyResponse {
  success: boolean;
  message: string;
  data: {
    reply: CommunityReply;
    post: { id: number; replies_count: number; last_reply_at: string | null };
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const communityService = {
  // GET /api/user/courses/{slug}/community/posts
  getCommunityPosts: async (
    slug: string,
    params: GetCommunityPostsParams = {},
  ): Promise<GetCommunityPostsResponse> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.per_page) qs.set("per_page", String(params.per_page));
    if (params.search)   qs.set("search",   params.search);
    if (params.sort)     qs.set("sort",     params.sort);
    const query = qs.toString();
    return apiGet<GetCommunityPostsResponse>(
      `/user/courses/${slug}/community/posts${query ? `?${query}` : ""}`,
    );
  },

  // POST /api/user/courses/{slug}/community/posts
  createCommunityPost: async (
    slug: string,
    payload: CreatePostPayload,
  ): Promise<CreatePostResponse> => {
    return apiPost<CreatePostResponse>(
      `/user/courses/${slug}/community/posts`,
      payload,
    );
  },

  // GET /api/user/courses/{slug}/community/posts/{postId}
  getCommunityPost: async (
    slug: string,
    postId: number,
    repliesPage = 1,
  ): Promise<GetCommunityPostResponse> => {
    return apiGet<GetCommunityPostResponse>(
      `/user/courses/${slug}/community/posts/${postId}?replies_page=${repliesPage}`,
    );
  },

  // POST /api/user/courses/{slug}/community/posts/{postId}/replies
  createCommunityReply: async (
    slug: string,
    postId: number,
    payload: CreateReplyPayload,
  ): Promise<CreateReplyResponse> => {
    return apiPost<CreateReplyResponse>(
      `/user/courses/${slug}/community/posts/${postId}/replies`,
      payload,
    );
  },

  // DELETE /api/user/courses/{slug}/community/posts/{postId}
  deleteCommunityPost: async (slug: string, postId: number): Promise<void> => {
    await apiDelete(`/user/courses/${slug}/community/posts/${postId}`);
  },

  // DELETE /api/user/courses/{slug}/community/posts/{postId}/replies/{replyId}
  deleteCommunityReply: async (
    slug: string,
    postId: number,
    replyId: number,
  ): Promise<void> => {
    await apiDelete(
      `/user/courses/${slug}/community/posts/${postId}/replies/${replyId}`,
    );
  },
};
