"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma/prisma.service");
const analytics_service_1 = require("../analytics/analytics.service");
let ReportsService = class ReportsService {
    prisma;
    analyticsService;
    constructor(prisma, analyticsService) {
        this.prisma = prisma;
        this.analyticsService = analyticsService;
    }
    async generateReport(userId, accountId) {
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
            throw new common_1.NotFoundException('Account not found');
        }
        const scoreResult = this.analyticsService.calculateHealthScore(account.snapshots);
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
                insights: scoreResult.insights,
                warnings: scoreResult.warnings,
                recommendations: scoreResult.recommendations,
                generatedAt: new Date(),
            },
        });
        return report;
    }
    async getReport(userId, reportId) {
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
            throw new common_1.NotFoundException('Report not found');
        }
        return report;
    }
    async getAccountReports(userId, accountId) {
        return this.prisma.auditReport.findMany({
            where: { accountId, userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }
    async getUserReports(userId) {
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
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        analytics_service_1.AnalyticsService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map