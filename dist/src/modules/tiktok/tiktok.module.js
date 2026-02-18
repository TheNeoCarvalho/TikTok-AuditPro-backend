"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokModule = void 0;
const common_1 = require("@nestjs/common");
const tiktok_api_service_1 = require("./tiktok-api.service");
const tiktok_oauth_service_1 = require("./tiktok-oauth.service");
const tiktok_controller_1 = require("./tiktok.controller");
let TikTokModule = class TikTokModule {
};
exports.TikTokModule = TikTokModule;
exports.TikTokModule = TikTokModule = __decorate([
    (0, common_1.Module)({
        controllers: [tiktok_controller_1.TikTokController],
        providers: [tiktok_api_service_1.TikTokApiService, tiktok_oauth_service_1.TikTokOAuthService],
        exports: [tiktok_api_service_1.TikTokApiService, tiktok_oauth_service_1.TikTokOAuthService],
    })
], TikTokModule);
//# sourceMappingURL=tiktok.module.js.map