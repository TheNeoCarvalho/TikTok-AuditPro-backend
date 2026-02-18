import { Injectable, Logger } from '@nestjs/common';

export interface TikTokProfileData {
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
    followers: number;
    following: number;
    likes: number;
    videos: number;
    views: number;
}


@Injectable()
export class TikTokScraperService {
    private readonly logger = new Logger(TikTokScraperService.name);

    /**
     * Fetches public profile data from a TikTok user page.
     * Uses the __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON embedded in the HTML,
     * which contains all public stats without needing the official API.
     */
    async fetchProfileData(username: string): Promise<TikTokProfileData | null> {
        const cleanUsername = username.replace('@', '').toLowerCase().trim();
        const url = `https://www.tiktok.com/@${cleanUsername}`;

        try {
            this.logger.log(`Fetching profile data for @${cleanUsername}...`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                },
            });

            if (!response.ok) {
                this.logger.warn(`Failed to fetch @${cleanUsername}: HTTP ${response.status}`);
                return null;
            }

            const html = await response.text();
            return this.parseProfileFromHtml(html, cleanUsername);
        } catch (error) {
            this.logger.error(`Error fetching @${cleanUsername}: ${error.message}`);
            return null;
        }
    }

    private parseProfileFromHtml(html: string, username: string): TikTokProfileData | null {
        // Strategy 1: __UNIVERSAL_DATA_FOR_REHYDRATION__
        const universalData = this.extractUniversalData(html);
        if (universalData) {
            return universalData;
        }

        // Strategy 2: SIGI_STATE (older TikTok pages)
        const sigiData = this.extractSigiState(html);
        if (sigiData) {
            return sigiData;
        }

        // Strategy 3: __NEXT_DATA__ (some TikTok versions)
        const nextData = this.extractNextData(html);
        if (nextData) {
            return nextData;
        }

        // Strategy 4: Regex fallback for meta tags / JSON-LD
        return this.extractFromMetaTags(html, username);
    }

    private extractUniversalData(html: string): TikTokProfileData | null {
        try {
            const match = html.match(
                /<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
            );
            if (!match) return null;

            const json = JSON.parse(match[1]);
            const defaultScope = json?.__DEFAULT_SCOPE__;
            const userDetail = defaultScope?.['webapp.user-detail'];
            const userInfo = userDetail?.userInfo;

            if (!userInfo) return null;

            const user = userInfo.user || {};
            const stats = userInfo.stats || {};

            return {
                username: user.uniqueId || '',
                displayName: user.nickname || null,
                bio: user.signature || null,
                avatarUrl: user.avatarLarger || user.avatarMedium || user.avatarThumb || null,
                isVerified: user.verified || false,
                followers: this.safeInt(stats.followerCount),
                following: this.safeInt(stats.followingCount),
                likes: this.safeInt(stats.heartCount || stats.heart),
                videos: this.safeInt(stats.videoCount),
                views: this.safeInt(stats.viewCount || stats.playCount || 0),
            };

        } catch (error) {
            return null;
        }
    }

    private extractSigiState(html: string): TikTokProfileData | null {
        try {
            const match = html.match(
                /<script[^>]*id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/,
            );
            if (!match) return null;

            const json = JSON.parse(match[1]);
            const userModule = json?.UserModule;
            if (!userModule) return null;

            const users = userModule.users || {};
            const stats = userModule.stats || {};

            const userKey = Object.keys(users)[0];
            if (!userKey) return null;

            const user = users[userKey];
            const userStats = stats[userKey];

            return {
                username: user.uniqueId || userKey,
                displayName: user.nickname || null,
                bio: user.signature || null,
                avatarUrl: user.avatarLarger || user.avatarMedium || null,
                isVerified: user.verified || false,
                followers: this.safeInt(userStats?.followerCount),
                following: this.safeInt(userStats?.followingCount),
                likes: this.safeInt(userStats?.heartCount || userStats?.heart),
                videos: this.safeInt(userStats?.videoCount),
                views: this.safeInt(userStats?.viewCount || userStats?.playCount || 0),
            };
        } catch (error) {
            return null;
        }
    }

    private extractNextData(html: string): TikTokProfileData | null {
        try {
            const match = html.match(
                /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
            );
            if (!match) return null;

            const json = JSON.parse(match[1]);
            const userInfo = json?.props?.pageProps?.userInfo;
            if (!userInfo) return null;

            const user = userInfo.user || {};
            const stats = userInfo.stats || {};

            return {
                username: user.uniqueId || '',
                displayName: user.nickname || null,
                bio: user.signature || null,
                avatarUrl: user.avatarLarger || user.avatarMedium || null,
                isVerified: user.verified || false,
                followers: this.safeInt(stats.followerCount),
                following: this.safeInt(stats.followingCount),
                likes: this.safeInt(stats.heartCount || stats.heart),
                videos: this.safeInt(stats.videoCount),
                views: this.safeInt(stats.viewCount || stats.playCount || 0),
            };
        } catch (error) {
            return null;
        }
    }

    private extractFromMetaTags(html: string, username: string): TikTokProfileData | null {
        try {
            // Try to extract follower count from meta description or structured data
            const followersMatch = html.match(
                /(\d[\d,.]*[KkMmBb]?)\s*(?:Followers|Seguidores)/i,
            );
            const likesMatch = html.match(
                /(\d[\d,.]*[KkMmBb]?)\s*(?:Likes|Curtidas)/i,
            );
            const followingMatch = html.match(
                /(\d[\d,.]*[KkMmBb]?)\s*(?:Following|Seguindo)/i,
            );

            if (!followersMatch && !likesMatch) return null;

            return {
                username,
                displayName: null,
                bio: null,
                avatarUrl: null,
                isVerified: false,
                followers: this.parseHumanNumber(followersMatch?.[1] || '0'),
                following: this.parseHumanNumber(followingMatch?.[1] || '0'),
                likes: this.parseHumanNumber(likesMatch?.[1] || '0'),
                videos: 0,
                views: 0,
            };
        } catch (error) {
            return null;
        }
    }

    private parseHumanNumber(value: string): number {
        if (!value) return 0;
        const cleaned = value.replace(/,/g, '');
        const multipliers: Record<string, number> = {
            k: 1_000,
            K: 1_000,
            m: 1_000_000,
            M: 1_000_000,
            b: 1_000_000_000,
            B: 1_000_000_000,
        };
        const match = cleaned.match(/^([\d.]+)([KkMmBb]?)$/);
        if (!match) return 0;
        const num = parseFloat(match[1]);
        const multiplier = multipliers[match[2]] || 1;
        return Math.round(num * multiplier);
    }

    private safeInt(value: unknown): number {
        if (typeof value === 'number') return Math.round(value);
        if (typeof value === 'string') return parseInt(value, 10) || 0;
        return 0;
    }
}
