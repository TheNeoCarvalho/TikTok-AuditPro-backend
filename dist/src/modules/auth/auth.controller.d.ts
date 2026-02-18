import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
        };
    }>;
    getProfile(userId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string | null;
        email: string;
        plan: import(".prisma/client").$Enums.Plan;
    } | null>;
}
