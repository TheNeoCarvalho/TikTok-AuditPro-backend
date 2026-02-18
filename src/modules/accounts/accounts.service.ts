import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MetricsSyncService } from '../scraper/metrics-sync.service';
import { AddAccountDto, FetchMetricsDto } from './dto/accounts.dto';

@Injectable()
export class AccountsService {
    private readonly logger = new Logger(AccountsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly metricsSyncService: MetricsSyncService,
    ) { }

    async addAccount(userId: string, dto: AddAccountDto) {
        const username = dto.username.replace('@', '').toLowerCase().trim();

        const existing = await this.prisma.tikTokAccount.findUnique({
            where: { userId_username: { userId, username } },
        });

        if (existing) {
            throw new ConflictException('Account already added');
        }

        const account = await this.prisma.tikTokAccount.create({
            data: {
                username,
                profileUrl: `https://www.tiktok.com/@${username}`,
                userId,
            },
        });

        // Immediately fetch initial data (fire-and-forget)
        this.metricsSyncService.syncAccount(account.id).catch((err) => {
            this.logger.warn(`Initial sync failed for @${username}: ${err.message}`);
        });

        return account;
    }

    async getUserAccounts(userId: string) {
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

    async getAccountById(userId: string, accountId: string) {
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
            throw new NotFoundException('Account not found');
        }

        const { accessToken, refreshToken, tokenExpiresAt, refreshExpiresAt, ...safe } = account;
        return { ...safe, isOAuthConnected: !!accessToken };
    }

    async addMetricSnapshot(userId: string, accountId: string, dto: FetchMetricsDto) {
        const account = await this.prisma.tikTokAccount.findFirst({
            where: { id: accountId, userId },
        });

        if (!account) {
            throw new NotFoundException('Account not found');
        }

        // Get previous snapshot for delta calculation
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

        // Calculate deltas
        const followersDelta = previousSnapshot ? followers - previousSnapshot.followers : 0;
        const likesDelta = previousSnapshot ? likes - previousSnapshot.likes : 0;
        const viewsDelta = previousSnapshot ? views - previousSnapshot.views : 0;

        // Calculate rates
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

    async deleteAccount(userId: string, accountId: string) {
        const account = await this.prisma.tikTokAccount.findFirst({
            where: { id: accountId, userId },
        });

        if (!account) {
            throw new NotFoundException('Account not found');
        }

        await this.prisma.tikTokAccount.delete({
            where: { id: accountId },
        });

        return { message: 'Account deleted successfully' };
    }
}
