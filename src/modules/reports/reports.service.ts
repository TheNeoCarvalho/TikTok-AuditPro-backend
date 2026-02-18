import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class ReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly analyticsService: AnalyticsService,
    ) { }

    async generateReport(userId: string, accountId: string) {
        const account = await this.prisma.tikTokAccount.findFirst({
            where: { id: accountId, userId },
            include: {
                snapshots: {
                    orderBy: { fetchedAt: 'desc' },
                    take: 30,
                },
            },
        });

        if (!account) {
            throw new NotFoundException('Account not found');
        }

        // Calculate health score
        const scoreResult = this.analyticsService.calculateHealthScore(account.snapshots);

        // Create report
        const report = await this.prisma.auditReport.create({
            data: {
                accountId,
                userId,
                status: 'COMPLETED',
                healthScore: scoreResult.healthScore,
                growthScore: scoreResult.growthScore,
                engagementScore: scoreResult.engagementScore,
                consistencyScore: scoreResult.consistencyScore,
                riskScore: scoreResult.riskScore,
                insights: scoreResult.insights as any,
                warnings: scoreResult.warnings as any,
                recommendations: scoreResult.recommendations as any,
                generatedAt: new Date(),
            },
        });

        return report;
    }

    async getReport(userId: string, reportId: string) {
        const report = await this.prisma.auditReport.findFirst({
            where: { id: reportId, userId },
            include: {
                account: {
                    select: {
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                        profileUrl: true,
                    },
                },
            },
        });

        if (!report) {
            throw new NotFoundException('Report not found');
        }

        return report;
    }

    async getAccountReports(userId: string, accountId: string) {
        return this.prisma.auditReport.findMany({
            where: { accountId, userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }

    async getUserReports(userId: string) {
        return this.prisma.auditReport.findMany({
            where: { userId },
            include: {
                account: {
                    select: {
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
}
