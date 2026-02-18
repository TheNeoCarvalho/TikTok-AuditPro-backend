import { MetricsSyncService } from './metrics-sync.service';
export declare class SyncController {
    private readonly metricsSyncService;
    constructor(metricsSyncService: MetricsSyncService);
    syncAllUserAccounts(userId: string): Promise<{
        message: string;
        total: number;
        success: number;
        failed: number;
        details: import("./metrics-sync.service").SyncResult[];
    }>;
    syncSingleAccount(userId: string, accountId: string): Promise<{
        accountId: string;
        username: string;
        success: boolean;
        data?: import("./tiktok-scraper.service").TikTokProfileData;
        error?: string;
        message: string;
    }>;
}
