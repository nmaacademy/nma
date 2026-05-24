import { apiPost } from "../lib/apiClient";

interface StartSessionResponse {
  success: boolean;
  data: {
    watch_session_id: number;
    video_id: number;
    playback_session_token: string;
    heartbeat_interval_seconds: number;
  };
}

interface HeartbeatResponse {
  success: boolean;
  data: {
    watch_session_id: number;
    last_heartbeat_at: string;
  };
}

interface EndSessionResponse {
  success: boolean;
  data: {
    watch_session_id: number;
    ended_reason: string;
  };
}

export const watchService = {
  /** Call when the player begins playback. Returns watch_session_id and playback_session_token. */
  startWatchSession: async (videoId: number): Promise<StartSessionResponse> => {
    return apiPost<StartSessionResponse>(`/user/videos/${videoId}/watch-session/start`);
  },

  /** Call on the interval returned by startWatchSession (default 30 s). */
  heartbeatWatchSession: async (
    videoId: number,
    watchSessionId: number,
    currentTimeSecs?: number,
    playbackSessionToken?: string,
  ): Promise<HeartbeatResponse> => {
    return apiPost<HeartbeatResponse>(`/user/videos/${videoId}/watch-session/heartbeat`, {
      watch_session_id:        watchSessionId,
      current_time_seconds:    currentTimeSecs ?? undefined,
      playback_session_token:  playbackSessionToken ?? undefined,
    });
  },

  /** Call when the player pauses, the user navigates away, or playback completes. */
  endWatchSession: async (
    videoId: number,
    watchSessionId: number,
    options?: {
      endedReason?: "user_exit" | "paused" | "completed" | "error" | "video_changed" | "page_exit";
      currentTimeSecs?: number;
      durationSecs?: number;
    },
  ): Promise<EndSessionResponse> => {
    return apiPost<EndSessionResponse>(`/user/videos/${videoId}/watch-session/end`, {
      watch_session_id:      watchSessionId,
      ended_reason:          options?.endedReason ?? "user_exit",
      current_time_seconds:  options?.currentTimeSecs ?? undefined,
      duration_seconds:      options?.durationSecs ?? undefined,
    });
  },
};
