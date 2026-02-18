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
export declare class MetricsSyncService {
    private readonly prisma;
    private readonly scraper;
    private readonly tiktokOAuth;
    private readonly logger;
    constructor(prisma: PrismaService, scraper: TikTokScraperService, tiktokOAuth: TikTokOAuthService);
    syncAccount(accountId: string): Promise<SyncResult>;
    syncUserAccounts(userId: string): Promise<SyncResult[]>;
    syncAllAccounts(): Promise<{
        total: number;
        success: number;
        failed: number;
    }>;
    private fetchAndSave;
    private delay;
}
