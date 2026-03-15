import { Controller, Post, Headers, Req, Res, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { DistributionService } from '../distribution/distribution.service';
import { Config } from '../config';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly distributionService: DistributionService) {}

  @Post('github')
  handleGitHubWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
  ) {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const webhookSecret = Config.github.webhookSecret;

    if (webhookSecret) {
      if (!signature) {
        this.logger.warn('GitHub webhook received without signature');
        res.status(401).json({ error: 'Missing signature' });
        return;
      }

      if (!rawBody) {
        this.logger.warn('Raw body not available for signature validation');
        res.status(400).json({ error: 'Raw body not available' });
        return;
      }

      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(rawBody);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;

      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        this.logger.warn('GitHub webhook signature mismatch');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    this.logger.log(`GitHub webhook received: event=${event}`);

    if (event === 'release') {
      const payload = req.body as { action?: string; release?: { tag_name?: string } };
      const action = payload?.action;

      if (action === 'published' || action === 'released') {
        const tagName = payload?.release?.tag_name ?? 'unknown';
        this.logger.log(
          `New GitHub release "${action}": ${tagName} — triggering distribution refresh`,
        );

        this.distributionService.allInOne().catch((error: any) => {
          this.logger.error(`Error in webhook-triggered allInOne: ${error.message}`, error.stack);
        });
      }
    }

    res.status(200).json({ ok: true });
  }
}
