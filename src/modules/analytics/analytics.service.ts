import { Injectable } from '@nestjs/common';
import { MetricSnapshot } from '@prisma/client';

/**
 * Health Score Engine
 *
 * Score Breakdown (0-100):
 * - Growth Score     → 30% (follower growth rate, trend direction)
 * - Engagement Score → 30% (engagement rate relative to benchmarks)
 * - Consistency Score→ 20% (posting frequency, regularity)
 * - Risk Score       → 20% (anomaly detection, potential shadowban signals)
 *
 * All sub-scores are 0-100, then weighted to compose the final score.
 */

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

@Injectable()
export class AnalyticsService {
    /**
     * Calculate full health score from metric snapshots.
     * Requires at least 1 snapshot, ideally 7+ for meaningful trends.
     */
    calculateHealthScore(snapshots: MetricSnapshot[]): HealthScoreResult {
        if (!snapshots.length) {
            return this.emptyScore();
        }

        // Sort newest first
        const sorted = [...snapshots].sort(
            (a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime(),
        );

        const latest = sorted[0];
        const insights: Insight[] = [];
        const warnings: Warning[] = [];
        const recommendations: Recommendation[] = [];

        // ─── Growth Score (30%) ───────────────────────────────────
        const growthScore = this.calculateGrowthScore(sorted, insights, warnings, recommendations);

        // ─── Engagement Score (30%) ───────────────────────────────
        const engagementScore = this.calculateEngagementScore(latest, insights, warnings, recommendations);

        // ─── Consistency Score (20%) ──────────────────────────────
        const consistencyScore = this.calculateConsistencyScore(sorted, insights, warnings, recommendations);

        // ─── Risk Score (20%) ────────────────────────────────────
        const riskScore = this.calculateRiskScore(sorted, insights, warnings, recommendations);

        // ─── Weighted Final Score ─────────────────────────────────
        const healthScore = Math.round(
            growthScore * 0.3 +
            engagementScore * 0.3 +
            consistencyScore * 0.2 +
            riskScore * 0.2,
        );

        return {
            healthScore: this.clamp(healthScore),
            growthScore: this.clamp(growthScore),
            engagementScore: this.clamp(engagementScore),
            consistencyScore: this.clamp(consistencyScore),
            riskScore: this.clamp(riskScore),
            insights,
            warnings,
            recommendations,
        };
    }

    // ─── Growth Score Logic ─────────────────────────────────────

    private calculateGrowthScore(
        snapshots: MetricSnapshot[],
        insights: Insight[],
        warnings: Warning[],
        recommendations: Recommendation[],
    ): number {
        if (snapshots.length < 2) {
            insights.push({
                category: 'growth',
                message: 'Insufficient data for growth analysis',
                trend: 'stable',
            });
            return 50; // Neutral when no history
        }

        const latest = snapshots[0];
        const oldest = snapshots[snapshots.length - 1];
        const daysDiff = Math.max(
            1,
            (new Date(latest.fetchedAt).getTime() - new Date(oldest.fetchedAt).getTime()) / (1000 * 60 * 60 * 24),
        );

        const totalGrowth = latest.followers - oldest.followers;
        const dailyGrowthRate = totalGrowth / daysDiff;
        const percentGrowth = oldest.followers > 0
            ? (totalGrowth / oldest.followers) * 100
            : 0;

        // Scoring logic
        let score = 50;

        if (percentGrowth > 10) score = 95;
        else if (percentGrowth > 5) score = 85;
        else if (percentGrowth > 2) score = 75;
        else if (percentGrowth > 0.5) score = 65;
        else if (percentGrowth > 0) score = 55;
        else if (percentGrowth > -2) score = 40;
        else if (percentGrowth > -5) score = 25;
        else score = 10;

        // Trend direction
        const recentSnapshots = snapshots.slice(0, Math.min(7, snapshots.length));
        const trend = this.detectTrend(recentSnapshots.map((s) => s.followers));

        insights.push({
            category: 'growth',
            message: `${dailyGrowthRate >= 0 ? '+' : ''}${dailyGrowthRate.toFixed(1)} followers/day (${percentGrowth.toFixed(1)}% over ${Math.round(daysDiff)} days)`,
            value: `${totalGrowth >= 0 ? '+' : ''}${totalGrowth}`,
            trend,
        });

        if (percentGrowth < -5) {
            warnings.push({
                severity: 'high',
                message: 'Significant follower decline detected',
                detail: `Lost ${Math.abs(totalGrowth)} followers (${percentGrowth.toFixed(1)}%)`,
            });
            recommendations.push({
                priority: 'high',
                action: 'Review recent content strategy and posting schedule',
                reason: 'Follower count is declining significantly',
            });
        }

        return score;
    }

    // ─── Engagement Score Logic ─────────────────────────────────

    private calculateEngagementScore(
        latest: MetricSnapshot,
        insights: Insight[],
        warnings: Warning[],
        recommendations: Recommendation[],
    ): number {
        // engagement_rate = (likes + comments) / followers * 100
        const engagementRate = latest.engagementRate;

        let score: number;

        // TikTok engagement benchmarks:
        // Excellent: > 8%
        // Good: 4-8%
        // Average: 2-4%
        // Below average: 1-2%
        // Poor: < 1%
        if (engagementRate > 8) score = 95;
        else if (engagementRate > 6) score = 85;
        else if (engagementRate > 4) score = 75;
        else if (engagementRate > 2) score = 60;
        else if (engagementRate > 1) score = 45;
        else if (engagementRate > 0.5) score = 30;
        else score = 15;

        // Views/followers ratio check
        const viewRatio = latest.followers > 0
            ? (latest.views / latest.followers) * 100
            : 0;

        insights.push({
            category: 'engagement',
            message: `Engagement rate: ${engagementRate.toFixed(2)}%`,
            value: `${engagementRate.toFixed(2)}%`,
            trend: engagementRate > 4 ? 'up' : engagementRate > 2 ? 'stable' : 'down',
        });

        if (engagementRate < 1) {
            warnings.push({
                severity: 'medium',
                message: 'Engagement rate is below TikTok average',
                detail: `Current rate: ${engagementRate.toFixed(2)}% (benchmark: 2-4%)`,
            });
            recommendations.push({
                priority: 'high',
                action: 'Increase engagement by using trending sounds, hashtags, and call-to-actions',
                reason: 'Low engagement rate reduces content distribution',
            });
        }

        if (engagementRate > 8) {
            insights.push({
                category: 'engagement',
                message: 'Excellent engagement rate — content resonates well with audience',
                trend: 'up',
            });
        }

        return score;
    }

    // ─── Consistency Score Logic ────────────────────────────────

    private calculateConsistencyScore(
        snapshots: MetricSnapshot[],
        insights: Insight[],
        warnings: Warning[],
        recommendations: Recommendation[],
    ): number {
        if (snapshots.length < 2) {
            return 50;
        }

        const latest = snapshots[0];
        const oldest = snapshots[snapshots.length - 1];
        const daysDiff = Math.max(
            1,
            (new Date(latest.fetchedAt).getTime() - new Date(oldest.fetchedAt).getTime()) / (1000 * 60 * 60 * 24),
        );

        // Videos per week
        const totalVideos = latest.videos - oldest.videos;
        const videosPerWeek = (totalVideos / daysDiff) * 7;

        let score: number;

        // TikTok posting frequency benchmarks:
        // Excellent: 7+ videos/week (daily)
        // Good: 4-6 videos/week
        // Average: 2-3 videos/week
        // Low: 1 video/week
        // Poor: < 1 video/week
        if (videosPerWeek >= 7) score = 95;
        else if (videosPerWeek >= 5) score = 85;
        else if (videosPerWeek >= 3) score = 70;
        else if (videosPerWeek >= 1) score = 50;
        else score = 25;

        insights.push({
            category: 'consistency',
            message: `Posting frequency: ~${videosPerWeek.toFixed(1)} videos/week`,
            value: `${videosPerWeek.toFixed(1)}/week`,
            trend: videosPerWeek >= 3 ? 'up' : 'down',
        });

        if (videosPerWeek < 3) {
            recommendations.push({
                priority: 'medium',
                action: 'Increase posting frequency to at least 3-5 videos per week',
                reason: 'Consistent posting improves algorithmic distribution',
            });
        }

        return score;
    }

    // ─── Risk Score Logic ──────────────────────────────────────

    private calculateRiskScore(
        snapshots: MetricSnapshot[],
        insights: Insight[],
        warnings: Warning[],
        recommendations: Recommendation[],
    ): number {
        // Risk score is inverted: higher = LESS risky = better
        let riskPoints = 0;

        if (snapshots.length < 3) {
            return 60; // Neutral risk with limited data
        }

        const latest = snapshots[0];

        // Check 1: Sudden follower drop (potential shadowban signal)
        const recentDeltas = snapshots.slice(0, Math.min(7, snapshots.length))
            .map((s) => s.followersDelta);

        const consecutiveDrops = recentDeltas.filter((d) => d < 0).length;
        if (consecutiveDrops >= 3) {
            riskPoints += 30;
            warnings.push({
                severity: 'high',
                message: 'Possible shadowban: consecutive follower drops detected',
                detail: `${consecutiveDrops} consecutive drops in recent snapshots`,
            });
        }

        // Check 2: Views crashed relative to followers
        if (latest.followers > 100 && latest.views < latest.followers * 0.1) {
            riskPoints += 25;
            warnings.push({
                severity: 'medium',
                message: 'View count abnormally low relative to follower count',
                detail: 'This may indicate reduced content distribution',
            });
        }

        // Check 3: Engagement rate anomaly (suspiciously high = bought engagement)
        if (latest.engagementRate > 50) {
            riskPoints += 20;
            warnings.push({
                severity: 'medium',
                message: 'Unusually high engagement rate — possible inauthentic activity',
            });
        }

        // Check 4: Growth spikes (could indicate bought followers)
        const maxDelta = Math.max(...recentDeltas.map(Math.abs));
        const avgDelta = recentDeltas.reduce((sum, d) => sum + Math.abs(d), 0) / recentDeltas.length;
        if (avgDelta > 0 && maxDelta > avgDelta * 5) {
            riskPoints += 15;
            warnings.push({
                severity: 'low',
                message: 'Unusual follower spike detected — review for organic growth',
            });
        }

        // Convert risk points to score (inverted: less risk = higher score)
        const riskScore = Math.max(0, 100 - riskPoints);

        if (riskScore >= 80) {
            insights.push({
                category: 'risk',
                message: 'Account appears healthy with no major risk signals',
                trend: 'stable',
            });
        }

        if (riskPoints >= 40) {
            recommendations.push({
                priority: 'high',
                action: 'Investigate potential account restrictions or policy violations',
                reason: 'Multiple risk signals detected',
            });
        }

        return riskScore;
    }

    // ─── Helpers ────────────────────────────────────────────────

    private detectTrend(values: number[]): 'up' | 'down' | 'stable' {
        if (values.length < 2) return 'stable';

        const first = values[values.length - 1];
        const last = values[0];
        const change = first > 0 ? ((last - first) / first) * 100 : 0;

        if (change > 1) return 'up';
        if (change < -1) return 'down';
        return 'stable';
    }

    private clamp(value: number, min = 0, max = 100): number {
        return Math.max(min, Math.min(max, Math.round(value)));
    }

    private emptyScore(): HealthScoreResult {
        return {
            healthScore: 0,
            growthScore: 0,
            engagementScore: 0,
            consistencyScore: 0,
            riskScore: 0,
            insights: [{ category: 'general', message: 'No data available for analysis', trend: 'stable' }],
            warnings: [],
            recommendations: [
                {
                    priority: 'high',
                    action: 'Add metric snapshots to enable health analysis',
                    reason: 'The score engine requires at least 1 data point',
                },
            ],
        };
    }
}
