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
export declare class TikTokScraperService {
    private readonly logger;
    fetchProfileData(username: string): Promise<TikTokProfileData | null>;
    private parseProfileFromHtml;
    private extractUniversalData;
    private extractSigiState;
    private extractNextData;
    private extractFromMetaTags;
    private parseHumanNumber;
    private safeInt;
}
