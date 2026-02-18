import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TikTokApiService } from './tiktok-api.service';

@Injectable()
export class TikTokOAuthService {
    private readonly logger = new Logger(TikTokOAuthService.name);

    // In-memory state store (for production, use Redis)
    private readonly stateStore = new Map<string, { userId: string; accountId?: string; codeVerifier: string; expiresAt: number }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly tiktokApi: TikTokApiService,
    ) { }

    /**
     * Generate a TikTok OAuth URL and store the CSRF state.
     */
    generateAuthUrl(userId: string, accountId?: string): { url: string; state: string } {
        const state = this.generateState();
        const codeVerifier = this.tiktokApi.generateCodeVerifier();
        const codeChallenge = this.tiktokApi.generateCodeChallenge(codeVerifier);

        this.stateStore.set(state, {
            userId,
            accountId,
            codeVerifier,
            expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        });

        // Cleanup expired states
        this.cleanupStates();

        const url = this.tiktokApi.getAuthorizationUrl(state, codeChallenge);
        return { url, state };
    }

    /**
     * Handle the OAuth callback from TikTok.
     * Exchanges the code for tokens, fetches user info, and links to the account.
     */
    async handleCallback(code: string, state: string) {
        // Validate state
        const stateData = this.stateStore.get(state);
        if (!stateData || stateData.expiresAt < Date.now()) {
            this.stateStore.delete(state);
            throw new Error('Invalid or expired OAuth state. Please try again.');
        }
        this.stateStore.delete(state);

        const { userId, accountId, codeVerifier } = stateData;

        // Exchange code for tokens (with PKCE code_verifier)
        const tokenData = await this.tiktokApi.exchangeCodeForToken(code, codeVerifier);

        // Fetch user info from TikTok
        const userInfo = await this.tiktokApi.getUserInfo(tokenData.access_token);

        const tiktokUsername = userInfo.username || '';
        const now = new Date();

        const tokenFields = {
            openId: tokenData.open_id,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(now.getTime() + tokenData.expires_in * 1000),
            refreshExpiresAt: new Date(now.getTime() + tokenData.refresh_expires_in * 1000),
            scopes: tokenData.scope,
            tiktokId: tokenData.open_id,
            displayName: userInfo.display_name || null,
            bio: userInfo.bio_description || null,
            avatarUrl: userInfo.avatar_large_url || userInfo.avatar_url || null,
            isVerified: userInfo.is_verified || false,
            profileUrl: userInfo.profile_deep_link || null,
        };

        let account;

        if (accountId) {
            // Link to existing account
            account = await this.prisma.tikTokAccount.update({
                where: { id: accountId },
                data: {
                    ...tokenFields,
                    username: tiktokUsername || undefined,
                },
            });
            this.logger.log(`Linked OAuth to existing account: @${account.username}`);
        } else {
            // Try to find existing account by username or create new
            const existingByUsername = tiktokUsername
                ? await this.prisma.tikTokAccount.findUnique({
                    where: { userId_username: { userId, username: tiktokUsername } },
                })
                : null;

            if (existingByUsername) {
                account = await this.prisma.tikTokAccount.update({
                    where: { id: existingByUsername.id },
                    data: tokenFields,
                });
                this.logger.log(`Updated OAuth for existing account: @${account.username}`);
            } else {
                account = await this.prisma.tikTokAccount.create({
                    data: {
                        ...tokenFields,
                        username: tiktokUsername || `tiktok_${tokenData.open_id.slice(0, 8)}`,
                        userId,
                    },
                });
                this.logger.log(`Created new account via OAuth: @${account.username}`);
            }
        }

        // Immediately sync metrics via API
        await this.syncAccountViaApi(account.id);

        return {
            account,
            isNew: !accountId && !tiktokUsername,
        };
    }

    /**
     * Ensure a valid access token for an account.
     * Refreshes the token if it's expired or about to expire.
     */
    async getValidAccessToken(accountId: string): Promise<string | null> {
        const account = await this.prisma.tikTokAccount.findUnique({
            where: { id: accountId },
            select: {
                accessToken: true,
                refreshToken: true,
                tokenExpiresAt: true,
                refreshExpiresAt: true,
            },
        });

        if (!account?.accessToken || !account?.refreshToken) {
            return null; // No OAuth tokens linked
        }

        const now = new Date();
        const bufferMs = 5 * 60 * 1000; // 5 minute buffer

        // Check if access token is still valid
        if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > now.getTime() + bufferMs) {
            return account.accessToken;
        }

        // Check if refresh token is still valid
        if (account.refreshExpiresAt && account.refreshExpiresAt.getTime() < now.getTime()) {
            this.logger.warn(`Refresh token expired for account ${accountId}`);
            // Clear tokens since both are expired
            await this.prisma.tikTokAccount.update({
                where: { id: accountId },
                data: {
                    accessToken: null,
                    refreshToken: null,
                    tokenExpiresAt: null,
                    refreshExpiresAt: null,
                },
            });
            return null;
        }

        // Refresh the access token
        try {
            const tokenData = await this.tiktokApi.refreshAccessToken(account.refreshToken);

            await this.prisma.tikTokAccount.update({
                where: { id: accountId },
                data: {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    tokenExpiresAt: new Date(now.getTime() + tokenData.expires_in * 1000),
                    refreshExpiresAt: new Date(now.getTime() + tokenData.refresh_expires_in * 1000),
                    scopes: tokenData.scope,
                },
            });

            this.logger.log(`Refreshed access token for account ${accountId}`);
            return tokenData.access_token;
        } catch (error) {
            this.logger.error(`Failed to refresh token for account ${accountId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Sync account metrics using the TikTok API (with valid OAuth token).
     */
    async syncAccountViaApi(accountId: string): Promise<boolean> {
        const accessToken = await this.getValidAccessToken(accountId);
        if (!accessToken) {
            this.logger.debug(`No valid token for account ${accountId}, skipping API sync`);
            return false;
        }

        try {
            // 1. Fetch basic profile info
            const userInfo = await this.tiktokApi.getUserInfo(accessToken);

            // 2. Aggregate video metrics (Views, Comments, Shares)
            // Note: We fetch the first page of videos (20) to estimate total views if the account is huge,
            // or all videos if it's a typical account. For MVP, we'll fetch up to 100 videos to avoid long syncs.
            let totalViews = 0;
            let totalComments = 0;
            let totalShares = 0;
            let videoCursor: number | undefined;
            let pagesFetched = 0;
            const MAX_PAGES = 5; // Up to 100 videos

            do {
                const videoData = await this.tiktokApi.listVideos(accessToken, videoCursor);
                for (const video of videoData.videos) {
                    totalViews += Number(video.view_count || 0);
                    totalComments += Number(video.comment_count || 0);
                    totalShares += Number(video.share_count || 0);
                }
                videoCursor = videoData.cursor;
                pagesFetched++;
            } while (videoCursor && pagesFetched < MAX_PAGES);

            // Update profile info
            await this.prisma.tikTokAccount.update({
                where: { id: accountId },
                data: {
                    displayName: userInfo.display_name || undefined,
                    bio: userInfo.bio_description || undefined,
                    avatarUrl: userInfo.avatar_large_url || userInfo.avatar_url || undefined,
                    isVerified: userInfo.is_verified ?? undefined,
                    username: userInfo.username || undefined,
                    profileUrl: userInfo.profile_deep_link || undefined,
                },
            });

            // Get previous snapshot for delta calculation
            const previousSnapshot = await this.prisma.metricSnapshot.findFirst({
                where: { accountId },
                orderBy: { fetchedAt: 'desc' },
            });

            const followers = userInfo.follower_count ?? 0;
            const following = userInfo.following_count ?? 0;
            const likes = userInfo.likes_count ?? 0;
            const videos = userInfo.video_count ?? 0;

            const followersDelta = previousSnapshot ? followers - previousSnapshot.followers : 0;
            const likesDelta = previousSnapshot ? likes - previousSnapshot.likes : 0;
            const viewsDelta = previousSnapshot ? totalViews - previousSnapshot.views : 0;

            const engagementRate = followers > 0 ? (likes / followers) * 100 : 0;
            const growthRate = previousSnapshot && previousSnapshot.followers > 0
                ? ((followers - previousSnapshot.followers) / previousSnapshot.followers) * 100
                : 0;

            await this.prisma.metricSnapshot.create({
                data: {
                    accountId,
                    followers,
                    following,
                    likes,
                    videos,
                    comments: totalComments,
                    shares: totalShares,
                    views: totalViews,
                    followersDelta,
                    likesDelta,
                    viewsDelta,
                    engagementRate: Math.round(engagementRate * 100) / 100,
                    growthRate: Math.round(growthRate * 100) / 100,
                    source: 'api',
                },
            });

            this.logger.log(
                `✓ API sync @${userInfo.username}: ${followers} followers, ${totalViews} total views (from ${pagesFetched * 20} videos)`,
            );
            return true;
        } catch (error) {
            this.logger.error(`API sync failed for account ${accountId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get the top N most popular (most viewed) videos for an OAuth-connected account.
     */
    async getTopVideos(accountId: string, limit = 10) {
        const accessToken = await this.getValidAccessToken(accountId);
        if (!accessToken) {
            this.logger.warn(`No valid token for account ${accountId}, cannot fetch top videos`);
            return null;
        }

        try {
            const allVideos = await this.tiktokApi.listAllVideos(accessToken);

            // Sort by view_count descending and take the top N
            const topVideos = allVideos
                .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
                .slice(0, limit)
                .map((video) => ({
                    id: video.id,
                    title: video.title || video.video_description || 'Sem título',
                    description: video.video_description || null,
                    coverUrl: video.cover_image_url || null,
                    shareUrl: video.share_url || null,
                    createdAt: video.create_time
                        ? new Date(video.create_time * 1000).toISOString()
                        : null,
                    duration: video.duration || 0,
                    views: video.view_count || 0,
                    likes: video.like_count || 0,
                    comments: video.comment_count || 0,
                    shares: video.share_count || 0,
                    engagementRate:
                        video.view_count > 0
                            ? Math.round(
                                ((video.like_count + video.comment_count + video.share_count) /
                                    video.view_count) *
                                10000,
                            ) / 100
                            : 0,
                }));

            this.logger.log(`Returning top ${topVideos.length} videos for account ${accountId}`);
            return topVideos;
        } catch (error) {
            this.logger.error(`Failed to fetch top videos for account ${accountId}: ${error.message}`);
            return null;
        }
    }
    /**
     * Disconnect TikTok OAuth from an account (revoke + clear tokens).
     */
    async disconnectAccount(accountId: string): Promise<void> {
        const account = await this.prisma.tikTokAccount.findUnique({
            where: { id: accountId },
            select: { accessToken: true },
        });

        if (account?.accessToken) {
            try {
                await this.tiktokApi.revokeToken(account.accessToken);
            } catch (error) {
                this.logger.warn(`Failed to revoke token: ${error.message}`);
            }
        }

        await this.prisma.tikTokAccount.update({
            where: { id: accountId },
            data: {
                openId: null,
                accessToken: null,
                refreshToken: null,
                tokenExpiresAt: null,
                refreshExpiresAt: null,
                scopes: null,
            },
        });

        this.logger.log(`Disconnected OAuth for account ${accountId}`);
    }

    private generateState(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    private cleanupStates(): void {
        const now = Date.now();
        for (const [key, value] of this.stateStore.entries()) {
            if (value.expiresAt < now) {
                this.stateStore.delete(key);
            }
        }
    }
}
