import { Module } from '@nestjs/common';
import { TikTokApiService } from './tiktok-api.service';
import { TikTokOAuthService } from './tiktok-oauth.service';
import { TikTokController } from './tiktok.controller';

@Module({
    controllers: [TikTokController],
    providers: [TikTokApiService, TikTokOAuthService],
    exports: [TikTokApiService, TikTokOAuthService],
})
export class TikTokModule { }
