import { MetricSnapshot } from '@prisma/client';
export interface HealthScoreResult {
    healthScore: number;
    growthScore: number;
    engagementScore: number;
    consistencyScore: number;
    riskScore: number;
    insights: Insight[];
    warnings: Warning[];
    recommendations: Recommendation[];
}
export interface Insight {
    category: string;
    message: string;
    value?: string;
    trend?: 'up' | 'down' | 'stable';
}
export interface Warning {
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    detail?: string;
}
export interface Recommendation {
    priority: 'low' | 'medium' | 'high';
    action: string;
    reason: string;
}
export declare class AnalyticsService {
    calculateHealthScore(snapshots: MetricSnapshot[]): HealthScoreResult;
    private calculateGrowthScore;
    private calculateEngagementScore;
    private calculateConsistencyScore;
    private calculateRiskScore;
    private detectTrend;
    private clamp;
    private emptyScore;
}
