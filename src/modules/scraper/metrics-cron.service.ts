import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsSyncService } from './metrics-sync.service';

@Injectable()
export class MetricsCronService {
    private readonly logger = new Logger(MetricsCronService.name);
    private isSyncing = false;

    constructor(private readonly metricsSyncService: MetricsSyncService) { }

    /**
     * Runs every 6 hours to fetch updated metrics for all accounts.
     * Schedule: 00:00, 06:00, 12:00, 18:00
     */
    @Cron(CronExpression.EVERY_6_HOURS)
    async handleScheduledSync() {
        if (this.isSyncing) {
            this.logger.warn('Sync already in progress, skipping scheduled run');
            return;
        }

        this.isSyncing = true;
        this.logger.log('━━━ Scheduled metrics sync started ━━━');

        try {
            const result = await this.metricsSyncService.syncAllAccounts();
            this.logger.log(
                `━━━ Scheduled sync complete: ${result.success}/${result.total} accounts synced ━━━`,
            );
        } catch (error) {
            this.logger.error(`Scheduled sync failed: ${error.message}`);
        } finally {
            this.isSyncing = false;
        }
    }
}
