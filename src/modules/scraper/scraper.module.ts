import { Module } from '@nestjs/common';
import { TikTokModule } from '../tiktok/tiktok.module';
import { MetricsCronService } from './metrics-cron.service';
import { MetricsSyncService } from './metrics-sync.service';
import { SyncController } from './sync.controller';
import { TikTokScraperService } from './tiktok-scraper.service';

@Module({
    imports: [TikTokModule],
    controllers: [SyncController],
    providers: [TikTokScraperService, MetricsSyncService, MetricsCronService],
    exports: [MetricsSyncService, TikTokScraperService],
})
export class ScraperModule { }

