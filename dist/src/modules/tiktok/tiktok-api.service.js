"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TikTokApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokApiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
let TikTokApiService = TikTokApiService_1 = class TikTokApiService {
    configService;
    logger = new common_1.Logger(TikTokApiService_1.name);
    clientKey;
    clientSecret;
    redirectUri;
    TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
    TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
    TIKTOK_USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
    TIKTOK_VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';
    VIDEO_FIELDS = [
        'id',
        'title',
        'video_description',
        'cover_image_url',
        'share_url',
        'create_time',
        'duration',
        'like_count',
        'comment_count',
        'share_count',
        'view_count',
    ];
    SCOPES = [
        'user.info.basic',
        'user.info.profile',
        'user.info.stats',
        'video.list',
    ];
    constructor(configService) {
        this.configService = configService;
        this.clientKey = this.configService.getOrThrow('TIKTOK_CLIENT_KEY').trim();
        this.clientSecret = this.configService.getOrThrow('TIKTOK_CLIENT_SECRET').trim();
        this.redirectUri = this.configService.getOrThrow('TIKTOK_REDIRECT_URI').trim();
    }
    generateCodeVerifier() {
        return crypto.randomBytes(32).toString('base64url');
    }
    generateCodeChallenge(codeVerifier) {
        return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    }
    getAuthorizationUrl(state, codeChallenge) {
        const params = new URLSearchParams({
            client_key: this.clientKey,
            response_type: 'code',
            scope: this.SCOPES.join(','),
            redirect_uri: this.redirectUri,
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });
        const url = `${this.TIKTOK_AUTH_URL}?${params.toString()}`;
        this.logger.debug(`OAuth URL generated with client_key="${this.clientKey}" redirect_uri="${this.redirectUri}"`);
        this.logger.debug(`Full OAuth URL: ${url}`);
        return url;
    }
    async exchangeCodeForToken(code, codeVerifier) {
        this.logger.log('Exchanging authorization code for access token...');
        const body = new URLSearchParams({
            client_key: this.clientKey,
            client_secret: this.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: this.redirectUri,
            code_verifier: codeVerifier,
        });
        const response = await fetch(this.TIKTOK_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache',
            },
            body: body.toString(),
        });
        const data = await response.json();
        if (data.error) {
            this.logger.error(`Token exchange failed: ${data.error} - ${data.error_description}`);
            throw new Error(`TikTok OAuth error: ${data.error_description || data.error}`);
        }
        this.logger.log(`Token obtained for open_id: ${data.open_id}`);
        return data;
    }
    async refreshAccessToken(refreshToken) {
        this.logger.log('Refreshing access token...');
        const body = new URLSearchParams({
            client_key: this.clientKey,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });
        const response = await fetch(this.TIKTOK_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache',
            },
            body: body.toString(),
        });
        const data = await response.json();
        if (data.error) {
            this.logger.error(`Token refresh failed: ${data.error} - ${data.error_description}`);
            throw new Error(`TikTok refresh error: ${data.error_description || data.error}`);
        }
        this.logger.log('Access token refreshed successfully');
        return data;
    }
    async getUserInfo(accessToken) {
        const fields = [
            'open_id',
            'union_id',
            'avatar_url',
            'avatar_large_url',
            'display_name',
            'bio_description',
            'profile_deep_link',
            'is_verified',
            'username',
            'follower_count',
            'following_count',
            'likes_count',
            'video_count',
        ];
        const url = `${this.TIKTOK_USERINFO_URL}?fields=${fields.join(',')}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        const result = await response.json();
        if (result.error?.code !== 'ok' && result.error?.code) {
            this.logger.error(`User info request failed: ${JSON.stringify(result.error)}`);
            throw new Error(`TikTok API error: ${result.error.message || result.error.code}`);
        }
        this.logger.log(`User info fetched for: ${result.data?.user?.display_name || 'unknown'}`);
        return result.data?.user;
    }
    async listVideos(accessToken, cursor) {
        const body = {
            max_count: 20,
        };
        if (cursor !== undefined) {
            body.cursor = cursor;
        }
        const url = `${this.TIKTOK_VIDEO_LIST_URL}?fields=${this.VIDEO_FIELDS.join(',')}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        const result = await response.json();
        if (result.error?.code !== 'ok' && result.error?.code) {
            this.logger.error(`Video list request failed: ${JSON.stringify(result.error)}`);
            return { videos: [], has_more: false, cursor: 0 };
        }
        return {
            videos: (result.data?.videos || []),
            has_more: result.data?.has_more || false,
            cursor: result.data?.cursor || 0,
        };
    }
    async listAllVideos(accessToken, maxPages = 5) {
        const allVideos = [];
        let videoCursor;
        let pagesFetched = 0;
        do {
            const page = await this.listVideos(accessToken, videoCursor);
            allVideos.push(...page.videos);
            videoCursor = page.has_more ? page.cursor : undefined;
            pagesFetched++;
        } while (videoCursor && pagesFetched < maxPages);
        this.logger.log(`Fetched ${allVideos.length} videos across ${pagesFetched} page(s)`);
        return allVideos;
    }
    async revokeToken(accessToken) {
        const body = new URLSearchParams({
            client_key: this.clientKey,
            client_secret: this.clientSecret,
            token: accessToken,
        });
        await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });
        this.logger.log('Token revoked successfully');
    }
};
exports.TikTokApiService = TikTokApiService;
exports.TikTokApiService = TikTokApiService = TikTokApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TikTokApiService);
//# sourceMappingURL=tiktok-api.service.js.map