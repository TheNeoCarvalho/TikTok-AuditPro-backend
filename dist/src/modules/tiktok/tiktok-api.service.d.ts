import { ConfigService } from '@nestjs/config';
export interface TikTokTokenResponse {
    open_id: string;
    scope: string;
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
    token_type: string;
}
export interface TikTokUserInfo {
    open_id: string;
    union_id?: string;
    avatar_url?: string;
    avatar_url_100?: string;
    avatar_large_url?: string;
    display_name?: string;
    bio_description?: string;
    profile_deep_link?: string;
    is_verified?: boolean;
    username?: string;
    follower_count?: number;
    following_count?: number;
    likes_count?: number;
    video_count?: number;
}
export interface TikTokVideo {
    id: string;
    title?: string;
    video_description?: string;
    cover_image_url?: string;
    share_url?: string;
    create_time?: number;
    duration?: number;
    like_count: number;
    comment_count: number;
    share_count: number;
    view_count: number;
}
export declare class TikTokApiService {
    private readonly configService;
    private readonly logger;
    private readonly clientKey;
    private readonly clientSecret;
    private readonly redirectUri;
    private readonly TIKTOK_AUTH_URL;
    private readonly TIKTOK_TOKEN_URL;
    private readonly TIKTOK_USERINFO_URL;
    private readonly TIKTOK_VIDEO_LIST_URL;
    private readonly VIDEO_FIELDS;
    private readonly SCOPES;
    constructor(configService: ConfigService);
    generateCodeVerifier(): string;
    generateCodeChallenge(codeVerifier: string): string;
    getAuthorizationUrl(state: string, codeChallenge: string): string;
    exchangeCodeForToken(code: string, codeVerifier: string): Promise<TikTokTokenResponse>;
    refreshAccessToken(refreshToken: string): Promise<TikTokTokenResponse>;
    getUserInfo(accessToken: string): Promise<TikTokUserInfo>;
    listVideos(accessToken: string, cursor?: number): Promise<{
        videos: TikTokVideo[];
        has_more: boolean;
        cursor: number;
    }>;
    listAllVideos(accessToken: string, maxPages?: number): Promise<TikTokVideo[]>;
    revokeToken(accessToken: string): Promise<void>;
}
