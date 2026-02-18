import { PrismaService } from '../../shared/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
export declare class ReportsService {
    private readonly prisma;
    private readonly analyticsService;
    constructor(prisma: PrismaService, analyticsService: AnalyticsService);
    generateReport(userId: string, accountId: string): Promise<{
        id: string;
        userId: string;
        accountId: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ReportStatus;
        healthScore: number | null;
        growthScore: number | null;
        engagementScore: number | null;
        consistencyScore: number | null;
        riskScore: number | null;
        insights: import("@prisma/client/runtime/client").JsonValue | null;
        warnings: import("@prisma/client/runtime/client").JsonValue | null;
        recommendations: import("@prisma/client/runtime/client").JsonValue | null;
        generatedAt: Date | null;
    }>;
    getReport(userId: string, reportId: string): Promise<{
        account: {
            username: string;
            displayName: string | null;
            avatarUrl: string | null;
            profileUrl: string | null;
        };
    } & {
        id: string;
        userId: string;
        accountId: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ReportStatus;
        healthScore: number | null;
        growthScore: number | null;
        engagementScore: number | null;
        consistencyScore: number | null;
        riskScore: number | null;
        insights: import("@prisma/client/runtime/client").JsonValue | null;
        warnings: import("@prisma/client/runtime/client").JsonValue | null;
        recommendations: import("@prisma/client/runtime/client").JsonValue | null;
        generatedAt: Date | null;
    }>;
    getAccountReports(userId: string, accountId: string): Promise<{
        id: string;
        userId: string;
        accountId: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ReportStatus;
        healthScore: number | null;
        growthScore: number | null;
        engagementScore: number | null;
        consistencyScore: number | null;
        riskScore: number | null;
        insights: import("@prisma/client/runtime/client").JsonValue | null;
        warnings: import("@prisma/client/runtime/client").JsonValue | null;
        recommendations: import("@prisma/client/runtime/client").JsonValue | null;
        generatedAt: Date | null;
    }[]>;
    getUserReports(userId: string): Promise<({
        account: {
            username: string;
            displayName: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        userId: string;
        accountId: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ReportStatus;
        healthScore: number | null;
        growthScore: number | null;
        engagementScore: number | null;
        consistencyScore: number | null;
        riskScore: number | null;
        insights: import("@prisma/client/runtime/client").JsonValue | null;
        warnings: import("@prisma/client/runtime/client").JsonValue | null;
        recommendations: import("@prisma/client/runtime/client").JsonValue | null;
        generatedAt: Date | null;
    })[]>;
}
