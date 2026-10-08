import { ENGINE, bridgeHeaders, customerCookie, sameOrigin } from '@/lib/customer-bridge';
import { handleCustomerPost } from '@/lib/customer-api-handler';

export async function POST(request: Request) {
  return handleCustomerPost(request, { engine: ENGINE, bridgeHeaders, customerCookie, sameOrigin });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({}, { status: 403 });
  return Response.json({}, { headers: { 'set-cookie': `${customerCookie}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`, 'cache-control': 'no-store' } });
}
