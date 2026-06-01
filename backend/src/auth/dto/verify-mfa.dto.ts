import { IsString, IsUUID, Length, Matches } from "class-validator";

export class VerifyMfaDto {
  @IsUUID()
  challengeId!: string;

  @IsString()
  @Length(4, 10)
  @Matches(/^\d+$/, { message: "code must be all digits" })
  code!: string;
}
