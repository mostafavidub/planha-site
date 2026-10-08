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

type StoredProjectFile = {
  arrayBuffer(): Promise<ArrayBuffer>;
  customMetadata?: Record<string, string>;
  httpMetadata?: { contentType?: string };
};

export type ProjectFileDependencies = {
  engine: string;
  files: {
    get(key: string): Promise<StoredProjectFile | null>;
    put(
      key: string,
      value: ArrayBuffer,
      options?: {
        httpMetadata?: { contentType?: string };
        customMetadata?: Record<string, string>;
      },
    ): Promise<unknown>;
  };
  bridgeHeaders(request: Request): Record<string, string>;
  sameOrigin(request: Request): boolean;
  fetcher?: typeof fetch;
};

const ANALYSIS_JOB_ID = /^[0-9a-f]{32}$/;

class QuestionnaireTerminalError extends Error {}

function engineHeaders(request: Request, dependencies: ProjectFileDependencies) {
  const auth = dependencies.bridgeHeaders(request);
  return {
    'x-panel-token': auth['x-panel-token'],
    'x-customer-session': auth['x-customer-session'],
    accept: 'application/json',
  };
}

async function readQuestionnaireResponse(engineResponse: Response, analysisJobId = '') {
  if (!engineResponse.ok) {
    let detail = '';
    try {
      const failure = await engineResponse.json() as { detail?: string; error?: string };
      detail = failure.detail || failure.error || '';
    } catch {
      // Keep customer output independent from non-JSON upstream bodies.
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
  if (!ANALYSIS_JOB_ID.test(jobId) || (analysisJobId && jobId !== analysisJobId))
    throw new Error('questionnaire_engine_job_identity_invalid');
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

async function pollQuestionnaire(
  analysisJobId: string,
  request: Request,
  dependencies: ProjectFileDependencies,
) {
  const fetcher = dependencies.fetcher || fetch;
  const response = await fetcher(
    `${dependencies.engine}/internal/panel/questionnaire/${analysisJobId}`,
    { headers: engineHeaders(request, dependencies), signal: AbortSignal.timeout(15_000) },
  );
  return readQuestionnaireResponse(response, analysisJobId);
}

async function startQuestionnaire(
  bytes: ArrayBuffer,
  name: string,
  contentType: string,
  discipline: 'mechanical' | 'electrical',
  occupancy: string,
  request: Request,
  dependencies: ProjectFileDependencies,
) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: contentType }), name);
  const fetcher = dependencies.fetcher || fetch;
  const response = await fetcher(
    `${dependencies.engine}/internal/panel/questionnaire/start?discipline=${discipline}&occupancy=${encodeURIComponent(occupancy)}`,
    {
      method: 'POST', body: form, headers: engineHeaders(request, dependencies),
      signal: AbortSignal.timeout(30_000),
    },
  );
  return readQuestionnaireResponse(response);
}

export async function handleProjectFileRequest(
  request: Request,
  dependencies: ProjectFileDependencies,
) {
  if (!dependencies.sameOrigin(request))
    return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    const field = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value : '';
    };
    const key = field('key');
    const analysisJobId = field('analysisJobId');
    const userId = field('userId');
    const discipline = form.get('discipline') === 'electrical' ? 'electrical' : 'mechanical';
    const occupancy = field('occupancy').trim();
    const fetcher = dependencies.fetcher || fetch;

    // Authentication and owner binding apply to upload, retry, resume, and polling.
    const sessionResponse = await fetcher(`${dependencies.engine}/internal/panel/customer/state`, {
      method: 'POST', headers: dependencies.bridgeHeaders(request), body: '{}',
      signal: AbortSignal.timeout(15_000),
    });
    if (!sessionResponse.ok)
      return Response.json({ error: 'دوباره وارد پنل شوید.' }, { status: 401 });
    const session = await sessionResponse.json() as { userId: string };
    if (!/^[A-Za-z0-9_-]+$/.test(userId) || session.userId !== userId)
      return Response.json({ error: 'مالک فایل معتبر نیست.' }, { status: 403 });

    if (analysisJobId) {
      if (!ANALYSIS_JOB_ID.test(analysisJobId))
        return Response.json({ error: 'شناسه تحلیل فایل معتبر نیست.' }, { status: 400 });
      if (!key.startsWith(`projects/${userId}/`))
        return Response.json({ error: 'فایل ذخیره‌شده معتبر نیست.' }, { status: 403 });
      const name = field('name') || undefined;
      const suppliedSize = Number(field('size'));
      const size = Number.isFinite(suppliedSize) && suppliedSize >= 0 ? suppliedSize : undefined;
      try {
        // Hot path: the backend job is authoritative; no R2 lookup or body read is needed.
        const outcome = await pollQuestionnaire(analysisJobId, request, dependencies);
        if (outcome.pending)
          return Response.json({
            key, name, size, analysisPending: true, analysisJobId: outcome.jobId,
            analysisError: 'تحلیل معماری در حال انجام است.',
          }, { status: 202 });
        return Response.json({ key, name, size, analysisJobId: outcome.jobId, analysis: outcome.analysis });
      } catch (error) {
        console.error('questionnaire polling failed', error);
        if (error instanceof QuestionnaireTerminalError)
          return Response.json({ key, name, size, error: error.message }, { status: 422 });
        return Response.json({
          key, name, size, analysisPending: true, analysisJobId,
          analysisError: 'وضعیت تحلیل دریافت نشد؛ دوباره تلاش می‌شود.',
        }, { status: 202 });
      }
    }

    let storedKey = key;
    let name = '';
    let contentType = 'application/octet-stream';
    let bytes: ArrayBuffer;
    if (file instanceof File && file.size > 0) {
      if (file.size > 50_000_000)
        return Response.json({ error: 'حجم فایل بیشتر از ۵۰ مگابایت است.' }, { status: 413 });
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['zip', 'dxf'].includes(extension))
        return Response.json({ error: 'فقط فایل ZIP یا DXF قابل قبول است.' }, { status: 415 });
      storedKey = `projects/${userId}/${crypto.randomUUID()}.${extension}`;
      name = file.name;
      contentType = file.type || (extension === 'zip' ? 'application/zip' : 'application/dxf');
      bytes = await file.arrayBuffer();
      await dependencies.files.put(storedKey, bytes, {
        httpMetadata: { contentType }, customMetadata: { originalName: encodeURIComponent(name) },
      });
    } else {
      if (!storedKey.startsWith(`projects/${userId}/`))
        return Response.json({ error: 'فایل ذخیره‌شده معتبر نیست.' }, { status: 403 });
      const stored = await dependencies.files.get(storedKey);
      if (!stored)
        return Response.json({ error: 'فایل ذخیره‌شده پیدا نشد؛ دوباره بارگذاری کنید.' }, { status: 404 });
      bytes = await stored.arrayBuffer();
      name = decodeURIComponent(stored.customMetadata?.originalName || storedKey.split('/').pop() || 'project.dxf');
      contentType = stored.httpMetadata?.contentType || contentType;
    }
    try {
      const outcome = await startQuestionnaire(
        bytes, name, contentType, discipline, occupancy, request, dependencies,
      );
      if (outcome.pending)
        return Response.json({
          key: storedKey, name, size: bytes.byteLength, analysisPending: true,
          analysisJobId: outcome.jobId, analysisError: 'تحلیل معماری در حال انجام است.',
        }, { status: 202 });
      return Response.json({
        key: storedKey, name, size: bytes.byteLength,
        analysisJobId: outcome.jobId, analysis: outcome.analysis,
      });
    } catch (error) {
      console.error('questionnaire analysis failed or deferred', error);
      if (error instanceof QuestionnaireTerminalError)
        return Response.json({ key: storedKey, name, size: bytes.byteLength, error: error.message }, { status: 422 });
      return Response.json({
        key: storedKey, name, size: bytes.byteLength, analysisPending: true,
        analysisError: 'فایل ذخیره شد اما تحلیل کامل نشد؛ دوباره ادامه تحلیل را بزنید.',
      }, { status: 202 });
    }
  } catch (error) {
    console.error('project-file upload failed', error);
    return Response.json({ error: 'ذخیره فایل در فضای پروژه انجام نشد.' }, { status: 500 });
  }
}
