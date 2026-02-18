import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard('jwt'))
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Post('generate/:accountId')
    async generateReport(
        @CurrentUser('id') userId: string,
        @Param('accountId') accountId: string,
    ) {
        return this.reportsService.generateReport(userId, accountId);
    }

    @Get()
    async getUserReports(@CurrentUser('id') userId: string) {
        return this.reportsService.getUserReports(userId);
    }

    @Get(':id')
    async getReport(
        @CurrentUser('id') userId: string,
        @Param('id') reportId: string,
    ) {
        return this.reportsService.getReport(userId, reportId);
    }

    @Get('account/:accountId')
    async getAccountReports(
        @CurrentUser('id') userId: string,
        @Param('accountId') accountId: string,
    ) {
        return this.reportsService.getAccountReports(userId, accountId);
    }
}
