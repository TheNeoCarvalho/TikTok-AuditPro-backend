import { MetricsSyncService } from './metrics-sync.service';
export declare class MetricsCronService {
    private readonly metricsSyncService;
    private readonly logger;
    private isSyncing;
    constructor(metricsSyncService: MetricsSyncService);
    handleScheduledSync(): Promise<void>;
}
