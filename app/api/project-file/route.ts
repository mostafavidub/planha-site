import { env } from 'cloudflare:workers';
import { ENGINE, bridgeHeaders, sameOrigin } from '@/lib/customer-bridge';
import { handleProjectFileRequest } from '@/lib/project-file-handler';

export async function POST(request: Request) {
  return handleProjectFileRequest(request, {
    engine: ENGINE,
    files: env.FILES as R2Bucket,
    bridgeHeaders,
    sameOrigin,
  });
}
