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
var MetricsSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsSyncService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma/prisma.service");
const tiktok_oauth_service_1 = require("../tiktok/tiktok-oauth.service");
const tiktok_scraper_service_1 = require("./tiktok-scraper.service");
let MetricsSyncService = MetricsSyncService_1 = class MetricsSyncService {
    prisma;
    scraper;
    tiktokOAuth;
    logger = new common_1.Logger(MetricsSyncService_1.name);
    constructor(prisma, scraper, tiktokOAuth) {
        this.prisma = prisma;
        this.scraper = scraper;
        this.tiktokOAuth = tiktokOAuth;
    }
    async syncAccount(accountId) {
        const account = await this.prisma.tikTokAccount.findUnique({
            where: { id: accountId },
        });
        if (!account) {
            throw new common_1.NotFoundException(`Account ${accountId} not found`);
        }
        return this.fetchAndSave(account.id, account.username);
    }
    async syncUserAccounts(userId) {
        const accounts = await this.prisma.tikTokAccount.findMany({
            where: { userId },
        });
        this.logger.log(`Syncing ${accounts.length} accounts for user ${userId}`);
        const results = [];
        for (const account of accounts) {
            if (results.length > 0) {
                await this.delay(2000 + Math.random() * 3000);
            }
            const result = await this.fetchAndSave(account.id, account.username);
            results.push(result);
        }
        return results;
    }
    async syncAllAccounts() {
        const accounts = await this.prisma.tikTokAccount.findMany({
            orderBy: { updatedAt: 'asc' },
        });
        this.logger.log(`Starting global sync for ${accounts.length} accounts`);
        let success = 0;
        let failed = 0;
        for (const account of accounts) {
            if (success + failed > 0) {
                await this.delay(3000 + Math.random() * 3000);
            }
            const result = await this.fetchAndSave(account.id, account.username);
            if (result.success) {
                success++;
            }
            else {
                failed++;
            }
        }
        this.logger.log(`Global sync complete: ${success} success, ${failed} failed out of ${accounts.length}`);
        return { total: accounts.length, success, failed };
    }
    async fetchAndSave(accountId, username) {
        try {
            const success = await this.tiktokOAuth.syncAccountViaApi(accountId);
            if (success) {
                this.logger.log(`✓ API sync successful for @${username}`);
                return { accountId, username, success: true };
            }
            this.logger.log(`Performing scraper fallback for @${username}...`);
            const data = await this.scraper.fetchProfileData(username);
            if (!data) {
                this.logger.warn(`Could not fetch data for @${username}`);
                return {
                    accountId,
                    username,
                    success: false,
                    error: 'Could not extract profile data from TikTok (API failed and Scraper fallback failed)',
                };
            }
            await this.prisma.tikTokAccount.update({
                where: { id: accountId },
                data: {
                    displayName: data.displayName,
                    bio: data.bio,
                    avatarUrl: data.avatarUrl,
                    isVerified: data.isVerified,
                },
            });
            const previousSnapshot = await this.prisma.metricSnapshot.findFirst({
                where: { accountId },
                orderBy: { fetchedAt: 'desc' },
            });
            const followersDelta = previousSnapshot
                ? data.followers - previousSnapshot.followers
                : 0;
            const likesDelta = previousSnapshot
                ? data.likes - previousSnapshot.likes
                : 0;
            const engagementRate = data.followers > 0
                ? (data.likes / data.followers) * 100
                : 0;
            const growthRate = previousSnapshot && previousSnapshot.followers > 0
                ? ((data.followers - previousSnapshot.followers) / previousSnapshot.followers) * 100
                : 0;
            await this.prisma.metricSnapshot.create({
                data: {
                    accountId,
                    followers: data.followers,
                    following: data.following,
                    likes: data.likes,
                    videos: data.videos,
                    comments: 0,
                    shares: 0,
                    views: 0,
                    followersDelta,
                    likesDelta,
                    viewsDelta: 0,
                    engagementRate: Math.round(engagementRate * 100) / 100,
                    growthRate: Math.round(growthRate * 100) / 100,
                    source: 'manual',
                },
            });
            this.logger.log(`✓ Scraper sync @${username}: ${data.followers} followers, ${data.likes} likes, ${data.videos} videos`);
            return { accountId, username, success: true, data };
        }
        catch (error) {
            this.logger.error(`✗ Sync failed for @${username}: ${error.message}`);
            return {
                accountId,
                username,
                success: false,
                error: error.message,
            };
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.MetricsSyncService = MetricsSyncService;
exports.MetricsSyncService = MetricsSyncService = MetricsSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tiktok_scraper_service_1.TikTokScraperService,
        tiktok_oauth_service_1.TikTokOAuthService])
], MetricsSyncService);
//# sourceMappingURL=metrics-sync.service.js.map