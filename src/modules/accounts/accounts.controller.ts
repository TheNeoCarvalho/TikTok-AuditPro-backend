import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { AddAccountDto, FetchMetricsDto } from './dto/accounts.dto';

@Controller('accounts')
@UseGuards(AuthGuard('jwt'))
export class AccountsController {
    constructor(private readonly accountsService: AccountsService) { }

    @Post()
    async addAccount(
        @CurrentUser('id') userId: string,
        @Body() dto: AddAccountDto,
    ) {
        return this.accountsService.addAccount(userId, dto);
    }

    @Get()
    async getUserAccounts(@CurrentUser('id') userId: string) {
        return this.accountsService.getUserAccounts(userId);
    }

    @Get(':id')
    async getAccountById(
        @CurrentUser('id') userId: string,
        @Param('id') accountId: string,
    ) {
        return this.accountsService.getAccountById(userId, accountId);
    }

    @Post(':id/metrics')
    async addMetrics(
        @CurrentUser('id') userId: string,
        @Param('id') accountId: string,
        @Body() dto: FetchMetricsDto,
    ) {
        return this.accountsService.addMetricSnapshot(userId, accountId, dto);
    }

    @Delete(':id')
    async deleteAccount(
        @CurrentUser('id') userId: string,
        @Param('id') accountId: string,
    ) {
        return this.accountsService.deleteAccount(userId, accountId);
    }
}
