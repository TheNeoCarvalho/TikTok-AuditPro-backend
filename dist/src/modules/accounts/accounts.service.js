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
var AccountsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma/prisma.service");
const metrics_sync_service_1 = require("../scraper/metrics-sync.service");
let AccountsService = AccountsService_1 = class AccountsService {
    prisma;
    metricsSyncService;
    logger = new common_1.Logger(AccountsService_1.name);
    constructor(prisma, metricsSyncService) {
        this.prisma = prisma;
        this.metricsSyncService = metricsSyncService;
    }
    async addAccount(userId, dto) {
        const username = dto.username.replace('@', '').toLowerCase().trim();
        const existing = await this.prisma.tikTokAccount.findUnique({
            where: { userId_username: { userId, username } },
        });
        if (existing) {
            throw new common_1.ConflictException('Account already added');
        }
        const account = await this.prisma.tikTokAccount.create({
            data: {
                username,
                profileUrl: `https://www.tiktok.com/@${username}`,
                userId,
            },
        });
        this.metricsSyncService.syncAccount(account.id).catch((err) => {
            this.logger.warn(`Initial sync failed for @${username}: ${err.message}`);
        });
        return account;
    }
    async getUserAccounts(userId) {
        const accounts = await this.prisma.tikTokAccount.findMany({
            where: { userId },
            include: {
                snapshots: {
                    orderBy: { fetchedAt: 'desc' },
                    take: 1,
                },
                _count: {
                    select: { reports: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return accounts.map((account) => {
            const { accessToken, refreshToken, tokenExpiresAt, refreshExpiresAt, ...safe } = account;
            return { ...safe, isOAuthConnected: !!accessToken };
        });
    }
    async getAccountById(userId, accountId) {
        const account = await this.prisma.tikTokAccount.findFirst({
            where: { id: accountId, userId },
            include: {
                snapshots: {
                    orderBy: { fetchedAt: 'desc' },
                    take: 30,
                },
                reports: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });
        if (!account) {
            throw new common_1.NotFoundException('Account not found');
        }
        const { accessToken, refreshToken, tokenExpiresAt, refreshExpiresAt, ...safe } = account;
        return { ...safe, isOAuthConnected: !!accessToken };
    }
    async addMetricSnapshot(userId, accountId, dto) {
        const account = await this.prisma.tikTokAccount.findFirst({
            where: { id: accountId, userId },
        });
        if (!account) {
            throw new common_1.NotFoundException('Account not found');
        }
        const previousSnapshot = await this.prisma.metricSnapshot.findFirst({
            where: { accountId },
            orderBy: { fetchedAt: 'desc' },
        });
        const followers = dto.followers ?? 0;
        const following = dto.following ?? 0;
        const likes = dto.likes ?? 0;
        const videos = dto.videos ?? 0;
        const comments = dto.comments ?? 0;
        const shares = dto.shares ?? 0;
        const views = dto.views ?? 0;
        const followersDelta = previousSnapshot ? followers - previousSnapshot.followers : 0;
        const likesDelta = previousSnapshot ? likes - previousSnapshot.likes : 0;
        const viewsDelta = previousSnapshot ? views - previousSnapshot.views : 0;
        const engagementRate = followers > 0
            ? ((likes + comments) / followers) * 100
            : 0;
        const growthRate = previousSnapshot && previousSnapshot.followers > 0
            ? ((followers - previousSnapshot.followers) / previousSnapshot.followers) * 100
            : 0;
        return this.prisma.metricSnapshot.create({
            data: {
                accountId,
                followers,
                following,
                likes,
                videos,
                comments,
                shares,
                views,
                followersDelta,
                likesDelta,
                viewsDelta,
                engagementRate: Math.round(engagementRate * 100) / 100,
                growthRate: Math.round(growthRate * 100) / 100,
                source: 'manual',
            },
        });
    }
    async deleteAccount(userId, accountId) {
        const account = await this.prisma.tikTokAccount.findFirst({
            where: { id: accountId, userId },
        });
        if (!account) {
            throw new common_1.NotFoundException('Account not found');
        }
        await this.prisma.tikTokAccount.delete({
            where: { id: accountId },
        });
        return { message: 'Account deleted successfully' };
    }
};
exports.AccountsService = AccountsService;
exports.AccountsService = AccountsService = AccountsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        metrics_sync_service_1.MetricsSyncService])
], AccountsService);
//# sourceMappingURL=accounts.service.js.map