import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 3001;
  const corsOrigin = config.get<string>("CORS_ORIGIN") ?? "http://localhost:3000";

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port);
  Logger.log(`HealthSecure API listening on http://localhost:${port}/api/v1`, "Bootstrap");
}

void bootstrap();
