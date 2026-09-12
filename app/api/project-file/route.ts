import { env } from 'cloudflare:workers';
import { ENGINE, bridgeHeaders, sameOrigin } from '@/lib/customer-bridge';

const QUESTIONNAIRE_ENGINE =
  'https://web-app-production-3d3b.up.railway.app/api/questionnaire/analyze';

type EngineQuestion = {
  key: string;
  question: string;
  input_type?: 'text' | 'number' | 'radio';
  options?: string[];
};

type EngineQuestionnaire = {
  version: string;
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

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    const userId = String(form.get('userId') || '').replace(/[^A-Za-z0-9_-]/g, '');
    const discipline = form.get('discipline') === 'electrical' ? 'electrical' : 'mechanical';
    const occupancy = String(form.get('occupancy') || '').trim();
    const sessionResponse = await fetch(`${ENGINE}/internal/panel/customer/state`, { method: 'POST', headers: bridgeHeaders(request), body: '{}', signal: AbortSignal.timeout(15000) });
    if (!sessionResponse.ok) return Response.json({ error: 'دوباره وارد پنل شوید.' }, { status: 401 });
    const session = await sessionResponse.json() as { userId: string };
    if (session.userId !== userId) return Response.json({ error: 'مالک فایل معتبر نیست.' }, { status: 403 });
    if (!(file instanceof File) || !userId || file.size === 0)
      return Response.json({ error: 'فایل معتبر دریافت نشد.' }, { status: 400 });
    if (file.size > 50_000_000)
      return Response.json({ error: 'حجم فایل بیشتر از ۵۰ مگابایت است.' }, { status: 413 });
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['zip', 'dxf'].includes(extension))
      return Response.json({ error: 'فقط فایل ZIP یا DXF قابل قبول است.' }, { status: 415 });
    const key = `projects/${userId}/${crypto.randomUUID()}.${extension}`;
    const engineForm = new FormData();
    engineForm.append('file', file, file.name);
    const engineResponse = await fetch(
      `${QUESTIONNAIRE_ENGINE}?discipline=${discipline}&occupancy=${encodeURIComponent(occupancy)}`,
      {
        method: 'POST',
        body: engineForm,
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!engineResponse.ok) {
      console.error('questionnaire engine failed', engineResponse.status);
      return Response.json(
        {
          error:
            'تحلیل مرکزی پروژه تکمیل نشد؛ فایل ذخیره نشد. لطفاً دوباره تلاش کنید.',
        },
        { status: 503 },
      );
    }
    const engine = (await engineResponse.json()) as EngineQuestionnaire;
    if (!Array.isArray(engine.questions) || !engine.version) {
      return Response.json(
        { error: 'پاسخ موتور تحلیل قابل استفاده نبود.' },
        { status: 502 },
      );
    }
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
    Object.assign(analysis, {
      inferredAnswers: engine.inferred_answers || {},
      questions: engine.questions,
      conditionalQuestions: engine.conditional_questions || [],
      questionnaireVersion: engine.version,
      questionnaireSource: engine.source,
      autoSummary: engine.auto_summary || [],
    });
    await (env.FILES as R2Bucket).put(key, file.stream(), {
      httpMetadata: { contentType: file.type || (extension === 'zip' ? 'application/zip' : 'application/dxf') },
      customMetadata: { originalName: encodeURIComponent(file.name) },
    });
    return Response.json({ key, name: file.name, size: file.size, analysis });
  } catch (error) {
    console.error('project-file upload failed', error);
    return Response.json({ error: 'ذخیره فایل در فضای پروژه انجام نشد.' }, { status: 500 });
  }
}
