import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { TikTokOAuthService } from './tiktok-oauth.service';
export declare class TikTokController {
    private readonly tiktokOAuth;
    private readonly configService;
    private readonly logger;
    private readonly frontendUrl;
    constructor(tiktokOAuth: TikTokOAuthService, configService: ConfigService);
    startAuth(userId: string, accountId: string | undefined, res: Response): Promise<void>;
    getAuthUrl(userId: string, accountId: string | undefined): Promise<{
        url: string;
        state: string;
    }>;
    handleCallback(code: string, state: string, error: string, errorDescription: string, res: Response): Promise<void>;
    syncAccount(userId: string, accountId: string): Promise<{
        message: string;
    }>;
    disconnectAccount(userId: string, accountId: string): Promise<{
        message: string;
    }>;
    getTopVideos(userId: string, accountId: string, limit?: string): Promise<{
        videos: {
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
        }[];
        total: number;
    }>;
}
