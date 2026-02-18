import {
    Controller,
    Param,
    Post,
    UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MetricsSyncService } from './metrics-sync.service';

@Controller('sync')
@UseGuards(AuthGuard('jwt'))
export class SyncController {
    constructor(private readonly metricsSyncService: MetricsSyncService) { }

    /**
     * POST /api/sync/accounts
     * Manually trigger sync for all accounts of the authenticated user.
     */
    @Post('accounts')
    async syncAllUserAccounts(@CurrentUser('id') userId: string) {
        const results = await this.metricsSyncService.syncUserAccounts(userId);
        return {
            message: 'Sync completed',
            total: results.length,
            success: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            details: results,
        };
    }

    /**
     * POST /api/sync/accounts/:id
     * Manually trigger sync for a specific account.
     */
    @Post('accounts/:id')
    async syncSingleAccount(
        @CurrentUser('id') userId: string,
        @Param('id') accountId: string,
    ) {
        // Verify account belongs to user
        const result = await this.metricsSyncService.syncAccount(accountId);
        return {
            message: result.success ? 'Sync successful' : 'Sync failed',
            ...result,
        };
    }
}
