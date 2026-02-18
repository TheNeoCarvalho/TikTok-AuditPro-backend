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
var TikTokController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const tiktok_oauth_service_1 = require("./tiktok-oauth.service");
let TikTokController = TikTokController_1 = class TikTokController {
    tiktokOAuth;
    configService;
    logger = new common_1.Logger(TikTokController_1.name);
    frontendUrl;
    constructor(tiktokOAuth, configService) {
        this.tiktokOAuth = tiktokOAuth;
        this.configService = configService;
        this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    }
    async startAuth(userId, accountId, res) {
        const { url } = this.tiktokOAuth.generateAuthUrl(userId, accountId);
        this.logger.log(`Redirecting user ${userId} to TikTok OAuth`);
        res.redirect(url);
    }
    async getAuthUrl(userId, accountId) {
        const { url, state } = this.tiktokOAuth.generateAuthUrl(userId, accountId);
        return { url, state };
    }
    async handleCallback(code, state, error, errorDescription, res) {
        if (error) {
            this.logger.error(`OAuth error: ${error} - ${errorDescription}`);
            const errorUrl = `${this.frontendUrl}/dashboard?oauth_error=${encodeURIComponent(errorDescription || error)}`;
            return res.redirect(errorUrl);
        }
        if (!code || !state) {
            const errorUrl = `${this.frontendUrl}/dashboard?oauth_error=${encodeURIComponent('Missing authorization code')}`;
            return res.redirect(errorUrl);
        }
        try {
            const result = await this.tiktokOAuth.handleCallback(code, state);
            const successUrl = `${this.frontendUrl}/dashboard?connected=true`;
            this.logger.log(`OAuth successful for @${result.account.username}`);
            return res.redirect(successUrl);
        }
        catch (err) {
            this.logger.error(`OAuth callback failed: ${err.message}`);
            const errorUrl = `${this.frontendUrl}/dashboard?oauth_error=${encodeURIComponent(err.message)}`;
            return res.redirect(errorUrl);
        }
    }
    async syncAccount(userId, accountId) {
        const success = await this.tiktokOAuth.syncAccountViaApi(accountId);
        if (!success) {
            throw new common_1.BadRequestException('Could not sync via API. Account may not be connected to TikTok OAuth.');
        }
        return { message: 'Sync successful via TikTok API' };
    }
    async disconnectAccount(userId, accountId) {
        await this.tiktokOAuth.disconnectAccount(accountId);
        return { message: 'TikTok account disconnected successfully' };
    }
    async getTopVideos(userId, accountId, limit) {
        const videoLimit = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);
        const videos = await this.tiktokOAuth.getTopVideos(accountId, videoLimit);
        if (videos === null) {
            throw new common_1.BadRequestException('Could not fetch videos. Account may not be connected to TikTok OAuth.');
        }
        return { videos, total: videos.length };
    }
};
exports.TikTokController = TikTokController;
__decorate([
    (0, common_1.Get)('auth'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Query)('accountId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TikTokController.prototype, "startAuth", null);
__decorate([
    (0, common_1.Get)('auth/url'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Query)('accountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TikTokController.prototype, "getAuthUrl", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Query)('error_description')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], TikTokController.prototype, "handleCallback", null);
__decorate([
    (0, common_1.Post)('accounts/:id/sync'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TikTokController.prototype, "syncAccount", null);
__decorate([
    (0, common_1.Delete)('accounts/:id/disconnect'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TikTokController.prototype, "disconnectAccount", null);
__decorate([
    (0, common_1.Get)('accounts/:id/top-videos'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], TikTokController.prototype, "getTopVideos", null);
exports.TikTokController = TikTokController = TikTokController_1 = __decorate([
    (0, common_1.Controller)('tiktok'),
    __metadata("design:paramtypes", [tiktok_oauth_service_1.TikTokOAuthService,
        config_1.ConfigService])
], TikTokController);
//# sourceMappingURL=tiktok.controller.js.map