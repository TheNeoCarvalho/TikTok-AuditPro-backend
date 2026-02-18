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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const metrics_sync_service_1 = require("./metrics-sync.service");
let SyncController = class SyncController {
    metricsSyncService;
    constructor(metricsSyncService) {
        this.metricsSyncService = metricsSyncService;
    }
    async syncAllUserAccounts(userId) {
        const results = await this.metricsSyncService.syncUserAccounts(userId);
        return {
            message: 'Sync completed',
            total: results.length,
            success: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            details: results,
        };
    }
    async syncSingleAccount(userId, accountId) {
        const result = await this.metricsSyncService.syncAccount(accountId);
        return {
            message: result.success ? 'Sync successful' : 'Sync failed',
            ...result,
        };
    }
};
exports.SyncController = SyncController;
__decorate([
    (0, common_1.Post)('accounts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncAllUserAccounts", null);
__decorate([
    (0, common_1.Post)('accounts/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncSingleAccount", null);
exports.SyncController = SyncController = __decorate([
    (0, common_1.Controller)('sync'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [metrics_sync_service_1.MetricsSyncService])
], SyncController);
//# sourceMappingURL=sync.controller.js.map