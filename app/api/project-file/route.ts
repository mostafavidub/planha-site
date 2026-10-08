import { env } from 'cloudflare:workers';
import { ENGINE, bridgeHeaders, sameOrigin } from '@/lib/customer-bridge';

type EngineQuestion = {
  key: string;
  question: string;
  input_type?: 'text' | 'number' | 'radio';
  options?: string[];
};

type EngineQuestionnaire = {
  identity: string;
  source: string;
  questions: EngineQuestion[];
  conditional_questions?: EngineQuestion[];
  inferred_answers: Record<string, string>;
  auto_summary?: string[];
  panel_analysis?: {
    status: 'ready' | 'confirm' | 'review';
    area: number | null;
    floors: number | null;
    floorAreas: { label: string; area: number }[];
    unit: string;
    confidence: number;
    method: 'explicit-text' | 'closed-boundary' | 'none';
    warnings: string[];
    evidence: string[];
    checks: { label: string; passed: boolean }[];
  };
};

class QuestionnaireTerminalError extends Error {}

async function analyzeStoredFile(
  bytes: ArrayBuffer,
  name: string,
  contentType: string,
  discipline: 'mechanical' | 'electrical',
  occupancy: string,
  request: Request,
  analysisJobId = '',
) {
  const auth = bridgeHeaders(request);
  const headers = {
    'x-panel-token': auth['x-panel-token'],
    'x-customer-session': auth['x-customer-session'],
    accept: 'application/json',
  };
  let engineResponse: Response;
  if (analysisJobId) {
    engineResponse = await fetch(
      `${ENGINE}/internal/panel/questionnaire/${analysisJobId}`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
  } else {
    const engineForm = new FormData();
    engineForm.append('file', new Blob([bytes], { type: contentType }), name);
    engineResponse = await fetch(
      `${ENGINE}/internal/panel/questionnaire/start?discipline=${discipline}&occupancy=${encodeURIComponent(occupancy)}`,
      {
        method: 'POST',
        body: engineForm,
        headers,
        signal: AbortSignal.timeout(30_000),
      },
    );
  }
  if (!engineResponse.ok) {
    let detail = '';
    try {
      const failure = await engineResponse.json() as { detail?: string; error?: string };
      detail = failure.detail || failure.error || '';
    } catch {
      // Keep the customer-facing response independent from non-JSON upstream bodies.
    }
    if (engineResponse.status >= 400 && engineResponse.status < 500)
      throw new QuestionnaireTerminalError(detail || 'درخواست تحلیل معماری معتبر نبود.');
    throw new Error(`questionnaire_engine_${engineResponse.status}`);
  }
  const payload = await engineResponse.json() as EngineQuestionnaire & {
    status?: 'processing' | 'ready' | 'failed';
    job_id?: string;
    result?: EngineQuestionnaire;
    error?: string;
  };
  const jobId = payload.job_id || analysisJobId;
  if (payload.status === 'processing') return { pending: true as const, jobId };
  if (payload.status === 'failed')
    throw new QuestionnaireTerminalError(payload.error || 'تحلیل معماری ناموفق بود.');
  const engine = payload.result || payload;
  if (!Array.isArray(engine.questions) || !engine.identity)
    throw new Error('questionnaire_engine_invalid_response');
  const analysis = engine.panel_analysis || {
    status: 'review' as const,
    area: null,
    floors: null,
    floorAreas: [],
    unit: 'نامشخص',
    confidence: 0,
    method: 'none' as const,
    warnings: ['مساحت قابل اتکا استخراج نشد؛ متراژ دقیق را وارد کنید.'],
    evidence: [],
    checks: [{ label: 'تحلیل موتور مرکزی انجام شد', passed: true }],
  };
  return {
    pending: false as const,
    jobId,
    analysis: Object.assign(analysis, {
      inferredAnswers: engine.inferred_answers || {},
      questions: engine.questions,
      conditionalQuestions: engine.conditional_questions || [],
      questionnaireIdentity: engine.identity,
      questionnaireSource: engine.source,
      autoSummary: engine.auto_summary || [],
    }),
  };
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    const field = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value : '';
    };
    const retryKey = field('key');
    const analysisJobId = field('analysisJobId');
    const userId = field('userId').replace(/[^A-Za-z0-9_-]/g, '');
    const discipline = form.get('discipline') === 'electrical' ? 'electrical' : 'mechanical';
    const occupancy = field('occupancy').trim();
    if (!analysisJobId) {
      const sessionResponse = await fetch(`${ENGINE}/internal/panel/customer/state`, {
        method: 'POST', headers: bridgeHeaders(request), body: '{}', signal: AbortSignal.timeout(15_000),
      });
      if (!sessionResponse.ok) return Response.json({ error: 'دوباره وارد پنل شوید.' }, { status: 401 });
      const session = await sessionResponse.json() as { userId: string };
      if (!userId || session.userId !== userId)
        return Response.json({ error: 'مالک فایل معتبر نیست.' }, { status: 403 });
    }
    let key = retryKey;
    let name = '';
    let contentType = 'application/octet-stream';
    let bytes: ArrayBuffer;
    if (file instanceof File && file.size > 0) {
      if (file.size > 50_000_000)
        return Response.json({ error: 'حجم فایل بیشتر از ۵۰ مگابایت است.' }, { status: 413 });
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['zip', 'dxf'].includes(extension))
        return Response.json({ error: 'فقط فایل ZIP یا DXF قابل قبول است.' }, { status: 415 });
      key = `projects/${userId}/${crypto.randomUUID()}.${extension}`;
      name = file.name;
      contentType = file.type || (extension === 'zip' ? 'application/zip' : 'application/dxf');
      bytes = await file.arrayBuffer();
      await (env.FILES as R2Bucket).put(key, bytes, {
        httpMetadata: { contentType }, customMetadata: { originalName: encodeURIComponent(name) },
      });
    } else {
      if (!key.startsWith(`projects/${userId}/`))
        return Response.json({ error: 'فایل ذخیره‌شده معتبر نیست.' }, { status: 403 });
      const stored = await (env.FILES as R2Bucket).get(key);
      if (!stored)
        return Response.json({ error: 'فایل ذخیره‌شده پیدا نشد؛ دوباره بارگذاری کنید.' }, { status: 404 });
      bytes = await stored.arrayBuffer();
      name = decodeURIComponent(stored.customMetadata?.originalName || key.split('/').pop() || 'project.dxf');
      contentType = stored.httpMetadata?.contentType || contentType;
    }
    try {
      const outcome = await analyzeStoredFile(
        bytes, name, contentType, discipline, occupancy, request, analysisJobId,
      );
      if (outcome.pending)
        return Response.json({
          key, name, size: bytes.byteLength, analysisPending: true,
          analysisJobId: outcome.jobId,
          analysisError: 'تحلیل معماری در حال انجام است.',
        }, { status: 202 });
      return Response.json({
        key, name, size: bytes.byteLength,
        analysisJobId: outcome.jobId,
        analysis: outcome.analysis,
      });
    } catch (error) {
      console.error('questionnaire analysis failed or deferred', error);
      if (error instanceof QuestionnaireTerminalError)
        return Response.json({ key, name, size: bytes.byteLength, error: error.message }, { status: 422 });
      return Response.json({
        key, name, size: bytes.byteLength, analysisPending: true,
        analysisJobId: analysisJobId || undefined,
        analysisError: 'فایل ذخیره شد اما تحلیل کامل نشد؛ دوباره ادامه تحلیل را بزنید.',
      }, { status: 202 });
    }
  } catch (error) {
    console.error('project-file upload failed', error);
    return Response.json({ error: 'ذخیره فایل در فضای پروژه انجام نشد.' }, { status: 500 });
  }
}
