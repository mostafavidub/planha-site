'use client';
import { WalletAdjustment } from './wallet-adjustment';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  FolderKanban,
  IdCard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DesignQuestion } from '@/lib/design-questionnaire';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
type Status = 'در حال بررسی' | 'در حال پردازش' | 'نیازمند اصلاح' | 'تکمیل شده';
type User = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  wallet: number;
  active: boolean;
  admin: boolean;
  province?: string;
  city?: string;
  note?: string;
  nationalId?: string;
  createdAt?: string;
  lastLoginAt?: string;
  avatar?: string;
  avatarKey?: string;
};
type Project = {
  quoteToken?: string;
  id: string;
  owner: string;
  title: string;
  service: string;
  area: number;
  amount: number;
  status: Status;
  progress: number;
  date: string;
  assignee?: string;
  startDate?: string;
  dueDate?: string;
  note?: string;
  fileKey?: string;
  fileName?: string;
  answers?: Record<string, string | number>;
  paymentMethod?: 'wallet' | 'gateway';
  engineProjectId?: number;
  engineProjectToken?: string;
  designStage?: string;
  designLabel?: string;
  designDetail?: string;
  designTimeline?: DesignTimelineItem[];
  outputReady?: boolean;
  engineRevision?: number;
  stateUpdatedAt?: string;
  lastError?: string;
};
type DesignTimelineItem = {
  stage: string;
  label: string;
  percent: number;
  state: 'completed' | 'current' | 'pending';
};
type EngineProjectState = {
  engine_project_id?: number;
  project_token?: string;
  status?: string;
  progress?: number;
  last_error?: string;
  output_ready?: boolean;
  current_revision?: number;
  state_revision?: number;
  state_updated_at?: string;
  design_progress?: {
    stage: string;
    label: string;
    detail?: string;
    percent: number;
    updated_at?: string;
    timeline: DesignTimelineItem[];
  };
  error?: string;
  detail?: string;
  failure?: {
    message?: string;
    action?: 'complete_answers' | 'reupload' | 'technical_review';
  };
  questions?: {
    key: string;
    question: string;
    input_type?: 'text' | 'number' | 'radio';
    options?: string[];
  }[];
  question_count?: number;
  inferred_answers?: Record<string, string>;
};
class DesignProjectRequestError extends Error {
  payload: EngineProjectState;

  constructor(payload: EngineProjectState) {
    super(
      payload.failure?.message ||
        payload.last_error ||
        payload.error ||
        payload.detail ||
        'اتصال به موتور تولید انجام نشد.',
    );
    this.payload = payload;
  }
}
type Tx = {
  id: string;
  owner: string;
  project: string;
  title: string;
  amount: number;
  date: string;
  status?: string;
  gatewayRef?: string;
  category?: string;
  note?: string;
};
type Plan = {
  id: string;
  name: string;
  price: number;
  minimumPrice: number;
  pricePerM2: number;
  unit: string;
  enabled: boolean;
  desc: string;
};
type Store = { users: User[]; projects: Project[]; tx: Tx[]; plans: Plan[] };
type ProjectAnalysis = {
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
  inferredAnswers: Record<string, string>;
  questions?: {
    key: string;
    question: string;
    input_type?: 'text' | 'number' | 'radio';
    options?: string[];
  }[];
  questionnaireVersion?: string;
  questionnaireSource?: string;
  autoSummary?: string[];
  conditionalQuestions?: NonNullable<ProjectAnalysis['questions']>;
};
type StoreUpdate = (fn: (store: Store) => Store) => void;
const defaultPlans: Plan[] = [
  {
    id: 'PLN-101',
    name: 'خوانش هوشمند نقشه',
    price: 12000,
    minimumPrice: 1500000,
    pricePerM2: 12000,
    unit: 'مترمربع',
    enabled: true,
    desc: 'Automated AI plan data extraction',
  },
  {
    id: 'PLN-102',
    name: 'طراحی برق',
    price: 24000,
    minimumPrice: 4200000,
    pricePerM2: 24000,
    unit: 'مترمربع',
    enabled: true,
    desc: 'Electrical systems and calculations',
  },
  {
    id: 'PLN-103',
    name: 'طراحی مکانیک',
    price: 28000,
    minimumPrice: 4900000,
    pricePerM2: 28000,
    unit: 'مترمربع',
    enabled: true,
    desc: 'Mechanical systems and calculations',
  },
  {
    id: 'PLN-104',
    name: 'طراحی معماری',
    price: 45000,
    minimumPrice: 7500000,
    pricePerM2: 45000,
    unit: 'مترمربع',
    enabled: true,
    desc: 'Phase one and two architecture design',
  },
];
const seed: Store = { users: [], plans: defaultPlans, projects: [], tx: [] };
let storeCache: Store | null = null;
function readStore() {
  if (storeCache) return storeCache;
  try {
    storeCache = JSON.parse(
      localStorage.getItem('engi-store') || JSON.stringify(seed),
    );
  } catch {
    storeCache = { ...seed };
  }
  return storeCache!;
}
function writeStore(store: Store) {
  storeCache = store;
  localStorage.setItem('engi-store', JSON.stringify(store));
}
async function uploadAvatarFile(userId: string, file: Blob, oldKey = '') {
  const form = new FormData();
  form.append('file', file, 'avatar');
  form.append('userId', userId);
  if (oldKey) form.append('oldKey', oldKey);
  const response = await fetch('/api/avatar', { method: 'POST', body: form });
  if (!response.ok) throw new Error('avatar_upload_failed');
  return response.json() as Promise<{ key: string; url: string }>;
}
async function uploadProjectFile(
  userId: string,
  file: File,
  discipline: 'mechanical' | 'electrical',
  occupancy: string,
  onProgress: (value: number) => void,
) {
  const form = new FormData();
  form.append('file', file);
  form.append('userId', userId);
  form.append('discipline', discipline);
  form.append('occupancy', occupancy);
  return new Promise<{
    key: string;
    name: string;
    size: number;
    analysis: ProjectAnalysis;
  }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/project-file');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
    };
    request.onerror = () => reject(new Error('ارتباط با سرور قطع شد.'));
    request.onload = () => {
      let body: {
        key?: string;
        name?: string;
        size?: number;
        analysis?: ProjectAnalysis;
        error?: string;
      } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {}
      if (request.status >= 200 && request.status < 300 && body.key) {
        onProgress(100);
        resolve(
          body as {
            key: string;
            name: string;
            size: number;
            analysis: ProjectAnalysis;
          },
        );
      } else reject(new Error(body.error || `خطای آپلود (${request.status})`));
    };
    request.send(form);
  });
}
async function designProjectRequest(body: Record<string, unknown>) {
  const response = await fetch('/api/design-project', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as EngineProjectState;
  if (!response.ok)
    throw new DesignProjectRequestError(payload);
  return payload;
}
async function customerRequest(action: string, body: Record<string, unknown> = {}) {
  const response = await fetch('/api/customer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, action }) });
  const payload = await response.json() as any;
  if (!response.ok) throw new DesignProjectRequestError(payload);
  return payload;
}
function customerProject(row: any): Project {
  // Server values are authoritative. Defaults only fill fields that are absent;
  // they must never reset a durable completed project to 0% while polling.
  return mergeEngineState(
    { date: 'امروز', status: 'در حال پردازش', progress: 0, ...row },
    row.engine,
  );
}
function applyCustomerState(payload: any) {
  if (!payload.userId) return;
  const current = readStore();
  const incoming = (payload.projects || []).map(customerProject);
  const reconciled = incoming.map((project: Project) =>
    reconcileProjectSnapshot(
      current.projects.find((item) => item.id === project.id),
      project,
    ),
  );
  writeStore({ ...current,
    users: current.users.some(u => u.id === payload.userId)
      ? current.users.map(u => u.id === payload.userId ? { ...u, wallet: payload.balance } : u)
      : [...current.users, { id: payload.userId, wallet: payload.balance, name: '', mobile: localStorage.getItem('engi-auth-phone') || '', email: '', active: true, admin: false }],
    // Preserve projects that have not reached the server yet. The import path
    // runs before state refresh and replaces them with the durable copies.
    projects: [...reconciled, ...current.projects.filter(p => !incoming.some((x: Project) => x.id === p.id))],
    tx: [...(payload.transactions || []), ...current.tx.filter(t => t.owner !== payload.userId)],
  });
  window.dispatchEvent(new Event('engi-update'));
}
function mergeEngineState(project: Project, state?: EngineProjectState): Project {
  // Projects created before engine tracking was introduced legitimately have
  // no engine object. Treat them as having no newer engine state instead of
  // crashing the authenticated panel after a successful login.
  state = state || ({} as EngineProjectState);
  const hasEngineState = Object.keys(state).length > 0;
  const progress = state.design_progress;
  const engineStatus = state.status || '';
  const currentRevision = Number(project.engineRevision || 0);
  const incomingRevision = Number(
    state.state_revision ?? state.current_revision ?? currentRevision,
  );
  const sameOrOlderRevision = incomingRevision <= currentRevision;
  const outputReady = hasEngineState
    ? Boolean(
        state.output_ready ||
          engineStatus === 'ready' ||
          (sameOrOlderRevision && project.outputReady),
      )
    : Boolean(project.outputReady || project.status === 'تکمیل شده');
  const reportedProgress = progress?.percent ?? state.progress ?? project.progress;
  const boundedProgress = Math.max(0, Math.min(100, reportedProgress));
  return {
    ...project,
    engineProjectId: state.engine_project_id || project.engineProjectId,
    engineProjectToken: state.project_token || project.engineProjectToken,
    progress:
      outputReady
        ? 100
        : sameOrOlderRevision
          ? Math.max(project.progress, boundedProgress)
          : boundedProgress,
    status:
      !hasEngineState
        ? project.status
        : state.output_ready || engineStatus === 'ready'
        ? 'تکمیل شده'
        : engineStatus === 'failed' || engineStatus === 'asking'
          ? 'نیازمند اصلاح'
          : 'در حال پردازش',
    designStage: progress?.stage || project.designStage,
    designLabel: progress?.label || project.designLabel,
    designDetail: progress?.detail || project.designDetail,
    designTimeline: progress?.timeline || project.designTimeline,
    outputReady,
    engineRevision: incomingRevision,
    stateUpdatedAt: state.state_updated_at || progress?.updated_at || project.stateUpdatedAt,
    lastError:
      state.failure?.message ??
      state.last_error ??
      state.error ??
      project.lastError,
  };
}

function reconcileProjectSnapshot(current: Project | undefined, incoming: Project): Project {
  if (!current) return incoming;
  const currentRevision = Number(current.engineRevision || 0);
  const incomingRevision = Number(incoming.engineRevision || 0);
  if (incomingRevision < currentRevision) return current;
  if (incomingRevision > currentRevision) return incoming;
  const outputReady = Boolean(current.outputReady || incoming.outputReady);
  return {
    ...incoming,
    progress: outputReady ? 100 : Math.max(current.progress, incoming.progress),
    status: outputReady ? 'تکمیل شده' : incoming.status,
    outputReady,
  };
}
async function startDesignProject(project: Project) {
  if (!project.fileKey || !project.fileName)
    throw new Error('فایل ذخیره‌شده پروژه پیدا نشد؛ فایل را دوباره بارگذاری کنید.');
  const state = await designProjectRequest({
    projectId: project.id,
    userId: project.owner,
    title: project.title,
    fileKey: project.fileKey,
    fileName: project.fileName,
    discipline: project.service === 'طراحی برق' ? 'electrical' : 'mechanical',
    occupancy: project.answers?.kind || '',
    answers: project.answers || {},
  });
  return mergeEngineState(project, state);
}
async function startDesignProjectWithRetry(project: Project) {
  try {
    return await startDesignProject(project);
  } catch (reason) {
    if (
      reason instanceof DesignProjectRequestError &&
      (reason.payload.status === 'asking' || reason.payload.questions?.length)
    )
      throw reason;
    // Creating a project is idempotent on project.id. A single retry recovers
    // short-lived bridge/engine outages without producing a duplicate project.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return startDesignProject(project);
  }
}
async function readDesignProjectState(project: Project) {
  if (!project.engineProjectId || !project.engineProjectToken) return project;
  return mergeEngineState(
    project,
    await designProjectRequest({
      action: 'status',
      engineProjectId: project.engineProjectId,
      projectToken: project.engineProjectToken,
    }),
  );
}
async function downloadProjectOutput(project: Project) {
  const outputReady = project.outputReady || project.status === 'تکمیل شده';
  if (!project.engineProjectId || !project.engineProjectToken || !outputReady)
    throw new Error('خروجی پروژه هنوز آماده دانلود نیست.');
  const response = await fetch('/api/design-project/output', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      engineProjectId: project.engineProjectId,
      projectToken: project.engineProjectToken,
    }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'دانلود خروجی انجام نشد.');
  }
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const filename = encoded ? decodeURIComponent(encoded) : plain || `EngiTools_${project.id}.zip`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
const localTestSeed: Store = {
  users: [
    {
      id: 'USR-TEST01',
      name: 'Admin Test User',
      mobile: '09120000000',
      email: 'test@example.com',
      wallet: 1250000,
      active: true,
      admin: false,
    },
  ],
  plans: [
    {
      id: 'PLN-TEST01',
      name: 'طراحی معماری',
      price: 45000,
      minimumPrice: 7500000,
      pricePerM2: 45000,
      unit: 'مترمربع',
      enabled: true,
      desc: 'Local test fixture',
    },
  ],
  projects: [
    {
      id: 'PRJ-TEST01',
      owner: 'USR-TEST01',
      title: 'پروژه تست ادمین',
      service: 'طراحی معماری',
      area: 250,
      amount: 11250000,
      status: 'در حال بررسی',
      progress: 15,
      date: 'امروز',
    },
  ],
  tx: [
    {
      id: 'TXN-TEST01',
      owner: 'USR-TEST01',
      project: 'PRJ-TEST01',
      title: 'پرداخت پروژه',
      amount: -350000,
      date: 'امروز',
    },
  ],
};
const money = (n: number) => `${Math.abs(n).toLocaleString('fa-IR')} تومان`;
const accountDate = (value?: string, withTime = false) =>
  value
    ? new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      }).format(new Date(value))
    : 'ثبت نشده';
async function hashUserPassword(userId: string, password: string) {
  const bytes = new TextEncoder().encode(
    `engitools-user:${userId}:${password}`,
  );
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
let me = 'USR-2048';
function useAppPath() {
  const initialPath = usePathname();
  const [path, setPath] = useState(initialPath);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('engi-route', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('engi-route', sync);
    };
  }, []);
  return path;
}
function navigate(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigatePath(href);
}
function navigatePath(href: string) {
  window.history.pushState({}, '', href);
  window.dispatchEvent(new Event('engi-route'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}
const en = (s: string) =>
  (
    ({
      'در حال بررسی': 'Under review',
      'در حال پردازش': 'Processing',
      'نیازمند اصلاح': 'Needs revision',
      'تکمیل شده': 'Completed',
      فعال: 'Active',
      تعلیق: 'Suspended',
      'طراحی معماری': 'Architecture Design',
      'طراحی مکانیک': 'Mechanical Design',
      'طراحی برق': 'Electrical Design',
      'خوانش هوشمند نقشه': 'AI Plan Reader',
      'مجتمع مسکونی آفتاب': 'Aftab Residential Complex',
      'ویلای دماوند': 'Damavand Villa',
      'دفتر مرکزی پارس': 'Pars Headquarters',
      'بازسازی خانه سپیدار': 'Sepidar House Renovation',
      'آوا رحیمی': 'Ava Rahimi',
      'آرمان فرهادی': 'Arman Farhadi',
      'نیکا آزادی': 'Nika Azadi',
      'کیان مرادی': 'Kian Moradi',
    }) as Record<string, string>
  )[s] || s;
function useStore() {
  let [data, setData] = useState(seed);
  useEffect(() => {
    try {
      const defaultStore =
        location.hostname === 'localhost' ? localTestSeed : seed;
      if (!localStorage.getItem('engi-data-cleared-v1')) {
        writeStore(defaultStore);
        localStorage.setItem('engi-data-cleared-v1', '1');
        localStorage.removeItem('engi-auth-user');
        localStorage.removeItem('engi-auth-phone');
      }
      let x = localStorage.getItem('engi-store');
      if (x) {
        const stored: Store = JSON.parse(x);
        const now = new Date().toISOString();
        const cleaned = {
          ...stored,
          plans: defaultPlans.map((fallback) => {
            const current = (stored.plans || []).find(
              (plan) => plan.id === fallback.id,
            );
            return current
              ? {
                  ...fallback,
                  ...current,
                  minimumPrice: Number(
                    current.minimumPrice ?? fallback.minimumPrice,
                  ),
                  pricePerM2: Number(
                    current.pricePerM2 ?? current.price ?? fallback.pricePerM2,
                  ),
                }
              : fallback;
          }),
          users: stored.users.map((user) => ({
            ...user,
            createdAt: user.createdAt || now,
            lastLoginAt: user.lastLoginAt || now,
            name:
              user.name === 'آوا رحیمی' || /^کاربر\s+\d{4}$/.test(user.name)
                ? ''
                : user.name,
          })),
        };
        writeStore(cleaned);
        setData(cleaned);
        const legacyAvatars = cleaned.users.filter((user) =>
          user.avatar?.startsWith('data:'),
        );
        if (legacyAvatars.length)
          void Promise.all(
            legacyAvatars.map(async (user) => {
              const blob = await fetch(user.avatar!).then((response) =>
                response.blob(),
              );
              const uploaded = await uploadAvatarFile(
                user.id,
                blob,
                user.avatarKey,
              );
              return { id: user.id, ...uploaded };
            }),
          )
            .then((uploaded) => {
              const current = readStore();
              const next = {
                ...current,
                users: current.users.map((user) => {
                  const avatar = uploaded.find((item) => item.id === user.id);
                  return avatar
                    ? { ...user, avatar: avatar.url, avatarKey: avatar.key }
                    : user;
                }),
              };
              writeStore(next);
              setData(next);
              window.dispatchEvent(new Event('engi-update'));
            })
            .catch(() => {});
      }
    } catch {}
  }, []);
  useEffect(() => {
    const sync = () => {
      try {
        storeCache = null;
        setData(readStore());
      } catch {}
    };
    const storageSync = () => {
      storeCache = null;
      sync();
    };
    window.addEventListener('engi-update', sync);
    window.addEventListener('storage', storageSync);
    return () => {
      window.removeEventListener('engi-update', sync);
      window.removeEventListener('storage', storageSync);
    };
  }, []);
  const update = useCallback((fn: (s: Store) => Store) =>
    setData((s) => {
      let n = fn(s);
      writeStore(n);
      window.dispatchEvent(new Event('engi-update'));
      return n;
    }), []);
  return [data, update] as const;
}
const an = [
    ['Users', Users, '/admin/users'],
    ['Projects', FolderKanban, '/admin/projects'],
    ['Transactions', CreditCard, '/admin/transactions'],
    ['Service Pricing', CircleDollarSign, '/admin/pricing'],
  ] as const,
  un = [
    ['پروژه‌های من', FolderKanban, '/panel/projects'],
    ['تراکنش‌ها', CreditCard, '/panel/transactions'],
    ['پروفایل من', UserRound, '/panel/profile'],
  ] as const;
function Login({
  data,
  update,
}: {
  data: Store;
  update: (f: (s: Store) => Store) => void;
}) {
  let [phone, setPhone] = useState(''),
    [error, setError] = useState('');
  let normalize = (v: string) =>
    v
      .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
      .replace(/\D/g, '');
  function enter() {
    let mobile = normalize(phone);
    if (!/^09\d{9}$/.test(mobile)) {
      setError('شماره موبایل معتبر وارد کنید.');
      return;
    }
    let existing = data.users.find((u) => normalize(u.mobile) === mobile),
      id =
        existing?.id ||
        `USR-${String(100000 + data.users.length + 1).padStart(6, '0')}`;
    if (!existing)
      update((s) => ({
        ...s,
        users: [
          ...s.users,
          {
            id,
            name: '',
            mobile,
            email: '',
            wallet: 0,
            active: true,
            admin: false,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          },
        ],
      }));
    localStorage.setItem('engi-auth-phone', mobile);
    localStorage.setItem('engi-auth-user', id);
    window.dispatchEvent(new Event('engi-update'));
    me = id;
    window.location.href = '/panel/projects';
  }
  return (
    <main className="user-login" dir="rtl">
      <section>
        <div className="login-logo">
          <i>
            <Building2 />
          </i>
          <span>
            <b>انجی‌تولز</b>
            <small>سامانه خدمات مهندسی</small>
          </span>
        </div>
        <div className="login-copy">
          <small>ورود به پنل کاربری</small>
          <h1>خوش آمدید</h1>
          <p>شماره موبایل خود را وارد کنید تا پنل اختصاصی شما باز شود.</p>
        </div>
        <label>
          شماره موبایل
          <Input
            inputMode="numeric"
            autoFocus
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError('');
            }}
            placeholder="۰۹۱۲۱۲۳۴۵۶۷"
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <Button onClick={enter}>ورود به پنل</Button>
        <p className="otp-off">
          <ShieldCheck />
          ورود مستقیم فعال است؛ در این مرحله کد تأیید ارسال نمی‌شود.
        </p>
      </section>
    </main>
  );
}
function LoginSafe() {
  let [phone, setPhone] = useState(''),
    [error, setError] = useState(''),
    [entering, setEntering] = useState(false);
  let normalize = (v: string) =>
    v
      .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
      .replace(/\D/g, '');
  async function enter() {
    let mobile = normalize(phone);
    if (!/^09\d{9}$/.test(mobile)) {
      setError('شماره موبایل معتبر وارد کنید.');
      return;
    }
    let store: Store;
    try {
      store = readStore();
    } catch {
      store = { ...seed };
    }
    let existing = store.users.find((u) => normalize(u.mobile) === mobile),
      id =
        existing?.id ||
        `USR-${String(100000 + store.users.length + 1).padStart(6, '0')}`;
    const now = new Date().toISOString();
    let server;
    setEntering(true);
    setError('');
    try { server = await customerRequest('session', { phone: mobile }); }
    catch (reason) {
      setEntering(false);
      setError(reason instanceof Error ? reason.message : 'ورود انجام نشد.');
      return;
    }
    id = server.userId;
    existing = store.users.find(u => u.id === id) || existing;
    const legacyId = existing && existing.id !== id ? existing.id : '';
    // Do not turn a browser-only balance into real server credit.
    // Move the returning customer's local profile and draft ownership onto the
    // authoritative server ID, then remove every same-phone shell.
    store = {
      ...store,
      users: store.users.filter(
        (user) => user.id !== id && normalize(user.mobile) !== mobile,
      ),
      projects: legacyId
        ? store.projects.map((project) =>
            project.owner === legacyId ? { ...project, owner: id } : project,
          )
        : store.projects,
    };
    store.users.push({ ...(existing || { name: '', email: '', active: true, admin: false }), id, mobile, wallet: server.balance, createdAt: existing?.createdAt || now, lastLoginAt: now });
    existing = store.users.find(u => u.id === id);
    if (!existing) {
      store = {
        ...store,
        users: [
          ...store.users,
          {
            id,
            name: '',
            mobile,
            email: '',
            wallet: 0,
            active: true,
            admin: false,
            createdAt: now,
            lastLoginAt: now,
          },
        ],
      };
      writeStore(store);
    } else {
      store = {
        ...store,
        users: store.users.map((user) =>
          user.id === id ? { ...user, lastLoginAt: now } : user,
        ),
      };
      writeStore(store);
    }
    localStorage.setItem('engi-auth-phone', mobile);
    localStorage.setItem('engi-auth-user', id);
    applyCustomerState(server);
    me = id;
    window.dispatchEvent(new Event('engi-update'));
    // A large first-time project migration must never hold the login screen.
    // The authenticated panel loads immediately and syncSession imports any
    // browser-only projects in the background.
    window.location.replace(sessionStorage.getItem('engi-handoff') ? '/panel/projects/new' : '/panel/projects');
  }
  return (
    <main className="user-login" dir="rtl">
      <section>
        <div className="login-logo">
          <i>
            <Building2 />
          </i>
          <span>
            <b>انجی‌تولز</b>
            <small>سامانه خدمات مهندسی</small>
          </span>
        </div>
        <div className="login-copy">
          <small>ورود به پنل کاربری</small>
          <h1>خوش آمدید</h1>
          <p>شماره موبایل خود را وارد کنید تا پنل اختصاصی شما باز شود.</p>
        </div>
        <label>
          شماره موبایل
          <Input
            inputMode="numeric"
            autoFocus
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError('');
            }}
            placeholder="۰۹۱۲۱۲۳۴۵۶۷"
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <Button onClick={enter} disabled={entering}>
          {entering ? 'در حال ورود…' : 'ورود به پنل'}
        </Button>
        <p className="otp-off">
          <ShieldCheck />
          ورود مستقیم فعال است؛ در این مرحله کد تأیید ارسال نمی‌شود.
        </p>
      </section>
    </main>
  );
}
function Shell({
  admin,
  children,
}: {
  admin: boolean;
  children: React.ReactNode;
}) {
  let path = useAppPath(),
    [open, setOpen] = useState(false),
    [balance, setBalance] = useState(0),
    [charge, setCharge] = useState(false),
    [amount, setAmount] = useState(1000000),
    [acting, setActing] = useState(''),
    [userLabel, setUserLabel] = useState('کاربر'),
    [userAvatar, setUserAvatar] = useState('');
  let nav = admin ? an : un;
  useEffect(() => {
    let sync = () => {
      try {
        let s: Store = readStore();
        const currentUser = s.users.find((u) => u.id === me);
        setBalance(currentUser?.wallet || 0);
        setUserLabel(currentUser?.name || currentUser?.mobile || 'کاربر');
        setUserAvatar(currentUser?.avatar || '');
        setActing(sessionStorage.getItem('engi-impersonate-name') || '');
      } catch {}
    };
    sync();
    window.addEventListener('engi-update', sync);
    return () => window.removeEventListener('engi-update', sync);
  }, []);
  const [charging, setCharging] = useState(false);
  const [chargeError, setChargeError] = useState('');
  const topupRequest = useRef<{amount: number; id: string} | null>(null);
  async function addFunds() {
    if (charging) return;
    if (!Number.isSafeInteger(amount) || amount <= 0) { setChargeError('مبلغ معتبر وارد کنید.'); return; }
    if (!topupRequest.current || topupRequest.current.amount !== amount)
      topupRequest.current = { amount, id: crypto.randomUUID() };
    setCharging(true); setChargeError('');
    try {
      applyCustomerState(await customerRequest('topup', { amount, requestId: topupRequest.current.id }));
      topupRequest.current = null; setCharge(false);
    } catch (e) { setChargeError(e instanceof Error ? e.message : 'افزایش موجودی انجام نشد.'); }
    finally { setCharging(false); }
  }
  function stopActing() {
    sessionStorage.removeItem('engi-impersonate');
    sessionStorage.removeItem('engi-impersonate-name');
    window.history.replaceState({}, '', '/admin/users');
    window.dispatchEvent(new Event('engi-route'));
  }
  async function signOut() {
    if (admin) {
      await fetch('/api/admin/session', { method: 'DELETE' });
      window.location.assign('/admin/login');
      return;
    }
    localStorage.removeItem('engi-auth-user');
    await fetch('/api/customer', { method: 'DELETE' });
    localStorage.removeItem('engi-auth-phone');
    setOpen(false);
    window.location.assign('/panel/login');
  }
  return (
    <div
      className={admin ? 'admin-app' : 'user-app'}
      dir={admin ? 'ltr' : 'rtl'}
    >
      {!admin && acting && (
        <div className="impersonation-banner">
          <ShieldCheck />
          <span>
            شما در حال مشاهده حساب <b>{acting}</b> به‌عنوان سوپرادمین هستید.
          </span>
          <button onClick={stopActing}>پایان مشاهده امن</button>
        </div>
      )}
      <aside className={open ? 'side open' : 'side'}>
        <div className="logo">
          <i>
            <Building2 />
          </i>
          <span>
            <b>{admin ? 'EngiTools' : 'انجی‌تولز'}</b>
            <small>
              {admin ? 'STAGING CONTROL CENTER' : 'محیط آزمایشی STAGING'}
            </small>
          </span>
          <button onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([n, I, h]) => (
            <a
              key={h}
              className={path.startsWith(h) ? 'on' : ''}
              href={h}
              onClick={(event) => navigate(event, h)}
            >
              <I />
              {n}
            </a>
          ))}
        </nav>
        <div className="bottom">
          <button className="menu-logout" type="button" onClick={signOut}>
            <LogOut />
            {admin ? 'Sign out' : 'خروج از حساب'}
          </button>
          <div className="identity">
            {admin || !userAvatar ? (
              <i>{admin ? 'MK' : 'ک'}</i>
            ) : (
              <img
                className="menu-avatar"
                src={userAvatar}
                alt="تصویر پروفایل"
              />
            )}
            <span>
              <b>{admin ? 'Mohammad Karimi' : acting || userLabel}</b>
              {(admin || acting) && (
                <small>
                  {admin ? 'Super Administrator' : 'مشاهده توسط سوپرادمین'}
                </small>
              )}
            </span>
            <MoreHorizontal />
          </div>
        </div>
      </aside>
      {open && <button className="scrim" onClick={() => setOpen(false)} />}
      <main>
        <header>
          <button className="hamb" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          {!admin && (
            <div className="header-wallet">
              <Wallet />
              <span>
                <small>موجودی کیف پول</small>
                <b>{money(balance)}</b>
              </span>
              <button onClick={() => setCharge(true)}>
                <Plus />
                افزایش موجودی
              </button>
            </div>
          )}
          <span>
            <Bell />
          </span>
        </header>
        {children}
      </main>
      <Dialog open={charge} onOpenChange={setCharge}>
        <DialogContent dir="rtl" className="modal">
          <DialogHeader>
            <DialogTitle>افزایش موجودی کیف پول</DialogTitle>
            <DialogDescription>
              مبلغ را به تومان وارد کنید. فعلاً پرداخت آزمایشی است و برداشت بانکی انجام نمی‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="charge-dialog">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(+e.target.value)}
            />
            {chargeError && <p role="alert">{chargeError}</p>}
            <Button onClick={addFunds} disabled={charging}>
              <CreditCard />
              {charging ? 'در حال ثبت…' : 'پرداخت آزمایشی و افزایش موجودی'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Head({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="head">
      <div>
        <small>سامانه یکپارچه خدمات مهندسی</small>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function Tag({ s }: { s: string }) {
  return (
    <span
      className={
        'tag ' +
        (/تکمیل|فعال|موفق/.test(s)
          ? 'ok'
          : /اصلاح|تعلیق/.test(s)
            ? 'bad'
            : 'wait')
      }
    >
      <i />
      {s}
    </span>
  );
}
function Metrics({ data, admin }: { data: Store; admin: boolean }) {
  let ps = admin ? data.projects : data.projects.filter((p) => p.owner === me),
    u = data.users.find((u) => u.id === me)!;
  let a = admin
    ? [
        [
          Users,
          'کاربران فعال',
          data.users.filter((u) => u.active).length.toLocaleString('fa-IR'),
        ],
        [
          FolderKanban,
          'پروژه در جریان',
          ps.filter((p) => p.progress < 100).length.toLocaleString('fa-IR'),
        ],
        [
          CreditCard,
          'حجم تراکنش',
          money(data.tx.filter(t => t.status !== 'آزمایشی').reduce((s, t) => s + Math.abs(t.amount), 0)),
        ],
        [
          CircleDollarSign,
          'خدمات فعال',
          data.plans.filter((p) => p.enabled).length.toLocaleString('fa-IR'),
        ],
      ]
    : [
        [FolderKanban, 'کل پروژه‌ها', ps.length.toLocaleString('fa-IR')],
        [
          FileText,
          'پروژه فعال',
          ps.filter((p) => p.progress < 100).length.toLocaleString('fa-IR'),
        ],
        [Wallet, 'موجودی کیف پول', money(u.wallet)],
        [
          Download,
          'فایل‌های آماده',
          ps.filter((p) => p.outputReady).length.toLocaleString('fa-IR'),
        ],
      ];
  return (
    <div className="metrics">
      {a.map(([I, l, v]: any) => (
        <div className="metric" key={l}>
          <i>
            <I />
          </i>
          <b>{v}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}
function Projects({
  data,
  own = false,
  on,
  onEdit,
}: {
  data: Store;
  own?: boolean;
  on?: (p: Project) => void;
  onEdit?: (p: Project) => void;
}) {
  let rows = own ? data.projects.filter((p) => p.owner === me) : data.projects;
  return (
    <div className={`table${own ? ' own-projects-table' : ''}`}>
      <table>
        <thead>
          <tr>
            <th>{own ? 'پروژه' : 'PROJECT'}</th>
            {!own && <th>CLIENT</th>}
            <th>{own ? 'خدمت' : 'SERVICE'}</th>
            <th>{own ? 'مبلغ' : 'AMOUNT'}</th>
            <th>{own ? 'وضعیت' : 'STATUS'}</th>
            <th>{own ? 'پیشرفت' : 'PROGRESS'}</th>
            <th>{own ? 'تاریخ' : 'DATE'}</th>
            {own && <th>خروجی</th>}
            {!own && onEdit && <th>ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id}
              onClick={() => on?.(p)}
              onKeyDown={(event) => {
                if (on && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  on(p);
                }
              }}
              className={on ? 'project-row-clickable' : undefined}
              role={on ? 'button' : undefined}
              tabIndex={on ? 0 : undefined}
              aria-label={on ? `مشاهده پیشرفت پروژه ${p.title}` : undefined}
            >
              <td data-label={own ? 'پروژه' : 'PROJECT'}>
                <b>{own ? p.title : en(p.title)}</b>
                <code>{p.id}</code>
              </td>
              {!own && (
                <td data-label="CLIENT">
                  {en(data.users.find((u) => u.id === p.owner)?.name || '')}
                </td>
              )}
              <td data-label={own ? 'خدمت' : 'SERVICE'}>{own ? p.service : en(p.service)}</td>
              <td data-label={own ? 'مبلغ' : 'AMOUNT'}>
                {own
                  ? money(p.amount)
                  : `IRR ${p.amount.toLocaleString('en-US')}`}
              </td>
              <td data-label={own ? 'وضعیت' : 'STATUS'}>
                <Tag s={own ? p.status : en(p.status)} />
              </td>
              <td data-label={own ? 'پیشرفت' : 'PROGRESS'}>
                <div className="project-progress-value">
                  <div className="progress">
                    <i style={{ width: p.progress + '%' }} />
                  </div>
                  <span>{p.progress}%</span>
                </div>
              </td>
              <td data-label={own ? 'تاریخ' : 'DATE'}>{own ? p.date : 'Aug 30, 2026'}</td>
              {own && (
                <td data-label="خروجی" onClick={(event) => event.stopPropagation()}>
                  {(p.outputReady || p.status === 'تکمیل شده') &&
                  p.engineProjectId &&
                  p.engineProjectToken ? (
                    <button
                      type="button"
                      className="project-download-button"
                      onClick={() =>
                        downloadProjectOutput(p).catch((error) =>
                          window.alert(
                            error instanceof Error
                              ? error.message
                              : 'دانلود خروجی انجام نشد.',
                          ),
                        )
                      }
                      aria-label={`دانلود خروجی پروژه ${p.title}`}
                    >
                      <Download />
                      دانلود
                    </button>
                  ) : (
                    <span className="project-output-pending">—</span>
                  )}
                </td>
              )}
              {!own && onEdit && (
                <td onClick={(event) => event.stopPropagation()}>
                  <RowActions onShow={() => on?.(p)} onEdit={() => onEdit(p)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Dashboard({ data, admin }: { data: Store; admin: boolean }) {
  return (
    <Shell admin={admin}>
      <article>
        <Head
          title={admin ? 'نمای کلی سامانه' : 'داشبورد من'}
          text={
            admin
              ? 'عملکرد کاربران، پروژه‌ها و جریان مالی در یک نگاه.'
              : 'پروژه‌های مهندسی، پرداخت‌ها و فایل‌های خود را یکجا مدیریت کنید.'
          }
          action={
            !admin && (
              <a
                className="primary"
                href="/panel/projects/new"
                onClick={(e) => navigate(e, '/panel/projects/new')}
              >
                <Plus />
                ثبت پروژه جدید
              </a>
            )
          }
        />
        <Metrics data={data} admin={admin} />
        <section className="card">
          <div className="cardhead">
            <span>
              <h2>{admin ? 'صف پروژه‌ها' : 'آخرین پروژه‌ها'}</h2>
              <p>وضعیت لحظه‌ای سفارش‌ها</p>
            </span>
            <a
              href={admin ? '/admin/projects' : '/panel/projects'}
              onClick={(e) =>
                navigate(e, admin ? '/admin/projects' : '/panel/projects')
              }
            >
              مشاهده همه
            </a>
          </div>
          <Projects data={data} own={!admin} />
        </section>
      </article>
    </Shell>
  );
}
function NewProject({ data, update }: { data: Store; update: StoreUpdate }) {
  const plans = data.plans.filter((p) => p.enabled),
    user = data.users.find((x) => x.id === me);
  const [step, setStep] = useState(1),
    [title, setTitle] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [upload, setUpload] = useState<{ key: string; name: string } | null>(null),
    [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState('');
  const draftProjectId = useRef('');
  const [prepared, setPrepared] = useState<Project | null>(null);
  const [quotedAmount, setQuotedAmount] = useState<number | null>(null);
  const [service, setService] = useState(
      plans.find((plan) => plan.name === 'طراحی مکانیک')?.name ||
        plans[0]?.name ||
        'طراحی مکانیک',
    ),
    [kind, setKind] = useState('مسکونی'),
    [manualArea, setManualArea] = useState(''),
    [analysisConfirmed, setAnalysisConfirmed] = useState(false),
    [questionStage, setQuestionStage] = useState<'basic' | 'analysis'>('basic'),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [note, setNote] = useState('');
  const manualAreaValue = Number(manualArea),
    hasValidManualArea =
      Number.isFinite(manualAreaValue) &&
      manualAreaValue > 0 &&
      manualAreaValue <= 100000,
    automaticAreaAllowed =
      analysis?.status === 'ready' ||
      (analysis?.status === 'confirm' && analysisConfirmed),
    area = automaticAreaAllowed
      ? analysis?.area || 0
      : hasValidManualArea
        ? manualAreaValue
        : 0,
    floors = analysis?.floors || 0;
  const urgency = 'عادی',
    deliverable = `تمام پلان‌های ${service}`;
  const gasAnswer = answers.gas || analysis?.inferredAnswers?.gas || '';
  const gasEnabled =
    Boolean(gasAnswer) &&
    !/(خیر|ندارد|نیست|بدون|none|no\b)/i.test(String(gasAnswer));
  const sourceQuestions = (analysis?.questions || []).filter(q => q.key !== 'gas_pressure' || gasEnabled);
  if (
    gasEnabled &&
    !sourceQuestions.some((question) => question.key === 'gas_pressure')
  )
    sourceQuestions.push(...(analysis?.conditionalQuestions || []).filter(q => q.key === 'gas_pressure'));
  const analysisQuestions: DesignQuestion[] = sourceQuestions
    .map((question): DesignQuestion => ({
      id: question.key,
      label: question.question,
      type:
        question.input_type === 'text' || question.input_type === 'number'
          ? question.input_type
          : 'select',
      options: question.options || [],
      group: 'ورودی‌های فنی موتور طراحی',
    }))
    .filter((question) => !analysis?.inferredAnswers?.[question.id]);
  const plan = plans.find((p) => p.name === service) || plans[0],
    base = Math.max(
      plan?.minimumPrice || 0,
      (plan?.pricePerM2 || plan?.price || 45000) * Math.max(area, 1),
    ),
    estimatedAmount =
      Math.round(
        (base *
          (kind === 'صنعتی' ? 1.35 : kind === 'تجاری' ? 1.2 : 1) *
          1) /
          1000,
      ) * 1000,
    amount = quotedAmount ?? estimatedAmount,
    wallet = user?.wallet || 0,
    enough = wallet >= amount;
  useEffect(() => {
    const token = sessionStorage.getItem('engi-handoff');
    if (!token) return;
    let cancelled = false;
    setBusy(true);
    customerRequest('claim', { token }).then(async row => {
      if (cancelled) return;
      const project = customerProject(row);
      setPrepared(project); draftProjectId.current = row.id;
      setTitle(row.title); setService(row.service); setAnswers(row.answers || {});
      setAnalysis(row.analysis); setQuestionStage('analysis');
      const claimedArea = Number(row.answers?.project_area_m2 || row.analysis?.area || 0);
      if (claimedArea > 0) {
        setManualArea(String(claimedArea)); setAnalysisConfirmed(true);
        const result = await customerRequest('quote', { engineProjectId: project.engineProjectId, area: claimedArea, answers: row.answers });
        if (cancelled) return;
        applyCustomerState(result); setPrepared(customerProject(result.project));
        setQuotedAmount(result.project.amount); setStep(3);
      } else { setQuestionStage('basic'); setStep(2); }
      // Retain the claim token for a refresh/retry; the server binds it to this account.
    }).catch(reason => {
      if (cancelled) return;
      if (reason instanceof DesignProjectRequestError && reason.payload.questions?.length) {
        const questions = reason.payload.questions;
        setAnalysis(current => current ? { ...current, questions } : current);
        setQuestionStage('analysis'); setStep(2);
      }
      setError(reason instanceof Error ? reason.message : 'انتقال پروژه انجام نشد.');
    })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, []);
  async function analyze() {
    if (!title.trim()) return setError('نام پروژه را وارد کنید.');
    if (
      !file ||
      !['zip', 'dxf'].includes(file.name.split('.').pop()?.toLowerCase() || '')
    )
      return setError('یک فایل ZIP یا DXF انتخاب کنید.');
    if (file.size > 50_000_000)
      return setError('حجم فایل باید کمتر از ۵۰ مگابایت باشد.');
    setError('');
    setProgress(0);
    setBusy(true);
    try {
      const saved = await uploadProjectFile(
        me,
        file,
        service === 'طراحی برق' ? 'electrical' : 'mechanical',
        kind,
        setProgress,
      );
      setUpload(saved);
      setAnalysis(saved.analysis);
      setPrepared(null); setQuotedAmount(null);
      sessionStorage.removeItem('engi-handoff');
      draftProjectId.current = '';
      setAnalysisConfirmed(false);
      await new Promise((r) => setTimeout(r, 350));
      setStep(2);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'آپلود یا تحلیل فایل انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  function continueToQuestions() {
    if (!automaticAreaAllowed && !hasValidManualArea)
      return setError(
        analysis?.status === 'confirm'
          ? 'ابتدا محاسبه را تأیید کنید یا متراژ صحیح را وارد کنید.'
          : 'لطفاً مساحت دقیق کل پروژه را وارد کنید.',
      );
    setAnswers(analysis?.inferredAnswers || {});
    setError('');
    setQuestionStage('analysis');
  }
  function price() {
    const missing = analysisQuestions.filter(
      (question) => !answers[question.id]?.trim(),
    );
    if (missing.length) {
      setError(
        `${missing.length.toLocaleString('fa-IR')} پاسخ باقی مانده است؛ موارد مشخص‌شده را تکمیل کنید.`,
      );
      requestAnimationFrame(() =>
        document
          .getElementById(`project-question-${missing[0].id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      );
      return;
    }
    setError('');
    void pay('prepare');
  }
  async function pay(method: 'wallet' | 'gateway' | 'prepare') {
    if (busy) return;
    if (method !== 'prepare') {
      if (!prepared?.engineProjectId || !prepared.quoteToken) return setError('قیمت نهایی را دوباره دریافت کنید.');
      setBusy(true); setError('');
      try {
        const result = await customerRequest('pay', { engineProjectId: prepared.engineProjectId, quoteToken: prepared.quoteToken, method });
        applyCustomerState(result);
        setStep(4);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'پرداخت انجام نشد.'); }
      finally { setBusy(false); }
      return;
    }
    const stamp = Date.now();
    if (!draftProjectId.current)
      draftProjectId.current = `PRJ-${crypto.randomUUID()}`;
    const projectId = draftProjectId.current;
    const projectAnswers = {
      kind,
      floors,
      city: answers.location || '',
      urgency,
      deliverable,
      areaSource:
        hasValidManualArea && !automaticAreaAllowed
          ? 'اعلام کاربر'
          : analysis?.method === 'closed-boundary'
            ? 'تحلیل هندسی تأییدشده'
            : 'مساحت صریح نقشه',
      analysisConfidence: analysis?.confidence || 0,
      questionnaireVersion: analysis?.questionnaireVersion || '5.1-single-source',
      ...answers,
    };
    const draft: Project = {
      id: projectId,
      owner: me,
      title: title.trim(),
      service,
      area,
      amount,
      status: 'در حال پردازش',
      progress: 0,
      date: 'امروز',
      fileKey: upload?.key,
      fileName: upload?.name,
      note,
      answers: projectAnswers,
    };
    setBusy(true);
    setError('');
    let connected: Project;
    try {
      connected = prepared?.engineProjectId
        ? prepared
        : await startDesignProjectWithRetry(draft);
      setPrepared(connected);
      const result = await customerRequest('quote', { engineProjectId: connected.engineProjectId, area, answers: projectAnswers });
      applyCustomerState(result);
      connected = customerProject(result.project);
      setPrepared(connected);
      setQuotedAmount(connected.amount);
    } catch (reason) {
      if (
        reason instanceof DesignProjectRequestError &&
        reason.payload.status === 'asking' &&
        reason.payload.questions?.length
      ) {
        const supplementary = reason.payload.questions;
        setAnalysis((current) =>
          current
            ? {
                ...current,
                questions: supplementary,
                inferredAnswers: {
                  ...current.inferredAnswers,
                  ...(reason.payload.inferred_answers || {}),
                },
              }
            : current,
        );
        setAnswers((current) => ({
          ...(reason.payload.inferred_answers || {}),
          ...current,
        }));
        setQuestionStage('analysis');
        setStep(2);
        setError(
          `${(reason.payload.question_count || supplementary.length).toLocaleString('fa-IR')} پرسش تکمیلی پیدا شد؛ پاسخ دهید و دوباره «تخمین قیمت» را بزنید.`,
        );
        requestAnimationFrame(() =>
          document
            .getElementById(`project-question-${supplementary[0].key}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        );
        setBusy(false);
        return;
      }
      setError(reason instanceof Error ? reason.message : 'شروع تولید خروجی انجام نشد.');
      setBusy(false);
      return;
    }
    setBusy(false);
    setStep(3);
  }
  const manualAreaPanel = analysis?.status !== 'ready' && (
    <div className="manual-area-card embedded-manual-area">
      {analysis?.status === 'confirm' && (
        <>
          <h3>تأیید محاسبه هندسی</h3>
          <p>
            سامانه مساحت کل را {analysis.area?.toLocaleString('fa-IR')} مترمربع
            محاسبه کرده است. پیش از قیمت‌گذاری، پلان‌ها و متراژ را بررسی و تأیید
            کنید.
          </p>
          <Button
            onClick={() => {
              setAnalysisConfirmed(true);
              setError('');
            }}
            disabled={analysisConfirmed}
          >
            {analysisConfirmed ? 'محاسبه تأیید شد' : 'تأیید محاسبه'}
          </Button>
        </>
      )}
      <label>
        مساحت کل پروژه چند مترمربع است؟
        <Input
          type="number"
          min="1"
          max="100000"
          step="0.01"
          value={manualArea}
          onChange={(e) => {
            setManualArea(e.target.value);
            setAnalysisConfirmed(false);
            setError('');
          }}
          placeholder="مثلاً ۱۰۷.۴"
        />
      </label>
      <p>
        لطفاً عدد دقیق را وارد کنید؛ در غیر این صورت ممکن است خروجی‌های دقیقی
        تحویل نگیرید و پروژه با مشکل مواجه شود.
      </p>
    </div>
  );
  return (
    <Shell admin={false}>
      <article className="new-project-flow">
        <Head
          title="پروژه جدید"
          text="فایل نقشه را بارگذاری کنید تا تحلیل، تکمیل اطلاعات و پرداخت انجام شود."
        />
        <nav className="project-steps">
          {['فایل پروژه', 'اطلاعات تکمیلی', 'قیمت و پرداخت', 'ثبت نهایی'].map(
            (x, i) => (
              <span key={x} className={step >= i + 1 ? 'active' : ''}>
                <i>{step > i + 1 ? <Check /> : i + 1}</i>
                {x}
              </span>
            ),
          )}
        </nav>
        {step === 1 && (
          <section className="card project-stage form">
            <div className="stage-title">
              <span>
                <small>مرحله اول</small>
                <h2>نام و فایل پروژه</h2>
              </span>
              <FileText />
            </div>
            <label>
              نام پروژه
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً پروژه مجتمع مسکونی گلستان"
              />
            </label>
            <div className="question-grid basic-questions">
              <label>
                نوع خدمت
                <select value={service} onChange={(e) => setService(e.target.value)}>
                  {plans.map((plan) => (
                    <option key={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </label>
              <label>
                کاربری پروژه
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option>مسکونی</option>
                  <option>تجاری</option>
                  <option>اداری</option>
                  <option>صنعتی</option>
                </select>
              </label>
            </div>
            <label
              className={`upload project-upload ${file ? 'has-file' : ''}`}
            >
              <Upload />
              <b>
                {file ? file.name : 'فایل پروژه را انتخاب یا اینجا رها کنید'}
              </b>
              <small>
                {file
                  ? `${(file.size / 1048576).toFixed(1)} مگابایت`
                  : 'ZIP یا DXF، حداکثر ۵۰ مگابایت'}
              </small>
              <input
                type="file"
                accept=".zip,.dxf,application/zip,application/x-zip,application/x-zip-compressed"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setError('');
                  setProgress(0);
                }}
              />
            </label>
            {error && <p className="flow-error">{error}</p>}
            <Button onClick={analyze} disabled={busy}>
              {busy
                ? `در حال آپلود — ${progress.toLocaleString('fa-IR')}٪`
                : 'شروع تحلیل پروژه'}
            </Button>
            {busy && (
              <div className="analysis-progress">
                <div>
                  <i style={{ width: `${progress}%` }} />
                </div>
                <span>
                  <b>{progress.toLocaleString('fa-IR')}٪</b> از فایل ارسال شده
                  است
                </span>
              </div>
            )}
          </section>
        )}
        {step === 2 && (
          <section className="card project-stage form">
            <div className="stage-title">
              <span>
                <small>
                  {analysis?.status === 'ready'
                    ? 'تحلیل معتبر فایل کامل شد'
                    : analysis?.status === 'confirm'
                      ? 'نیازمند تأیید کاربر'
                      : 'نیازمند اعلام متراژ یا بررسی کارشناس'}
                </small>
                <h2>
                  {questionStage === 'basic'
                    ? 'انتخاب خدمت و کاربری'
                    : 'پرسش‌های تحلیل پروژه'}
                </h2>
              </span>
              <Check />
            </div>
            {questionStage === 'basic' ? (
              <>
                <p className="analysis-intro">
                  خدمت «{service}» برای پروژه «{kind}» تحلیل شد. برای
                  تغییر این موارد به مرحله قبل برگردید.
                </p>
                <div
                  className={`detected-data ${analysis?.status !== 'ready' ? 'needs-review' : ''}`}
                >
                  <b>
                    اطلاعات استخراج‌شده از فایل{' '}
                    <em>
                      اطمینان {analysis?.confidence.toLocaleString('fa-IR')}٪
                    </em>
                  </b>
                  <span>
                    زیربنا:{' '}
                    {analysis?.area
                      ? `${analysis.area.toLocaleString('fa-IR')} مترمربع`
                      : 'نیازمند بررسی'}
                  </span>
                  <span>
                    طبقات:{' '}
                    {analysis?.floors?.toLocaleString('fa-IR') ||
                      'نیازمند بررسی'}
                  </span>
                  <span>واحد نقشه: {analysis?.unit || 'نامشخص'}</span>
                  <span>خروجی: تمام پلان‌های خدمت انتخابی</span>
                  {analysis?.floorAreas.map((floor) => (
                    <span key={`${floor.label}-${floor.area}`}>
                      {floor.label}: {floor.area.toLocaleString('fa-IR')}{' '}
                      مترمربع
                    </span>
                  ))}
                </div>
                {analysis?.checks?.map((check) => (
                  <p
                    className={
                      check.passed ? 'analysis-check passed' : 'analysis-check'
                    }
                    key={check.label}
                  >
                    {check.passed ? '✓' : '—'} {check.label}
                  </p>
                ))}
                {analysis?.warnings.map((warning) => (
                  <p className="analysis-warning" key={warning}>
                    {warning}
                  </p>
                ))}
                {manualAreaPanel}
                {error && <p className="flow-error">{error}</p>}
                <div className="stage-actions">
                  <Button className="secondary" onClick={() => setStep(1)}>
                    بازگشت
                  </Button>
                  <Button
                    onClick={continueToQuestions}
                    disabled={!automaticAreaAllowed && !hasValidManualArea}
                  >
                    ادامه
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="analysis-intro">
                  اطلاعات قابل اتکا از نقشه به‌صورت خودکار ثبت شده‌اند؛ فقط به
                  موارد نامشخص یا تصمیم‌های طراحی «{service}» پاسخ دهید.
                </p>
                <div className="analysis-question-list">
                  {analysisQuestions.map((question, index) => (
                    <label
                      key={question.id}
                      id={`project-question-${question.id}`}
                      className={
                        error && !answers[question.id]?.trim()
                          ? 'question-missing'
                          : undefined
                      }
                    >
                      <span>
                        <i>{(index + 1).toLocaleString('fa-IR')}</i>
                        <b className="question-copy">
                          <small>{question.group}</small>
                          {question.label}
                        </b>
                      </span>
                      <span className="question-control">
                        {question.type === 'select' ? (
                          <select
                            value={answers[question.id] || ''}
                            aria-invalid={
                              Boolean(error && !answers[question.id]?.trim())
                            }
                            onChange={(e) =>
                              setAnswers({
                                ...answers,
                                [question.id]: e.target.value,
                              })
                            }
                          >
                            <option value="">انتخاب کنید</option>
                            {question.options?.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={
                              question.type === 'number' ? 'number' : 'text'
                            }
                            min={
                              question.type === 'number' ? '0.01' : undefined
                            }
                            step={
                              question.type === 'number' ? '0.01' : undefined
                            }
                            value={answers[question.id] || ''}
                            aria-invalid={
                              Boolean(error && !answers[question.id]?.trim())
                            }
                            onChange={(e) =>
                              setAnswers({
                                ...answers,
                                [question.id]: e.target.value,
                              })
                            }
                            placeholder={question.placeholder}
                          />
                        )}
                        {question.unit && <small>{question.unit}</small>}
                      </span>
                    </label>
                  ))}
                </div>
                <label>
                  توضیحات تکمیلی (اختیاری)
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="اگر نکته یا محدودیت دیگری وجود دارد بنویسید."
                  />
                </label>
                {error && <p className="flow-error">{error}</p>}
                <div className="stage-actions">
                  <Button
                    className="secondary"
                    onClick={() => {
                      setQuestionStage('basic');
                      setError('');
                    }}
                  >
                    بازگشت
                  </Button>
                  <Button onClick={price} disabled={busy} aria-busy={busy}>
                    {busy ? 'در حال محاسبه قیمت…' : 'تخمین قیمت'}
                  </Button>
                </div>
              </>
            )}
          </section>
        )}
        {step === 3 && (
          <div className="payment-layout">
            <section className="card project-stage payment-card">
              <div className="stage-title">
                <span>
                  <small>مرحله نهایی</small>
                  <h2>انتخاب روش پرداخت</h2>
                </span>
                <CreditCard />
              </div>
              <button
                className="pay-option"
                disabled={busy}
                onClick={() => pay('gateway')}
              >
                <CreditCard />
                <span>
                  <b>پرداخت از درگاه بانکی</b>
                  <small>فعلاً آزمایشی — بدون برداشت بانکی</small>
                </span>
              </button>
              <button
                className="pay-option"
                disabled={!enough || busy}
                onClick={() => pay('wallet')}
              >
                <Wallet />
                <span>
                  <b>پرداخت از کیف پول</b>
                  <small>موجودی فعلی: {money(wallet)}</small>
                </span>
              </button>
              {!enough && (
                <p className="insufficient">
                  موجودی کیف پول کافی نیست؛ ابتدا موجودی را افزایش دهید یا از
                  درگاه بانکی پرداخت کنید.
                </p>
              )}
              {busy && (
                <p className="engine-connecting">
                  در حال اتصال امن پروژه به موتور تولید…
                </p>
              )}
              {error && <p className="flow-error">{error}</p>}
              <Button className="secondary" onClick={() => setStep(2)}>
                ویرایش اطلاعات
              </Button>
            </section>
            <aside className="card invoice price-summary">
              <h2>خلاصه سفارش</h2>
              <p>
                <span>پروژه</span>
                <b>{title}</b>
              </p>
              <p>
                <span>خدمت</span>
                <b>{service}</b>
              </p>
              <p>
                <span>زیربنا</span>
                <b>{area.toLocaleString('fa-IR')} مترمربع</b>
              </p>
              <p>
                <span>زمان‌بندی</span>
                <b>{urgency}</b>
              </p>
              <hr />
              <small>قیمت نهایی پروژه</small>
              <strong>{money(amount)}</strong>
            </aside>
          </div>
        )}
        {step === 4 && (
          <section className="card project-complete">
            <Check />
            <h2>پروژه با موفقیت ثبت شد</h2>
            <p>پروژه در فهرست پروژه‌های شما و پنل ادمین قابل مشاهده است.</p>
            <Button onClick={() => navigatePath('/panel/projects')}>
              مشاهده پروژه‌های من
            </Button>
          </section>
        )}
      </article>
    </Shell>
  );
}

function LegacyNewProject({
  data,
  update,
}: {
  data: Store;
  update: (f: (s: Store) => Store) => void;
}) {
  let plans = data.plans.filter((p) => p.enabled),
    [title, setTitle] = useState(''),
    [service, setService] = useState(plans[0]?.name || ''),
    [area, setArea] = useState(100),
    [done, setDone] = useState(false),
    plan = plans.find((p) => p.name === service),
    amount = plan
      ? Math.max(
          plan.minimumPrice || 0,
          (plan.pricePerM2 || plan.price || 0) * area,
        )
      : 0;
  function save() {
    if (!title) return;
    update((s) => ({
      ...s,
      projects: [
        {
          id: `PRJ-${8905 + s.projects.length}`,
          owner: me,
          title,
          service,
          area,
          amount,
          status: 'در حال بررسی',
          progress: 10,
          date: 'امروز',
        },
        ...s.projects,
      ],
    }));
    setDone(true);
  }
  return (
    <Shell admin={false}>
      <article>
        <Head
          title="ثبت پروژه جدید"
          text="اطلاعات اولیه را وارد کنید؛ تیم مهندسی پس از بررسی با شما تماس می‌گیرد."
        />
        <div className="formgrid">
          <section className="card form">
            <h2>اطلاعات پروژه</h2>
            <label>
              عنوان پروژه
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً ساختمان اداری ونک"
              />
            </label>
            <label>
              نوع خدمت
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              زیربنای تقریبی
              <Input
                type="number"
                value={area}
                onChange={(e) => setArea(+e.target.value)}
              />
            </label>
            <label className="upload">
              <Upload />
              <b>فایل‌های نقشه را اینجا رها کنید</b>
              <small>PDF، DWG یا ZIP</small>
              <input type="file" />
            </label>
            <Button onClick={save}>
              <Check />
              ثبت و ارسال برای بررسی
            </Button>
            {done && (
              <div className="success">
                <Check />
                <b>پروژه ثبت شد و اکنون در پنل ادمین دیده می‌شود.</b>
              </div>
            )}
          </section>
          <aside className="card invoice">
            <h2>برآورد هزینه</h2>
            <p>
              <span>خدمت</span>
              <b>{service}</b>
            </p>
            <p>
              <span>مبنای محاسبه</span>
              <b>بیشترینِ حداقل قیمت یا قیمت متری</b>
            </p>
            <p>
              <span>حداقل قیمت</span>
              <b>{money(plan?.minimumPrice || 0)}</b>
            </p>
            <p>
              <span>تعرفه هر مترمربع</span>
              <b>{money(plan?.pricePerM2 || plan?.price || 0)}</b>
            </p>
            <hr />
            <strong>{money(amount)}</strong>
            <small>مبلغ نهایی پس از بررسی فایل‌ها اعلام می‌شود.</small>
          </aside>
        </div>
      </article>
    </Shell>
  );
}
function WalletPage({ data }: { data: Store }) {
  let tx = data.tx.filter((t) => t.owner === me);
  return (
    <Shell admin={false}>
      <article>
        <Head
          title="تراکنش‌ها"
          text="تمام ورودی‌ها و خروجی‌های کیف پول شما همراه با شناسه قابل پیگیری است."
        />
        <section className="card">
          <div className="table transaction-table">
            <table>
              <thead>
                <tr>
                  <th>شناسه تراکنش</th>
                  <th>نوع</th>
                  <th>شرح</th>
                  <th>پروژه مرتبط</th>
                  <th>مبلغ</th>
                  <th>تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {tx.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <code>{t.id}</code>
                    </td>
                    <td>
                      <span className={'flow ' + (t.amount > 0 ? 'in' : 'out')}>
                        {t.amount > 0 ? 'ورودی' : 'خروجی'}
                      </span>
                    </td>
                    <td>
                      <b>{t.title}</b>
                      {t.status === 'آزمایشی' && <small>آزمایشی — برداشت بانکی انجام نشده</small>}
                    </td>
                    <td>
                      {t.amount < 0 ? (
                        <code>{t.project}</code>
                      ) : (
                        <span className="muted">واریز مستقیم</span>
                      )}
                    </td>
                    <td className={t.amount > 0 ? 'green' : 'debit'}>
                      {t.amount > 0 ? '+' : '−'} {money(t.amount)}
                    </td>
                    <td>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </Shell>
  );
}
function UsersPage({ data, update }: { data: Store; update: StoreUpdate }) {
  const [editing, setEditing] = useState<User | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const rows = useMemo(
    () =>
      data.users.filter((user) => {
        const matchesText = [user.id, user.name, user.email, user.mobile]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStatus =
          status === 'all' ||
          (status === 'active' ? user.active : !user.active);
        return matchesText && matchesStatus;
      }),
    [data.users, query, status],
  );
  return (
    <Shell admin>
      <article>
        <Head
          title="Users"
          text="Manage accounts, balances and administrative access."
        />
        <section className="card">
          <AdminToolbar
            query={query}
            onQuery={setQuery}
            status={status}
            onStatus={setStatus}
            statusOptions={[
              ['all', 'All statuses'],
              ['active', 'Active'],
              ['suspended', 'Suspended'],
            ]}
            filename="engitools-users.csv"
            headers={[
              'User ID',
              'Full Name',
              'Email',
              'Phone',
              'Status',
              'Wallet',
            ]}
            rows={rows.map((user) => [
              user.id,
              user.name,
              user.email,
              user.mobile,
              user.active ? 'Active' : 'Suspended',
              user.wallet,
            ])}
          />
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>USER ID</th>
                  <th>FULL NAME</th>
                  <th>EMAIL</th>
                  <th>PHONE</th>
                  <th>STATUS</th>
                  <th>PROJECTS</th>
                  <th>WALLET</th>
                  <th>TOTAL SPEND</th>
                  <th>LAST ACTIVITY</th>
                  <th>CREATED AT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigatePath(`/admin/users/${u.id}`)}
                  >
                    <td>
                      <code>{u.id}</code>
                    </td>
                    <td>
                      <b>{en(u.name)}</b>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.mobile}</td>
                    <td>
                      <Tag s={u.active ? 'Active' : 'Suspended'} />
                    </td>
                    <td>
                      {data.projects.filter((p) => p.owner === u.id).length}
                    </td>
                    <td>{u.wallet.toLocaleString('en-US')} TOMAN</td>
                    <td>
                      {data.tx
                        .filter((t) => t.owner === u.id && t.amount < 0 && t.status !== 'آزمایشی')
                        .reduce((s, t) => s + Math.abs(t.amount), 0)
                        .toLocaleString('en-US')}{' '}
                      TOMAN
                    </td>
                    <td>2 min ago</td>
                    <td>Aug 15, 2024</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <RowActions
                        onShow={() => navigatePath(`/admin/users/${u.id}`)}
                        onEdit={() => setEditing(u)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              Showing {rows.length ? 1 : 0}–{rows.length} of {rows.length}
            </span>
            <div>
              <button disabled>Previous</button>
              <button disabled>Next</button>
            </div>
          </div>
        </section>
        <EditRecordDialog
          kind="user"
          record={editing}
          onClose={() => setEditing(null)}
          update={update}
        />
      </article>
    </Shell>
  );
}
function Toolbar({ admin = false }: { admin?: boolean }) {
  return (
    <div className="toolbar actions-only">
      <Button variant="outline">
        {admin ? 'Filter & export' : 'فیلتر و گزارش'}
      </Button>
    </div>
  );
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const escape = (value: string | number) =>
    `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv =
    '\ufeff' +
    [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AdminToolbar({
  query,
  onQuery,
  status,
  onStatus,
  statusOptions,
  filename,
  headers,
  rows,
}: {
  query: string;
  onQuery: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  statusOptions: Array<[string, string]>;
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="toolbar admin-data-toolbar">
        <Button
          variant="outline"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <SlidersHorizontal /> Filters
        </Button>
        <Button onClick={() => downloadCsv(filename, headers, rows)}>
          <Download /> Export CSV
        </Button>
      </div>
      {open && (
        <div className="filter-panel">
          <label>
            <span>Search</span>
            <Input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="ID, name or title…"
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => onStatus(event.target.value)}
            >
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            onClick={() => {
              onQuery('');
              onStatus('all');
            }}
          >
            Clear filters
          </Button>
          <small>
            {rows.length} matching record{rows.length === 1 ? '' : 's'}
          </small>
        </div>
      )}
    </>
  );
}

function RowActions({
  onShow,
  onEdit,
}: {
  onShow: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="row-actions">
      <button type="button" onClick={onShow}>
        Show
      </button>
      <button type="button" onClick={onEdit}>
        <Pencil /> Edit
      </button>
    </div>
  );
}

function EditRecordDialog({
  kind,
  record,
  onClose,
  update,
}: {
  kind: 'user' | 'project' | 'transaction';
  record: User | Project | Tx | null;
  onClose: () => void;
  update: StoreUpdate;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!record) return;
    if (kind === 'transaction' && (record as Tx).owner?.startsWith('CUST-')) {
      window.alert('تراکنش ثبت‌شده قابل تغییر نیست؛ برای اصلاح، از تغییر موجودی همراه با دلیل استفاده کنید.');
      return;
    }
    const values: Record<string, string> = {};
    Object.entries(record).forEach(
      ([key, value]) => (values[key] = String(value ?? '')),
    );
    setDraft(values);
  }, [record]);
  const field = (name: string, label: string, type = 'text') => (
    <label>
      <span>{label}</span>
      <Input
        type={type}
        value={draft[name] || ''}
        onChange={(event) => setDraft({ ...draft, [name]: event.target.value })}
      />
    </label>
  );
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!record) return;
    if (kind === 'user')
      update((store) => ({
        ...store,
        users: store.users.map((item) =>
          item.id === record.id
            ? {
                ...item,
                name: draft.name,
                mobile: draft.mobile,
                email: draft.email,
                province: draft.province,
                city: draft.city,
                note: draft.note,
                active: draft.active === 'true',
                admin: draft.admin === 'true',
              }
            : item,
        ),
      }));
    if (kind === 'project')
      update((store) => ({
        ...store,
        projects: store.projects.map((item) =>
          item.id === record.id
            ? {
                ...item,
                title: draft.title,
                service: draft.service,
                status: draft.status as Status,
                progress: Math.min(100, Math.max(0, Number(draft.progress))),
                amount: Math.max(0, Number(draft.amount)),
                assignee: draft.assignee,
                startDate: draft.startDate,
                dueDate: draft.dueDate,
                note: draft.note,
              }
            : item,
        ),
      }));
    if (kind === 'transaction')
      update((store) => ({
        ...store,
        tx: store.tx.map((item) =>
          item.id === record.id
            ? {
                ...item,
                status: draft.status,
                gatewayRef: draft.gatewayRef,
                title: draft.title,
                category: draft.category,
                note: draft.note,
              }
            : item,
        ),
      }));
    onClose();
  }
  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="modal edit-record-modal">
        <DialogHeader>
          <DialogTitle>Edit {kind}</DialogTitle>
          <DialogDescription>
            Only operational fields can be changed. IDs and financial ownership
            remain locked.
          </DialogDescription>
        </DialogHeader>
        {record && (
          <form className="edit-record-form" onSubmit={save}>
            <div className="locked-field">
              <span>{kind.toUpperCase()} ID</span>
              <code>{record.id}</code>
            </div>
            {kind === 'user' && (
              <>
                <div className="locked-field">
                  <span>Wallet balance (locked)</span>
                  <b>{Number(draft.wallet).toLocaleString('en-US')} TOMAN</b>
                </div>
                {field('name', 'Full name')}
                {field('mobile', 'Mobile number')}
                {field('email', 'Email', 'email')}
                {field('province', 'Province')}
                {field('city', 'City')}
                <label>
                  <span>Account status</span>
                  <select
                    value={draft.active || 'true'}
                    onChange={(e) =>
                      setDraft({ ...draft, active: e.target.value })
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Suspended</option>
                  </select>
                </label>
                <label>
                  <span>Role</span>
                  <select
                    value={draft.admin || 'false'}
                    onChange={(e) =>
                      setDraft({ ...draft, admin: e.target.value })
                    }
                  >
                    <option value="false">User</option>
                    <option value="true">Administrator</option>
                  </select>
                </label>
                {field('note', 'Internal note')}
              </>
            )}
            {kind === 'project' && (
              <>
                <div className="locked-field">
                  <span>Owner User ID (locked)</span>
                  <code>{draft.owner}</code>
                </div>
                {field('title', 'Project title')}
                {field('service', 'Service')}
                <label>
                  <span>Status</span>
                  <select
                    value={draft.status || 'در حال بررسی'}
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value })
                    }
                  >
                    {[
                      'در حال بررسی',
                      'در حال پردازش',
                      'نیازمند اصلاح',
                      'تکمیل شده',
                    ].map((x) => (
                      <option key={x} value={x}>
                        {en(x)}
                      </option>
                    ))}
                  </select>
                </label>
                {field('progress', 'Progress (%)', 'number')}
                {field('assignee', 'Assigned expert')}
                {field('amount', 'Agreed amount', 'number')}
                {field('startDate', 'Start date', 'date')}
                {field('dueDate', 'Due date', 'date')}
                {field('note', 'Internal note')}
              </>
            )}
            {kind === 'transaction' && (
              <>
                <div className="locked-field">
                  <span>User ID (locked)</span>
                  <code>{draft.owner}</code>
                </div>
                <div className="locked-field">
                  <span>Project ID (locked)</span>
                  <code>{draft.project || 'Direct wallet top-up'}</code>
                </div>
                <div className="locked-field">
                  <span>Amount (locked)</span>
                  <b>
                    {Math.abs(Number(draft.amount)).toLocaleString('en-US')}{' '}
                    TOMAN
                  </b>
                </div>
                <label>
                  <span>Status</span>
                  <select
                    value={draft.status || 'Completed'}
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value })
                    }
                  >
                    <option>Completed</option>
                    <option>Pending review</option>
                    <option>Failed</option>
                    <option>Refunded</option>
                  </select>
                </label>
                {field('gatewayRef', 'Gateway reference')}
                {field('title', 'Description')}
                {field('category', 'Category')}
                {field('note', 'Internal note')}
              </>
            )}
            <footer>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </footer>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
function AdminProjects({ data, update }: { data: Store; update: StoreUpdate }) {
  const [editing, setEditing] = useState<Project | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const rows = useMemo(
    () =>
      data.projects.filter(
        (project) =>
          [project.id, project.title, project.service, project.owner]
            .join(' ')
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (status === 'all' || project.status === status),
      ),
    [data.projects, query, status],
  );
  return (
    <Shell admin>
      <article>
        <Head
          title="Projects"
          text="Review customer requests and update delivery progress."
        />
        <section className="card">
          <AdminToolbar
            query={query}
            onQuery={setQuery}
            status={status}
            onStatus={setStatus}
            statusOptions={[
              ['all', 'All statuses'],
              ['در حال بررسی', 'Under review'],
              ['در حال پردازش', 'Processing'],
              ['نیازمند اصلاح', 'Needs revision'],
              ['تکمیل شده', 'Completed'],
            ]}
            filename="engitools-projects.csv"
            headers={[
              'Project ID',
              'Owner ID',
              'Title',
              'Service',
              'Amount',
              'Status',
              'Progress',
            ]}
            rows={rows.map((project) => [
              project.id,
              project.owner,
              project.title,
              project.service,
              project.amount,
              en(project.status),
              project.progress,
            ])}
          />
          <Projects
            data={{ ...data, projects: rows }}
            on={(p) => navigatePath(`/admin/projects/${p.id}`)}
            onEdit={setEditing}
          />
        </section>
        <EditRecordDialog
          kind="project"
          record={editing}
          onClose={() => setEditing(null)}
          update={update}
        />
      </article>
    </Shell>
  );
}
function Transactions({ data, update }: { data: Store; update: StoreUpdate }) {
  const [editing, setEditing] = useState<Tx | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const rows = useMemo(
    () =>
      data.tx.filter(
        (transaction) =>
          [
            transaction.id,
            transaction.owner,
            transaction.project,
            transaction.title,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (status === 'all' ||
            (status === 'incoming'
              ? transaction.amount > 0
              : transaction.amount < 0)),
      ),
    [data.tx, query, status],
  );
  return (
    <Shell admin>
      <article>
        <Head
          title="Transactions"
          text="Monitor wallet charges and project payments."
        />
        <section className="card">
          <AdminToolbar
            query={query}
            onQuery={setQuery}
            status={status}
            onStatus={setStatus}
            statusOptions={[
              ['all', 'All transaction types'],
              ['incoming', 'Wallet Top-Up'],
              ['outgoing', 'Project Payment'],
            ]}
            filename="engitools-transactions.csv"
            headers={[
              'Transaction ID',
              'User ID',
              'Project ID',
              'Description',
              'Type',
              'Status',
              'Amount',
              'Date',
            ]}
            rows={rows.map((transaction) => [
              transaction.id,
              transaction.owner,
              transaction.project,
              transaction.title,
              transaction.amount > 0 ? 'Wallet Top-Up' : 'Project Payment',
              transaction.status || 'Completed',
              transaction.amount,
              transaction.date,
            ])}
          />
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>TRANSACTION ID</th>
                  <th>DATE & TIME</th>
                  <th>USER</th>
                  <th>USER ID</th>
                  <th>PROJECT</th>
                  <th>PROJECT ID</th>
                  <th>SERVICE</th>
                  <th>TYPE</th>
                  <th>STATUS</th>
                  <th>AMOUNT</th>
                  <th>METHOD</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  let p = data.projects.find((p) => p.id === t.project);
                  return (
                    <tr
                      key={t.id}
                      onClick={() =>
                        navigatePath(`/admin/transactions/${t.id}`)
                      }
                    >
                      <td>
                        <code>{t.id}</code>
                      </td>
                      <td>Aug 30, 2026 · 10:44</td>
                      <td>
                        {en(
                          data.users.find((u) => u.id === t.owner)?.name || '',
                        )}
                      </td>
                      <td>
                        <code>{t.owner}</code>
                      </td>
                      <td>{p ? en(p.title) : '—'}</td>
                      <td>
                        <code>{t.project}</code>
                      </td>
                      <td>{p ? en(p.service) : 'Wallet'}</td>
                      <td>
                        {t.amount > 0 ? 'Wallet Top-Up' : 'Project Payment'}
                      </td>
                      <td>
                        <Tag s={t.status || 'Completed'} />
                      </td>
                      <td>
                        {Math.abs(t.amount).toLocaleString('en-US')} TOMAN
                      </td>
                      <td>{t.status === 'آزمایشی' ? 'Simulation (no bank charge)' : t.category === 'admin_adjustment' ? 'Administrator' : 'Wallet'}</td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <RowActions
                          onShow={() =>
                            navigatePath(`/admin/transactions/${t.id}`)
                          }
                          onEdit={() => setEditing(t)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <EditRecordDialog
          kind="transaction"
          record={editing}
          onClose={() => setEditing(null)}
          update={update}
        />
      </article>
    </Shell>
  );
}
function Pricing({
  data,
  update,
}: {
  data: Store;
  update: (f: (s: Store) => Store) => void;
}) {
  const [savedPlan, setSavedPlan] = useState('');
  const changePlan = (id: string, changes: Partial<Plan>) =>
    update((store) => ({
      ...store,
      plans: store.plans.map((plan) =>
        plan.id === id ? { ...plan, ...changes } : plan,
      ),
    }));
  return (
    <Shell admin>
      <article>
        <Head
          title="Service Pricing"
          text="Control pricing and service availability for customers."
        />
        <div className="prices">
          {data.plans.map((p) => (
            <section
              className={'price ' + (!p.enabled ? 'off' : '')}
              key={p.id}
            >
              <div>
                <Building2 />
                <Switch
                  checked={p.enabled}
                  onCheckedChange={() =>
                    changePlan(p.id, { enabled: !p.enabled })
                  }
                />
              </div>
              <small>{p.id}</small>
              <h2>{en(p.name)}</h2>
              <p>
                {p.id === 'PLN-104'
                  ? 'Phase one and two architecture design'
                  : p.id === 'PLN-103'
                    ? 'Mechanical systems and calculations'
                    : p.id === 'PLN-102'
                      ? 'Electrical systems and calculations'
                      : 'Automated AI plan data extraction'}
              </p>
              <div className="pricing-inputs">
                <label>
                  <span>Minimum project price</span>
                  <span className="pricing-money-input">
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      value={p.minimumPrice}
                      onChange={(event) =>
                        changePlan(p.id, {
                          minimumPrice: Math.max(0, Number(event.target.value)),
                        })
                      }
                    />
                    <small>TOMAN</small>
                  </span>
                </label>
                <label>
                  <span>Price per square meter</span>
                  <span className="pricing-money-input">
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      value={p.pricePerM2}
                      onChange={(event) =>
                        changePlan(p.id, {
                          pricePerM2: Math.max(0, Number(event.target.value)),
                          price: Math.max(0, Number(event.target.value)),
                        })
                      }
                    />
                    <small>TOMAN / m²</small>
                  </span>
                </label>
              </div>
              <div className="pricing-preview">
                <span>Example · 500 m² project</span>
                <b>
                  {Math.max(p.minimumPrice, p.pricePerM2 * 500).toLocaleString(
                    'en-US',
                  )}{' '}
                  TOMAN
                </b>
              </div>
              <Button
                className="pricing-save"
                onClick={() => {
                  setSavedPlan(p.id);
                  window.setTimeout(() => setSavedPlan(''), 1800);
                }}
              >
                <Check /> {savedPlan === p.id ? 'Saved' : 'Save pricing'}
              </Button>
              <footer>
                <Tag s={p.enabled ? 'Active' : 'Pricing OFF · Free'} />
                <a
                  href={`/admin/pricing/${p.id}`}
                  onClick={(e) => navigate(e, `/admin/pricing/${p.id}`)}
                >
                  View plan →
                </a>
              </footer>
            </section>
          ))}
        </div>
        <div className="sync">
          <CircleDollarSign />
          <span>
            <b>Connected to customer panel</b>
            <small>
              Prices and availability are applied directly to new project
              requests.
            </small>
          </span>
        </div>
      </article>
    </Shell>
  );
}
function AdminDetail({
  kind,
  id,
  data,
  update,
}: {
  kind: string;
  id: string;
  data: Store;
  update: StoreUpdate;
}) {
  const [editing, setEditing] = useState<User | Project | Tx | null>(null);
  const tabLabels =
    kind === 'users'
      ? [
          'Overview',
          'Personal Information',
          'Projects',
          'Transactions',
          'Wallet',
          'Invoices & Receipts',
          'Activity Log',
        ]
      : kind === 'projects'
        ? [
            'Overview',
            'Uploaded Files',
            'Generated Files',
            'Project Information',
            'Timeline / Activity',
          ]
        : kind === 'transactions'
          ? [
              'Transaction Information',
              'Payment Information',
              'Amount Breakdown',
              'Status History',
            ]
          : ['Overview', 'Pricing Tiers', 'Pricing History'];
  const [activeTab, setActiveTab] = useState(tabLabels[0]);
  useEffect(() => setActiveTab(tabLabels[0]), [kind, id]);
  let user = data.users.find((u) => u.id === id),
    project = data.projects.find((p) => p.id === id),
    tx = data.tx.find((t) => t.id === id),
    plan = data.plans.find((p) => p.id === id);
  const related = useMemo(() => {
    if (!user) return { projects: [], transactions: [], spent: 0 };
    const projects = data.projects.filter((item) => item.owner === user.id);
    const transactions = data.tx.filter((item) => item.owner === user.id);
    return {
      projects,
      transactions,
      spent: transactions
        .filter((item) => item.amount < 0 && item.status !== 'آزمایشی')
        .reduce((sum, item) => sum + Math.abs(item.amount), 0),
    };
  }, [data.projects, data.tx, user]);
  let title = user
    ? en(user.name)
    : project
      ? en(project.title)
      : tx
        ? tx.id
        : plan
          ? en(plan.name)
          : 'Record not found';
  let subtitle = user
    ? `User ID: ${user.id}`
    : project
      ? `Project ID: ${project.id}`
      : tx
        ? `Transaction ID: ${tx.id}`
        : plan
          ? `Plan ID: ${plan.id}`
          : '';
  function impersonate() {
    if (!user) return;
    sessionStorage.setItem('engi-impersonate', user.id);
    sessionStorage.setItem('engi-impersonate-name', en(user.name));
    location.href = '/panel/projects';
  }
  return (
    <Shell admin>
      <article>
        <div className="detail-head">
          <a
            href={`/admin/${kind}`}
            onClick={(e) => navigate(e, `/admin/${kind}`)}
          >
            ← Back to {kind}
          </a>
          <div>
            <small>{subtitle}</small>
            <h1>{title}</h1>
            <p>{user?.email || project?.service || tx?.date || plan?.unit}</p>
          </div>
          <div className="detail-actions">
            {user && (
              <Button onClick={impersonate}>
                <ShieldCheck />
                Secure account view
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setEditing(user || project || tx || null)}
              disabled={!user && !project && !tx}
            >
              <Pencil />
              Edit
            </Button>
          </div>
        </div>
        {user && (
          <>
            <div className="metrics">
              <div className="metric">
                <Wallet />
                <b>{user.wallet.toLocaleString('en-US')} TOMAN</b>
                <span>Wallet Balance</span>
              </div>
              <div className="metric">
                <CreditCard />
                <b>{related.spent.toLocaleString('en-US')} TOMAN</b>
                <span>Total Spent</span>
              </div>
              <div className="metric">
                <FolderKanban />
                <b>{related.projects.length}</b>
                <span>Total Projects</span>
              </div>
              <div className="metric">
                <FileText />
                <b>{related.transactions.length}</b>
                <span>Total Transactions</span>
              </div>
            </div>
            <DetailTabs
              labels={tabLabels}
              active={activeTab}
              onChange={setActiveTab}
            />
            <UserTabContent tab={activeTab} user={user} data={data} />
            {activeTab === 'Wallet' && user.id.startsWith('CUST-') && <WalletAdjustment userId={user.id} />}
          </>
        )}
        {project && (
          <>
            <DetailTabs
              labels={tabLabels}
              active={activeTab}
              onChange={setActiveTab}
            />
            <ProjectTabContent tab={activeTab} project={project} data={data} />
          </>
        )}
        {tx && (
          <>
            <DetailTabs
              labels={tabLabels}
              active={activeTab}
              onChange={setActiveTab}
            />
            <TransactionTabContent tab={activeTab} tx={tx} />
          </>
        )}
        {plan && (
          <>
            <DetailTabs
              labels={tabLabels}
              active={activeTab}
              onChange={setActiveTab}
            />
            <PlanTabContent tab={activeTab} plan={plan} />
          </>
        )}
        <EditRecordDialog
          kind={user ? 'user' : project ? 'project' : 'transaction'}
          record={editing}
          onClose={() => setEditing(null)}
          update={update}
        />
      </article>
    </Shell>
  );
}
function DetailEmpty({ title, text }: { title: string; text: string }) {
  return (
    <section className="detail-empty">
      <FileText />
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  );
}

function UserTabContent({
  tab,
  user,
  data,
}: {
  tab: string;
  user: User;
  data: Store;
}) {
  const projects = data.projects.filter((project) => project.owner === user.id);
  const transactions = data.tx.filter((item) => item.owner === user.id);
  if (tab === 'Personal Information')
    return (
      <section className="detail-grid">
        <KV l="Full Name" v={user.name || 'Not provided'} />
        <KV l="Mobile Number" v={user.mobile} />
        <KV l="Email" v={user.email || 'Not provided'} />
        <KV l="Province" v={user.province || 'Not provided'} />
        <KV l="City" v={user.city || 'Not provided'} />
        <KV l="Role" v={user.admin ? 'Administrator' : 'User'} />
      </section>
    );
  if (tab === 'Projects')
    return projects.length ? (
      <section className="card detail-table">
        <Projects
          data={{ ...data, projects }}
          on={(project) => navigatePath(`/admin/projects/${project.id}`)}
        />
      </section>
    ) : (
      <DetailEmpty
        title="No projects yet"
        text="Projects created by this user will appear here."
      />
    );
  if (tab === 'Transactions')
    return transactions.length ? (
      <section className="card detail-table">
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>TRANSACTION ID</th>
                <th>TYPE</th>
                <th>PROJECT ID</th>
                <th>AMOUNT</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => navigatePath(`/admin/transactions/${item.id}`)}
                >
                  <td>
                    <code>{item.id}</code>
                  </td>
                  <td>
                    {item.amount > 0 ? 'Wallet Top-Up' : 'Project Payment'}
                  </td>
                  <td>
                    <code>{item.project}</code>
                  </td>
                  <td>{money(item.amount)}</td>
                  <td>{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ) : (
      <DetailEmpty
        title="No transactions yet"
        text="Wallet and project transactions will appear here."
      />
    );
  if (tab === 'Wallet') {
    const incoming = transactions
      .filter((item) => item.amount > 0)
      .reduce((sum, item) => sum + item.amount, 0);
    const outgoing = transactions
      .filter((item) => item.amount < 0 && item.category !== 'demo_payment')
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    return (
      <section className="detail-grid">
        <KV
          l="Current Balance"
          v={`${user.wallet.toLocaleString('en-US')} TOMAN`}
        />
        <KV
          l="Total Incoming"
          v={`${incoming.toLocaleString('en-US')} TOMAN`}
        />
        <KV
          l="Total Outgoing"
          v={`${outgoing.toLocaleString('en-US')} TOMAN`}
        />
        <KV l="Ledger Entries" v={transactions.length} />
      </section>
    );
  }
  if (tab === 'Invoices & Receipts')
    return (
      <DetailEmpty
        title="No invoices or receipts"
        text="Generated financial documents will appear here."
      />
    );
  if (tab === 'Activity Log')
    return (
      <DetailEmpty
        title="No recorded activity"
        text="Audited account events will appear here."
      />
    );
  return (
    <section className="detail-grid">
      <KV l="User ID" v={user.id} />
      <KV l="Role" v={user.admin ? 'Administrator' : 'User'} />
      <KV l="Status" v={user.active ? 'Active' : 'Suspended'} />
      <KV l="Mobile Number" v={user.mobile} />
      <KV l="Projects" v={projects.length} />
      <KV l="Transactions" v={transactions.length} />
    </section>
  );
}

function ProjectTabContent({
  tab,
  project,
  data,
}: {
  tab: string;
  project: Project;
  data: Store;
}) {
  if (tab === 'Uploaded Files')
    return (
      <DetailEmpty
        title="No uploaded files"
        text="Customer uploads for this project will appear here."
      />
    );
  if (tab === 'Generated Files')
    return (
      <DetailEmpty
        title="No generated files"
        text="Delivered engineering files will appear here."
      />
    );
  if (tab === 'Timeline / Activity')
    return (
      <DetailEmpty
        title="No timeline events"
        text="Status changes and administrative events will appear here."
      />
    );
  const owner = data.users.find((user) => user.id === project.owner);
  return (
    <section className="detail-grid">
      <KV l="Project ID" v={project.id} />
      <KV l="Project Name" v={en(project.title)} />
      <KV l="Owner" v={owner?.name || owner?.mobile || 'Unknown'} />
      <KV l="User ID" v={project.owner} />
      <KV l="Service" v={en(project.service)} />
      <KV l="Status" v={en(project.status)} />
      <KV l="Amount" v={`${project.amount.toLocaleString('en-US')} TOMAN`} />
      <KV l="Progress" v={`${project.progress}%`} />
      <KV l="Assigned Expert" v={project.assignee || 'Not assigned'} />
      <KV l="Start Date" v={project.startDate || 'Not provided'} />
      <KV l="Due Date" v={project.dueDate || 'Not provided'} />
    </section>
  );
}

function TransactionTabContent({ tab, tx }: { tab: string; tx: Tx }) {
  if (tab === 'Payment Information')
    return (
      <section className="detail-grid">
        <KV
          l="Payment Method"
          v={tx.amount > 0 ? 'Payment Gateway' : 'Wallet'}
        />
        <KV l="Gateway Reference" v={tx.gatewayRef || 'Not provided'} />
        <KV l="User ID" v={tx.owner} />
        <KV l="Project ID" v={tx.project} />
      </section>
    );
  if (tab === 'Amount Breakdown')
    return (
      <section className="detail-grid">
        <KV
          l="Gross Amount"
          v={`${Math.abs(tx.amount).toLocaleString('en-US')} TOMAN`}
        />
        <KV l="Fees" v="0 TOMAN" />
        <KV
          l="Net Amount"
          v={`${Math.abs(tx.amount).toLocaleString('en-US')} TOMAN`}
        />
      </section>
    );
  if (tab === 'Status History')
    return (
      <section className="detail-grid">
        <KV l="Current Status" v={tx.status || 'Completed'} />
        <KV l="Recorded At" v={tx.date} />
      </section>
    );
  return (
    <section className="detail-grid">
      <KV l="Transaction ID" v={tx.id} />
      <KV l="Type" v={tx.amount > 0 ? 'Wallet Top-Up' : 'Project Payment'} />
      <KV l="Status" v={tx.status || 'Completed'} />
      <KV
        l="Amount"
        v={`${Math.abs(tx.amount).toLocaleString('en-US')} TOMAN`}
      />
      <KV l="User ID" v={tx.owner} />
      <KV l="Project ID" v={tx.project} />
    </section>
  );
}

function PlanTabContent({ tab, plan }: { tab: string; plan: Plan }) {
  if (tab === 'Pricing Tiers')
    return (
      <section className="detail-grid">
        <KV l="Base Price" v={`${plan.price.toLocaleString('en-US')} TOMAN`} />
        <KV
          l="Billing Unit"
          v={plan.unit === 'پروژه' ? 'Per project' : 'Per m²'}
        />
      </section>
    );
  if (tab === 'Pricing History')
    return (
      <DetailEmpty
        title="No pricing history"
        text="Future price changes will appear here."
      />
    );
  return (
    <section className="detail-grid">
      <KV l="Plan ID" v={plan.id} />
      <KV l="Plan Name" v={en(plan.name)} />
      <KV
        l="Pricing Status"
        v={plan.enabled ? 'ON' : 'OFF — Free for all users'}
      />
      <KV l="Current Price" v={`${plan.price.toLocaleString('en-US')} TOMAN`} />
      <KV
        l="Billing Type"
        v={plan.unit === 'پروژه' ? 'Per project' : 'Per m²'}
      />
    </section>
  );
}

function DetailTabs({
  labels,
  active,
  onChange,
}: {
  labels: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <nav className="detail-tabs">
      {labels.map((x) => (
        <button
          className={active === x ? 'active' : ''}
          onClick={() => onChange(x)}
          key={x}
        >
          {x}
        </button>
      ))}
    </nav>
  );
}
function KV({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <div>
      <small>{l}</small>
      <b>{v}</b>
    </div>
  );
}
function Profile({ data, update }: { data: Store; update: StoreUpdate }) {
  let u = data.users.find((x) => x.id === me)!;
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [draft, setDraft] = useState({
    name: u.name,
    mobile: u.mobile,
    email: u.email,
    province: u.province || '',
    city: u.city || '',
    nationalId: u.nationalId || '',
  });
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [notice, setNotice] = useState('');
  const avatarInput = useRef<HTMLInputElement>(null);
  function saveProfile() {
    update((store) => ({
      ...store,
      users: store.users.map((item) =>
        item.id === u.id ? { ...item, ...draft } : item,
      ),
    }));
    setEditing(false);
    setNotice('اطلاعات پروفایل با موفقیت ذخیره شد.');
  }
  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (
      passwords.password.length < 8 ||
      passwords.password !== passwords.confirm
    )
      return;
    const hash = await hashUserPassword(u.id, passwords.password);
    localStorage.setItem(`engi-user-password:${u.id}`, hash);
    setPasswords({ password: '', confirm: '' });
    setChangingPassword(false);
    setNotice('رمز عبور جدید با موفقیت ثبت شد.');
  }
  async function saveAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setNotice('فرمت تصویر باید JPG، PNG یا WebP باشد.');
      return;
    }
    if (file.size > 1_500_000) {
      setNotice('حجم تصویر باید کمتر از ۱.۵ مگابایت باشد.');
      return;
    }
    try {
      setNotice('در حال ذخیره تصویر پروفایل…');
      const uploaded = await uploadAvatarFile(u.id, file, u.avatarKey);
      update((store) => ({
        ...store,
        users: store.users.map((item) =>
          item.id === u.id
            ? { ...item, avatar: uploaded.url, avatarKey: uploaded.key }
            : item,
        ),
      }));
      setNotice('تصویر پروفایل با موفقیت ذخیره شد.');
    } catch {
      setNotice('ذخیره تصویر انجام نشد. لطفاً دوباره تلاش کنید.');
    }
    event.target.value = '';
  }
  return (
    <Shell admin={false}>
      <article className="profile-page">
        <Head title="پروفایل من" text="اطلاعات حساب کاربری و تنظیمات شما" />
        <div className="profile-layout">
          <aside className="profile-card">
            <div className="avatar">
              <div className="avatar-media">
                {u.avatar ? (
                  <img src={u.avatar} alt="تصویر پروفایل" />
                ) : (
                  <UserRound />
                )}
              </div>
              <button
                aria-label="تغییر تصویر"
                onClick={() => avatarInput.current?.click()}
              >
                <Camera />
              </button>
              <input
                ref={avatarInput}
                className="avatar-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={saveAvatar}
              />
            </div>
            <h2>{u.name || 'نام وارد نشده'}</h2>
            <p>کاربر عادی</p>
            <div className="profile-meta">
              <span>
                <IdCard />
                <small>کد ملی</small>
                <b>{u.nationalId || 'ثبت نشده'}</b>
              </span>
              <span>
                <CalendarDays />
                <small>عضویت از</small>
                <b>{accountDate(u.createdAt)}</b>
              </span>
              <span>
                <Bell />
                <small>آخرین ورود</small>
                <b>{accountDate(u.lastLoginAt, true)}</b>
              </span>
            </div>
            <button
              className="password"
              onClick={() => setChangingPassword(true)}
            >
              <LockKeyhole />
              تغییر رمز عبور
            </button>
          </aside>
          <section className="profile-details">
            <header>
              <div>
                <h2>اطلاعات فردی</h2>
                <i />
              </div>
              {editing ? (
                <div className="profile-inline-actions">
                  <button
                    onClick={() => {
                      setDraft({
                        name: u.name,
                        mobile: u.mobile,
                        email: u.email,
                        province: u.province || '',
                        city: u.city || '',
                        nationalId: u.nationalId || '',
                      });
                      setEditing(false);
                    }}
                  >
                    انصراف
                  </button>
                  <button className="save" onClick={saveProfile}>
                    <Check /> ذخیره
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNotice('');
                    setEditing(true);
                  }}
                >
                  <Pencil /> ویرایش
                </button>
              )}
            </header>
            <div className="detail-rows">
              {Object.entries({
                name: 'نام و نام خانوادگی',
                nationalId: 'کد ملی',
                email: 'ایمیل',
                mobile: 'شماره موبایل',
                province: 'استان',
                city: 'شهر',
              }).map(([key, label]) => (
                <p className={editing ? 'editing' : ''} key={key}>
                  <span>{label}</span>
                  {editing ? (
                    <Input
                      value={draft[key as keyof typeof draft]}
                      onChange={(event) =>
                        setDraft({ ...draft, [key]: event.target.value })
                      }
                    />
                  ) : (
                    <b className={key === 'email' ? 'latin' : ''}>
                      {String(u[key as keyof User] || 'ثبت نشده')}
                    </b>
                  )}
                </p>
              ))}
            </div>
          </section>
        </div>
        {notice && <p className="profile-notice">{notice}</p>}
        <Dialog open={changingPassword} onOpenChange={setChangingPassword}>
          <DialogContent className="modal profile-dialog">
            <DialogHeader>
              <DialogTitle>تغییر رمز عبور</DialogTitle>
              <DialogDescription>
                رمز جدید باید حداقل ۸ کاراکتر باشد.
              </DialogDescription>
            </DialogHeader>
            <form className="profile-edit-form single" onSubmit={savePassword}>
              <label>
                <span>رمز عبور جدید</span>
                <Input
                  type="password"
                  value={passwords.password}
                  onChange={(event) =>
                    setPasswords({ ...passwords, password: event.target.value })
                  }
                />
              </label>
              <label>
                <span>تکرار رمز عبور جدید</span>
                <Input
                  type="password"
                  value={passwords.confirm}
                  onChange={(event) =>
                    setPasswords({ ...passwords, confirm: event.target.value })
                  }
                />
              </label>
              {passwords.confirm &&
                passwords.password !== passwords.confirm && (
                  <p className="profile-form-error">
                    تکرار رمز عبور مطابقت ندارد.
                  </p>
                )}
              <footer>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChangingPassword(false)}
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  disabled={
                    passwords.password.length < 8 ||
                    passwords.password !== passwords.confirm
                  }
                >
                  ثبت رمز جدید
                </Button>
              </footer>
            </form>
          </DialogContent>
        </Dialog>
      </article>
    </Shell>
  );
}
function ProfileSafe({ data, update }: { data: Store; update: StoreUpdate }) {
  let [u, setU] = useState<User | undefined>(() =>
    data.users.find((x) => x.id === me),
  );
  useEffect(() => {
    let found = data.users.find((x) => x.id === me);
    if (found) {
      setU(found);
      return;
    }
    let mobile = localStorage.getItem('engi-auth-phone') || '';
    if (!mobile) {
      location.replace('/panel/login');
      return;
    }
    let created: User = {
      id: me || `USR-${Date.now()}`,
      name: '',
      mobile,
      email: '',
      wallet: 0,
      active: true,
      admin: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    let store: Store;
    try {
      store = readStore();
    } catch {
      store = { ...seed };
    }
    if (!store.users.some((x) => x.id === created.id)) {
      store = { ...store, users: [...store.users, created] };
      writeStore(store);
    }
    setU(created);
  }, [data]);
  if (!u)
    return (
      <Shell admin={false}>
        <article>
          <section className="card empty">
            <UserRound />
            <h2>در حال آماده‌سازی پروفایل...</h2>
          </section>
        </article>
      </Shell>
    );
  let next = data.users.some((x) => x.id === u.id)
    ? data
    : { ...data, users: [...data.users, u] };
  return <Profile data={next} update={update} />;
}
function ProjectProgressDialog({
  project,
  open,
  onOpenChange,
  update,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: StoreUpdate;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const recover = useCallback(async () => {
    if (!project) return;
    setBusy(true);
    setError('');
    try {
      const connected = await startDesignProject(project);
      update((store) => ({
        ...store,
        projects: store.projects.map((item) =>
          item.id === connected.id ? connected : item,
        ),
      }));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'شروع تولید خروجی انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }, [project, update]);
  useEffect(() => {
    if (open && project?.fileKey && !project.engineProjectId && !error && !busy)
      void recover();
  }, [open, project?.id, project?.engineProjectId]);
  useEffect(() => {
    if (!open || !project?.engineProjectId || !project.engineProjectToken) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    void readDesignProjectState(project)
      .then((fresh) => {
        if (cancelled) return;
        update((store) => ({
          ...store,
          projects: store.projects.map((item) =>
            item.id === fresh.id ? fresh : item,
          ),
        }));
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : 'آخرین وضعیت پروژه دریافت نشد.',
          );
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project?.id]);
  if (!project) return null;
  async function download() {
    setBusy(true);
    setError('');
    try {
      await downloadProjectOutput(project!);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دانلود خروجی انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="modal project-progress-modal">
        <DialogHeader>
          <DialogTitle>{project.title}</DialogTitle>
          <DialogDescription>شناسه پروژه: {project.id}</DialogDescription>
        </DialogHeader>
        <div className="project-progress-summary">
          <span>
            <b>
              {project.designLabel ||
                (project.engineProjectId
                  ? 'دریافت وضعیت تولید…'
                  : 'اتصال به موتور تولید لازم است')}
            </b>
            <small>
              {project.designDetail ||
                'پیشرفت فقط بر اساس مرحله ثبت‌شده در موتور نمایش داده می‌شود.'}
            </small>
          </span>
          <strong>{project.progress.toLocaleString('fa-IR')}٪</strong>
          <div>
            <i style={{ width: `${project.progress}%` }} />
          </div>
        </div>
        {!!project.designTimeline?.length && (
          <ol className="project-timeline">
            {project.designTimeline.map((item) => (
              <li key={item.stage} className={item.state}>
                <i>
                  {item.state === 'completed' ? (
                    <Check />
                  ) : (
                    item.percent.toLocaleString('fa-IR')
                  )}
                </i>
                <span>
                  <b>{item.label}</b>
                  <small>{item.percent.toLocaleString('fa-IR')}٪</small>
                </span>
              </li>
            ))}
          </ol>
        )}
        {(project.status === 'نیازمند اصلاح' || project.lastError || error) && (
          <p className="flow-error" role="alert">
            {error ||
              project.lastError ||
              (busy
                ? 'در حال دریافت دلیل توقف پروژه…'
                : 'دلیل توقف ثبت شده است؛ وضعیت را دوباره بازخوانی کنید.')}
          </p>
        )}
        <div className="project-dialog-actions">
          {!project.engineProjectId && (
            <Button onClick={recover} disabled={busy || !project.fileKey}>
              {busy ? 'در حال شروع تولید…' : 'شروع و پیگیری تولید خروجی'}
            </Button>
          )}
          {project.outputReady && (
            <Button onClick={download} disabled={busy}>
              <Download /> {busy ? 'در حال آماده‌سازی…' : 'دانلود خروجی نهایی'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function Simple({
  projects,
  data,
  update,
}: {
  projects?: boolean;
  data: Store;
  update: StoreUpdate;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    data.projects.find((project) => project.id === selectedId) || null;
  return (
    <Shell admin={false}>
      <article>
        <Head
          title={projects ? 'پروژه‌های من' : 'پشتیبانی'}
          text={
            projects
              ? 'وضعیت و پیشرفت پروژه‌ها را دنبال کنید.'
              : 'درخواست خود را برای کارشناسان ما ارسال کنید.'
          }
          action={
            projects && (
              <a
                className="primary"
                href="/panel/projects/new"
                onClick={(e) => navigate(e, '/panel/projects/new')}
              >
                <Plus />
                پروژه جدید
              </a>
            )
          }
        />
        {projects ? (
          <section className="card">
            <Toolbar />
            <Projects
              data={data}
              own
              on={(project) => setSelectedId(project.id)}
            />
          </section>
        ) : (
          <section className="empty card">
            <MessageSquare />
            <h2>چطور می‌توانیم کمک کنیم؟</h2>
            <p>پاسخ‌گویی معمولاً کمتر از دو ساعت</p>
            <Button>ثبت درخواست جدید</Button>
          </section>
        )}
        {projects && (
          <ProjectProgressDialog
            project={selected}
            open={Boolean(selected)}
            onOpenChange={(next) => !next && setSelectedId(null)}
            update={update}
          />
        )}
      </article>
    </Shell>
  );
}
export function Portal({ mode }: { mode?: 'admin' | 'panel' } = {}) {
  let path = useAppPath(),
    [data, update] = useStore(),
    p = path.split('/').filter(Boolean),
    admin = mode ? mode === 'admin' : p[0] === 'admin',
    page = p[1] || (admin ? 'users' : 'login'),
    id = p[2],
    auth = '',
    acting = '';
  const [session, setSession] = useState<{
    auth: string;
    acting: string;
  } | null>(null);
  const [accountError, setAccountError] = useState('');
  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch('/api/admin/accounts', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({action:'state'}) });
        const result = await response.json() as { users: User[]; projects: any[]; transactions: Tx[]; error?: string };
        if (!response.ok) throw new Error(result.error || 'Accounts unavailable');
        if (!cancelled) {
          // Keep legacy project/download records until their ownership migration is approved.
          update(current => ({...current,
            users: [...current.users.filter(u => !u.id.startsWith('CUST-')), ...result.users],
            projects: [...current.projects.filter(p => !p.owner.startsWith('CUST-')), ...result.projects.map(customerProject)],
            tx: [...current.tx.filter(t => !t.owner.startsWith('CUST-')), ...result.transactions],
          }));
          setAccountError('');
        }
      } catch { if (!cancelled) setAccountError('حساب‌های سرور در دسترس نیستند؛ موجودی نمایش‌داده‌شده ممکن است قدیمی باشد.'); }
      finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('engi-admin-refresh', refresh);
    return () => {cancelled = true; clearInterval(timer); window.removeEventListener('engi-admin-refresh', refresh);};
  }, [admin]);
  useEffect(() => {
    if (admin) return;
    const incoming = new URLSearchParams(location.hash.slice(1)).get('handoff');
    if (incoming && /^[A-Za-z0-9_-]{40,100}$/.test(incoming)) {
      sessionStorage.setItem('engi-handoff', incoming);
      history.replaceState({}, '', '/panel/projects/new');
    }
    const syncSession = async () => {
      try {
        const localUserId = localStorage.getItem('engi-auth-user') || '';
        let localStore = readStore();
        const repairKey = 'engi-project-owner-repair-cust-27-v1';
        if (localUserId === 'CUST-27' && !localStorage.getItem(repairKey) && localStore.projects.length) {
          localStore = {
            ...localStore,
            projects: localStore.projects.map((project) => ({ ...project, owner: localUserId })),
          };
          writeStore(localStore);
        }
        const pendingProjects = localUserId.startsWith('CUST-')
          ? localStore.projects.filter((project) => project.owner === localUserId)
          : [];
        // Establish the authenticated session first; migration is secondary and
        // must not prevent the customer from entering the panel.
        const result = await customerRequest('state');
        localStorage.setItem('engi-auth-user', result.userId);
        applyCustomerState(result);
        setSession({ auth: result.userId, acting: sessionStorage.getItem('engi-impersonate') || '' });
        if (pendingProjects.length) {
          const syncKey = `engi-project-sync:${result.userId}`;
          const fingerprint = JSON.stringify(pendingProjects);
          if (localStorage.getItem(syncKey) !== fingerprint) {
            void customerRequest('import', { projects: pendingProjects }).then((durableState) => {
              localStorage.setItem(syncKey, fingerprint);
              if (localUserId === 'CUST-27') localStorage.setItem(repairKey, '1');
              applyCustomerState(durableState);
            }).catch(() => {});
          }
        }
      } catch {
        setSession({ auth: '', acting: '' });
      }
    };
    syncSession();
    window.addEventListener('engi-auth', syncSession);
    window.addEventListener('focus', syncSession);
    // One account snapshot is the only background source for project state.
    // Direct engine reads are reserved for an explicitly opened project dialog.
    const timer = window.setInterval(syncSession, 4000);
    return () => { window.removeEventListener('engi-auth', syncSession); window.removeEventListener('focus', syncSession); clearInterval(timer); };
  }, [admin]);
  if (!admin && !session)
    return <div className="entry-loading" aria-label="در حال آماده‌سازی پنل" />;
  auth = session?.auth || '';
  acting = session?.acting || '';
  if (!admin) me = acting || auth || '';
  // A valid server session always wins over a stale /panel/login URL. This also
  // makes login resilient when a browser delays or suppresses client navigation.
  if (!admin && !auth && !acting) return <LoginSafe />;
  if (admin && accountError) return <Shell admin><article><p role="alert">{accountError}</p><button onClick={() => window.dispatchEvent(new Event('engi-admin-refresh'))}>تلاش دوباره</button></article></Shell>;
  if (!admin) {
    if (page === 'projects' && id === 'new')
      return <NewProject data={data} update={update} />;
    if (page === 'projects')
      return <Simple projects data={data} update={update} />;
    if (page === 'transactions' || page === 'wallet')
      return <WalletPage data={data} />;
    if (page === 'profile') return <ProfileSafe data={data} update={update} />;
    return <Simple projects data={data} update={update} />;
  }
  if (id)
    return <AdminDetail kind={page} id={id} data={data} update={update} />;
  if (page === 'projects') return <AdminProjects data={data} update={update} />;
  if (page === 'transactions')
    return <Transactions data={data} update={update} />;
  if (page === 'pricing') return <Pricing data={data} update={update} />;
  return <UsersPage data={data} update={update} />;
}

export function AdminPortal() {
  return <Portal mode="admin" />;
}

export function UserPortal() {
  return <Portal mode="panel" />;
}

export default Portal;
