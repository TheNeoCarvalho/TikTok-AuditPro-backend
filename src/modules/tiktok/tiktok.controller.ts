import {
    BadRequestException,
    Controller,
    Delete,
    Get,
    Logger,
    Param,
    Post,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TikTokOAuthService } from './tiktok-oauth.service';

@Controller('tiktok')
export class TikTokController {
    private readonly logger = new Logger(TikTokController.name);
    private readonly frontendUrl: string;

    constructor(
        private readonly tiktokOAuth: TikTokOAuthService,
        private readonly configService: ConfigService,
    ) {
        this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    }

    /**
     * GET /api/tiktok/auth
     * Generates the TikTok OAuth URL and redirects the user.
     * Query params: ?accountId=xxx (optional, to link to existing account)
     */
    @Get('auth')
    @UseGuards(AuthGuard('jwt'))
    async startAuth(
        @CurrentUser('id') userId: string,
        @Query('accountId') accountId: string | undefined,
        @Res() res: Response,
    ) {
        const { url } = this.tiktokOAuth.generateAuthUrl(userId, accountId);
        this.logger.log(`Redirecting user ${userId} to TikTok OAuth`);
        res.redirect(url);
    }

    /**
     * GET /api/tiktok/auth/url
     * Returns the TikTok OAuth URL as JSON (for SPA frontends).
     */
    @Get('auth/url')
    @UseGuards(AuthGuard('jwt'))
    async getAuthUrl(
        @CurrentUser('id') userId: string,
        @Query('accountId') accountId: string | undefined,
    ) {
        const { url, state } = this.tiktokOAuth.generateAuthUrl(userId, accountId);
        return { url, state };
    }

    /**
     * GET /api/tiktok/callback
     * TikTok redirects here after the user authorizes.
     * Exchanges the code for tokens and redirects to the frontend.
     */
    @Get('callback')
    async handleCallback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') error: string,
        @Query('error_description') errorDescription: string,
        @Res() res: Response,
    ) {
        if (error) {
            this.logger.error(`OAuth error: ${error} - ${errorDescription}`);
            const errorUrl = `${this.frontendUrl}/dashboard?oauth_error=${encodeURIComponent(errorDescription || error)}`;
            return res.redirect(errorUrl);
        }

        if (!code || !state) {
            const errorUrl = `${this.frontendUrl}/dashboard?oauth_error=${encodeURIComponent('Missing authorization code')}`;
            return res.redirect(errorUrl);
        }

        try {
            const result = await this.tiktokOAuth.handleCallback(code, state);
            const successUrl = `${this.frontendUrl}/dashboard?connected=true`;
            this.logger.log(`OAuth successful for @${result.account.username}`);
            return res.redirect(successUrl);
        } catch (err) {
            this.logger.error(`OAuth callback failed: ${err.message}`);
            const errorUrl = `${this.frontendUrl}/dashboard?oauth_error=${encodeURIComponent(err.message)}`;
            return res.redirect(errorUrl);
        }
    }

    /**
     * POST /api/tiktok/accounts/:id/sync
     * Manually trigger an API-based sync for an OAuth-connected account.
     */
    @Post('accounts/:id/sync')
    @UseGuards(AuthGuard('jwt'))
    async syncAccount(
        @CurrentUser('id') userId: string,
        @Param('id') accountId: string,
    ) {
        const success = await this.tiktokOAuth.syncAccountViaApi(accountId);
        if (!success) {
            throw new BadRequestException(
                'Could not sync via API. Account may not be connected to TikTok OAuth.',
            );
        }
        return { message: 'Sync successful via TikTok API' };
    }

    /**
     * DELETE /api/tiktok/accounts/:id/disconnect
     * Disconnect TikTok OAuth from an account.
     */
    @Delete('accounts/:id/disconnect')
    @UseGuards(AuthGuard('jwt'))
    async disconnectAccount(
        @CurrentUser('id') userId: string,
        @Param('id') accountId: string,
    ) {
        await this.tiktokOAuth.disconnectAccount(accountId);
        return { message: 'TikTok account disconnected successfully' };
    }

    /**
     * GET /api/tiktok/accounts/:id/top-videos
     * Returns the top N most popular videos for an OAuth-connected account.
     */
    @Get('accounts/:id/top-videos')
    @UseGuards(AuthGuard('jwt'))
    async getTopVideos(
        @CurrentUser('id') userId: string,
        @Param('id') accountId: string,
        @Query('limit') limit?: string,
    ) {
        const videoLimit = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);
        const videos = await this.tiktokOAuth.getTopVideos(accountId, videoLimit);

        if (videos === null) {
            throw new BadRequestException(
                'Could not fetch videos. Account may not be connected to TikTok OAuth.',
            );
        }

        return { videos, total: videos.length };
    }
}
