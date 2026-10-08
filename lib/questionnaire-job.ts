export type QuestionnaireJobResult<T> = {
  analysis?: T;
  analysisPending?: boolean;
  analysisJobId?: string;
};

export async function pollQuestionnaireJob<T extends QuestionnaireJobResult<unknown>>(
  initial: T,
  readStatus: (current: T) => Promise<T>,
  onPending: (current: T) => Promise<void> | void,
  sleep: (milliseconds: number) => Promise<void>,
  options: { maxAttempts?: number; intervalMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 90;
  const intervalMs = options.intervalMs ?? 1500;
  let current = initial;
  if (current.analysis || !current.analysisPending) return current;

  await onPending(current);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await sleep(Math.min(intervalMs + attempt * 100, 3000));
    current = await readStatus(current);
    if (current.analysis || !current.analysisPending) return current;
    await onPending(current);
  }
  throw new Error(
    'تحلیل معماری همچنان در حال انجام است؛ پروژه ذخیره شده و می‌توانید بعداً ادامه دهید.',
  );
}
