import { PrismaService } from '../../shared/prisma/prisma.service';
import { TikTokApiService } from './tiktok-api.service';
export declare class TikTokOAuthService {
    private readonly prisma;
    private readonly tiktokApi;
    private readonly logger;
    private readonly stateStore;
    constructor(prisma: PrismaService, tiktokApi: TikTokApiService);
    generateAuthUrl(userId: string, accountId?: string): {
        url: string;
        state: string;
    };
    handleCallback(code: string, state: string): Promise<{
        account: any;
        isNew: boolean;
    }>;
    getValidAccessToken(accountId: string): Promise<string | null>;
    syncAccountViaApi(accountId: string): Promise<boolean>;
    getTopVideos(accountId: string, limit?: number): Promise<{
        id: string;
        title: string;
        description: string | null;
        coverUrl: string | null;
        shareUrl: string | null;
        createdAt: string | null;
        duration: number;
        views: number;
        likes: number;
        comments: number;
        shares: number;
        engagementRate: number;
    }[] | null>;
    disconnectAccount(accountId: string): Promise<void>;
    private generateState;
    private cleanupStates;
}
