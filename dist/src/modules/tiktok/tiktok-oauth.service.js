"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TikTokOAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokOAuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma/prisma.service");
const tiktok_api_service_1 = require("./tiktok-api.service");
let TikTokOAuthService = TikTokOAuthService_1 = class TikTokOAuthService {
    prisma;
    tiktokApi;
    logger = new common_1.Logger(TikTokOAuthService_1.name);
    stateStore = new Map();
    constructor(prisma, tiktokApi) {
        this.prisma = prisma;
        this.tiktokApi = tiktokApi;
    }
    generateAuthUrl(userId, accountId) {
        const state = this.generateState();
        const codeVerifier = this.tiktokApi.generateCodeVerifier();
        const codeChallenge = this.tiktokApi.generateCodeChallenge(codeVerifier);
        this.stateStore.set(state, {
            userId,
            accountId,
            codeVerifier,
            expiresAt: Date.now() + 5 * 60 * 1000,
        });
        this.cleanupStates();
        const url = this.tiktokApi.getAuthorizationUrl(state, codeChallenge);
        return { url, state };
    }
    async handleCallback(code, state) {
        const stateData = this.stateStore.get(state);
        if (!stateData || stateData.expiresAt < Date.now()) {
            this.stateStore.delete(state);
            throw new Error('Invalid or expired OAuth state. Please try again.');
        }
        this.stateStore.delete(state);
        const { userId, accountId, codeVerifier } = stateData;
        const tokenData = await this.tiktokApi.exchangeCodeForToken(code, codeVerifier);
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
            account = await this.prisma.tikTokAccount.update({
                where: { id: accountId },
                data: {
                    ...tokenFields,
                    username: tiktokUsername || undefined,
                },
            });
            this.logger.log(`Linked OAuth to existing account: @${account.username}`);
        }
        else {
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
            }
            else {
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
        await this.syncAccountViaApi(account.id);
        return {
            account,
            isNew: !accountId && !tiktokUsername,
        };
    }
    async getValidAccessToken(accountId) {
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
            return null;
        }
        const now = new Date();
        const bufferMs = 5 * 60 * 1000;
        if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > now.getTime() + bufferMs) {
            return account.accessToken;
        }
        if (account.refreshExpiresAt && account.refreshExpiresAt.getTime() < now.getTime()) {
            this.logger.warn(`Refresh token expired for account ${accountId}`);
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
        }
        catch (error) {
            this.logger.error(`Failed to refresh token for account ${accountId}: ${error.message}`);
            return null;
        }
    }
    async syncAccountViaApi(accountId) {
        const accessToken = await this.getValidAccessToken(accountId);
        if (!accessToken) {
            this.logger.debug(`No valid token for account ${accountId}, skipping API sync`);
            return false;
        }
        try {
            const userInfo = await this.tiktokApi.getUserInfo(accessToken);
            let totalViews = 0;
            let totalComments = 0;
            let totalShares = 0;
            let videoCursor;
            let pagesFetched = 0;
            const MAX_PAGES = 5;
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
            this.logger.log(`✓ API sync @${userInfo.username}: ${followers} followers, ${totalViews} total views (from ${pagesFetched * 20} videos)`);
            return true;
        }
        catch (error) {
            this.logger.error(`API sync failed for account ${accountId}: ${error.message}`);
            return false;
        }
    }
    async getTopVideos(accountId, limit = 10) {
        const accessToken = await this.getValidAccessToken(accountId);
        if (!accessToken) {
            this.logger.warn(`No valid token for account ${accountId}, cannot fetch top videos`);
            return null;
        }
        try {
            const allVideos = await this.tiktokApi.listAllVideos(accessToken);
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
                engagementRate: video.view_count > 0
                    ? Math.round(((video.like_count + video.comment_count + video.share_count) /
                        video.view_count) *
                        10000) / 100
                    : 0,
            }));
            this.logger.log(`Returning top ${topVideos.length} videos for account ${accountId}`);
            return topVideos;
        }
        catch (error) {
            this.logger.error(`Failed to fetch top videos for account ${accountId}: ${error.message}`);
            return null;
        }
    }
    async disconnectAccount(accountId) {
        const account = await this.prisma.tikTokAccount.findUnique({
            where: { id: accountId },
            select: { accessToken: true },
        });
        if (account?.accessToken) {
            try {
                await this.tiktokApi.revokeToken(account.accessToken);
            }
            catch (error) {
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
    generateState() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    cleanupStates() {
        const now = Date.now();
        for (const [key, value] of this.stateStore.entries()) {
            if (value.expiresAt < now) {
                this.stateStore.delete(key);
            }
        }
    }
};
exports.TikTokOAuthService = TikTokOAuthService;
exports.TikTokOAuthService = TikTokOAuthService = TikTokOAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tiktok_api_service_1.TikTokApiService])
], TikTokOAuthService);
//# sourceMappingURL=tiktok-oauth.service.js.map