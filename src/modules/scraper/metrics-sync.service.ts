import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TikTokOAuthService } from '../tiktok/tiktok-oauth.service';
import { TikTokProfileData, TikTokScraperService } from './tiktok-scraper.service';

export interface SyncResult {
    accountId: string;
    username: string;
    success: boolean;
    data?: TikTokProfileData;
    error?: string;
}

@Injectable()
export class MetricsSyncService {
    private readonly logger = new Logger(MetricsSyncService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly scraper: TikTokScraperService,
        private readonly tiktokOAuth: TikTokOAuthService,
    ) { }


    /**
     * Sync metrics for a single TikTok account.
     * Fetches live data, updates the account profile, and creates a new metric snapshot.
     */
    async syncAccount(accountId: string): Promise<SyncResult> {
        const account = await this.prisma.tikTokAccount.findUnique({
            where: { id: accountId },
        });

        if (!account) {
            throw new NotFoundException(`Account ${accountId} not found`);
        }

        return this.fetchAndSave(account.id, account.username);
    }

    /**
     * Sync metrics for all accounts of a specific user.
     */
    async syncUserAccounts(userId: string): Promise<SyncResult[]> {
        const accounts = await this.prisma.tikTokAccount.findMany({
            where: { userId },
        });

        this.logger.log(`Syncing ${accounts.length} accounts for user ${userId}`);

        const results: SyncResult[] = [];
        for (const account of accounts) {
            // Delay between requests to avoid rate limiting
            if (results.length > 0) {
                await this.delay(2000 + Math.random() * 3000);
            }
            const result = await this.fetchAndSave(account.id, account.username);
            results.push(result);
        }

        return results;
    }

    /**
     * Sync ALL accounts in the system (used by cron job).
     */
    async syncAllAccounts(): Promise<{ total: number; success: number; failed: number }> {
        const accounts = await this.prisma.tikTokAccount.findMany({
            orderBy: { updatedAt: 'asc' }, // Oldest updated first
        });

        this.logger.log(`Starting global sync for ${accounts.length} accounts`);

        let success = 0;
        let failed = 0;

        for (const account of accounts) {
            // Stagger requests: 3-6 seconds between each
            if (success + failed > 0) {
                await this.delay(3000 + Math.random() * 3000);
            }

            const result = await this.fetchAndSave(account.id, account.username);
            if (result.success) {
                success++;
            } else {
                failed++;
            }
        }

        this.logger.log(`Global sync complete: ${success} success, ${failed} failed out of ${accounts.length}`);

        return { total: accounts.length, success, failed };
    }

    private async fetchAndSave(accountId: string, username: string): Promise<SyncResult> {
        try {
            // Check if account has official API access (OAuth)
            const success = await this.tiktokOAuth.syncAccountViaApi(accountId);

            if (success) {
                // If API sync was successful, we don't need the scraper
                this.logger.log(`✓ API sync successful for @${username}`);
                return { accountId, username, success: true };
            }

            // Fallback to scraper for public data
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

            // Update account profile info (from scraper data)
            await this.prisma.tikTokAccount.update({
                where: { id: accountId },
                data: {
                    displayName: data.displayName,
                    bio: data.bio,
                    avatarUrl: data.avatarUrl,
                    isVerified: data.isVerified,
                },
            });

            // Get previous snapshot for delta calculation
            const previousSnapshot = await this.prisma.metricSnapshot.findFirst({
                where: { accountId },
                orderBy: { fetchedAt: 'desc' },
            });

            // Calculate deltas
            const followersDelta = previousSnapshot
                ? data.followers - previousSnapshot.followers
                : 0;
            const likesDelta = previousSnapshot
                ? data.likes - previousSnapshot.likes
                : 0;

            // Calculate engagement rate
            const engagementRate = data.followers > 0
                ? (data.likes / data.followers) * 100
                : 0;

            // Calculate growth rate
            const growthRate = previousSnapshot && previousSnapshot.followers > 0
                ? ((data.followers - previousSnapshot.followers) / previousSnapshot.followers) * 100
                : 0;

            // Create new metric snapshot
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
                    source: 'manual', // Scraper is considered 'manual' or at least third-party
                },
            });

            this.logger.log(
                `✓ Scraper sync @${username}: ${data.followers} followers, ${data.likes} likes, ${data.videos} videos`,
            );

            return { accountId, username, success: true, data };
        } catch (error) {
            this.logger.error(`✗ Sync failed for @${username}: ${error.message}`);
            return {
                accountId,
                username,
                success: false,
                error: error.message,
            };
        }
    }


    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
