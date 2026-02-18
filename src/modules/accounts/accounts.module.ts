import { Module } from '@nestjs/common';
import { ScraperModule } from '../scraper/scraper.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
    imports: [ScraperModule],
    controllers: [AccountsController],
    providers: [AccountsService],
    exports: [AccountsService],
})
export class AccountsModule { }

