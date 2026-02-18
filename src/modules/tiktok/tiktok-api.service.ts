import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

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

@Injectable()
export class TikTokApiService {
    private readonly logger = new Logger(TikTokApiService.name);
    private readonly clientKey: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;

    private readonly TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
    private readonly TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
    private readonly TIKTOK_USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
    private readonly TIKTOK_VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';

    private readonly VIDEO_FIELDS = [
        'id',
        'title',
        'video_description',
        'cover_image_url',
        'share_url',
        'create_time',
        'duration',
        'like_count',
        'comment_count',
        'share_count',
        'view_count',
    ];

    // Scopes needed for our audit app
    private readonly SCOPES = [
        'user.info.basic',
        'user.info.profile',
        'user.info.stats',
        'video.list',
    ];

    constructor(private readonly configService: ConfigService) {
        this.clientKey = this.configService.getOrThrow<string>('TIKTOK_CLIENT_KEY').trim();
        this.clientSecret = this.configService.getOrThrow<string>('TIKTOK_CLIENT_SECRET').trim();
        this.redirectUri = this.configService.getOrThrow<string>('TIKTOK_REDIRECT_URI').trim();
    }

    /**
     * Generate a cryptographically secure code_verifier for PKCE.
     */
    generateCodeVerifier(): string {
        return crypto.randomBytes(32).toString('base64url');
    }

    /**
     * Derive code_challenge from code_verifier using SHA-256.
     */
    generateCodeChallenge(codeVerifier: string): string {
        return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    }

    /**
     * Generate the TikTok OAuth authorization URL with PKCE.
     * The frontend redirects the user to this URL.
     */
    getAuthorizationUrl(state: string, codeChallenge: string): string {
        const params = new URLSearchParams({
            client_key: this.clientKey,
            response_type: 'code',
            scope: this.SCOPES.join(','),
            redirect_uri: this.redirectUri,
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        const url = `${this.TIKTOK_AUTH_URL}?${params.toString()}`;
        this.logger.debug(`OAuth URL generated with client_key="${this.clientKey}" redirect_uri="${this.redirectUri}"`);
        this.logger.debug(`Full OAuth URL: ${url}`);
        return url;
    }

    /**
     * Exchange an authorization code for access + refresh tokens.
     */
    async exchangeCodeForToken(code: string, codeVerifier: string): Promise<TikTokTokenResponse> {
        this.logger.log('Exchanging authorization code for access token...');

        const body = new URLSearchParams({
            client_key: this.clientKey,
            client_secret: this.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: this.redirectUri,
            code_verifier: codeVerifier,
        });

        const response = await fetch(this.TIKTOK_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache',
            },
            body: body.toString(),
        });

        const data = await response.json();

        if (data.error) {
            this.logger.error(`Token exchange failed: ${data.error} - ${data.error_description}`);
            throw new Error(`TikTok OAuth error: ${data.error_description || data.error}`);
        }

        this.logger.log(`Token obtained for open_id: ${data.open_id}`);
        return data as TikTokTokenResponse;
    }

    /**
     * Refresh an expired access token using the refresh token.
     */
    async refreshAccessToken(refreshToken: string): Promise<TikTokTokenResponse> {
        this.logger.log('Refreshing access token...');

        const body = new URLSearchParams({
            client_key: this.clientKey,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        const response = await fetch(this.TIKTOK_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache',
            },
            body: body.toString(),
        });

        const data = await response.json();

        if (data.error) {
            this.logger.error(`Token refresh failed: ${data.error} - ${data.error_description}`);
            throw new Error(`TikTok refresh error: ${data.error_description || data.error}`);
        }

        this.logger.log('Access token refreshed successfully');
        return data as TikTokTokenResponse;
    }

    /**
     * Fetch user info from the TikTok API v2.
     * Requires a valid access token with the appropriate scopes.
     */
    async getUserInfo(accessToken: string): Promise<TikTokUserInfo> {
        const fields = [
            'open_id',
            'union_id',
            'avatar_url',
            'avatar_large_url',
            'display_name',
            'bio_description',
            'profile_deep_link',
            'is_verified',
            'username',
            'follower_count',
            'following_count',
            'likes_count',
            'video_count',
        ];

        const url = `${this.TIKTOK_USERINFO_URL}?fields=${fields.join(',')}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        const result = await response.json();

        if (result.error?.code !== 'ok' && result.error?.code) {
            this.logger.error(`User info request failed: ${JSON.stringify(result.error)}`);
            throw new Error(`TikTok API error: ${result.error.message || result.error.code}`);
        }

        this.logger.log(`User info fetched for: ${result.data?.user?.display_name || 'unknown'}`);
        return result.data?.user as TikTokUserInfo;
    }

    /**
     * Fetch a single page of the user's public videos.
     */
    async listVideos(accessToken: string, cursor?: number): Promise<{ videos: TikTokVideo[]; has_more: boolean; cursor: number }> {
        const body: Record<string, unknown> = {
            max_count: 20,
        };
        if (cursor !== undefined) {
            body.cursor = cursor;
        }

        const url = `${this.TIKTOK_VIDEO_LIST_URL}?fields=${this.VIDEO_FIELDS.join(',')}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const result = await response.json();

        if (result.error?.code !== 'ok' && result.error?.code) {
            this.logger.error(`Video list request failed: ${JSON.stringify(result.error)}`);
            return { videos: [], has_more: false, cursor: 0 };
        }

        return {
            videos: (result.data?.videos || []) as TikTokVideo[],
            has_more: result.data?.has_more || false,
            cursor: result.data?.cursor || 0,
        };
    }

    /**
     * Fetch all videos up to a maximum number of pages, returning a flat array.
     */
    async listAllVideos(accessToken: string, maxPages = 5): Promise<TikTokVideo[]> {
        const allVideos: TikTokVideo[] = [];
        let videoCursor: number | undefined;
        let pagesFetched = 0;

        do {
            const page = await this.listVideos(accessToken, videoCursor);
            allVideos.push(...page.videos);
            videoCursor = page.has_more ? page.cursor : undefined;
            pagesFetched++;
        } while (videoCursor && pagesFetched < maxPages);

        this.logger.log(`Fetched ${allVideos.length} videos across ${pagesFetched} page(s)`);
        return allVideos;
    }

    /**
     * Revoke access for a user's token.
     */
    async revokeToken(accessToken: string): Promise<void> {

        const body = new URLSearchParams({
            client_key: this.clientKey,
            client_secret: this.clientSecret,
            token: accessToken,
        });

        await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        this.logger.log('Token revoked successfully');
    }
}
