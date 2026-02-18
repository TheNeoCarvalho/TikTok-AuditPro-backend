"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperModule = void 0;
const common_1 = require("@nestjs/common");
const tiktok_module_1 = require("../tiktok/tiktok.module");
const metrics_cron_service_1 = require("./metrics-cron.service");
const metrics_sync_service_1 = require("./metrics-sync.service");
const sync_controller_1 = require("./sync.controller");
const tiktok_scraper_service_1 = require("./tiktok-scraper.service");
let ScraperModule = class ScraperModule {
};
exports.ScraperModule = ScraperModule;
exports.ScraperModule = ScraperModule = __decorate([
    (0, common_1.Module)({
        imports: [tiktok_module_1.TikTokModule],
        controllers: [sync_controller_1.SyncController],
        providers: [tiktok_scraper_service_1.TikTokScraperService, metrics_sync_service_1.MetricsSyncService, metrics_cron_service_1.MetricsCronService],
        exports: [metrics_sync_service_1.MetricsSyncService, tiktok_scraper_service_1.TikTokScraperService],
    })
], ScraperModule);
//# sourceMappingURL=scraper.module.js.map