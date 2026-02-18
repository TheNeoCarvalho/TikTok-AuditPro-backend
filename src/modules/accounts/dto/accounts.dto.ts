import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddAccountDto {
    @IsString()
    username: string;
}

export class FetchMetricsDto {
    @IsOptional()
    @IsInt()
    @Min(0)
    followers?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    following?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    likes?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    videos?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    comments?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    shares?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    views?: number;
}
