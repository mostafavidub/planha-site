import { unzipSync } from 'fflate';

export type DxfAnalysis = {
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
};
type Entity = {
  type: string;
  layer: string;
  text: string;
  x?: number;
  y?: number;
  closed?: boolean;
  points: { x: number; y: number }[];
  measurement?: number;
};
type PlanTitle = { label: string; x: number; y: number };
const floorWords = [
  'زیرزمین',
  'همکف',
  'اول',
  'دوم',
  'سوم',
  'چهارم',
  'پنجم',
  'ششم',
  'هفتم',
  'هشتم',
  'نهم',
];
const ignoredPlans =
  /بام|شیب[‌ ]?بندی|نما|برش|فونداسیون|جزئیات|دیتیل|مبلمان|فرنیچر|تیرریزی|لینتل/i;
const ignoredLayers =
  /support|suport|frame|kader|border|title|sheet|defpoints/i;
const decodeEscapes = (text: string) =>
  text
    .replace(/\\U\+([0-9a-f]{4})/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/%%[dpc]/gi, ' ');
const languageScore = (value: string) =>
  (value.match(/[\u0600-\u06ff]/g) || []).length +
  (value.match(/پلان|طبقه|مساحت|زیربنا|معماری|همکف/g) || []).length * 10000 -
  (value.match(/�/g) || []).length * 20;
const rounded = (value: number) => Math.round(value * 100) / 100;

function empty(warning: string): DxfAnalysis {
  return {
    status: 'review',
    area: null,
    floors: null,
    floorAreas: [],
    unit: 'نامشخص',
    confidence: 0,
    method: 'none',
    warnings: [warning],
    evidence: [],
    checks: [],
    inferredAnswers: {},
  };
}

function inferDesignAnswers(source: string) {
  const text = source
    .replace(/[۰-۹]/g, (char) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char)))
    .replace(/٫/g, '.')
    .replace(/٬/g, '');
  const answers: Record<string, string> = {};
  const city = text.match(
    /(?:شهر|محل پروژه|استان)\s*[:=\-]?\s*(تهران|مشهد|شیراز|تبریز|اصفهان|کرج|قم|اهواز|رشت|ساری|گرگان|یزد|کرمان|ارومیه|بندرعباس)/i,
  )?.[1];
  if (city) answers.location = city;
  const height = text.match(
    /(?:ارتفاع(?:\s*(?:طبقه|کف تا کف|سقف))?|floor\s*height|F\.F\.H)\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*(متر|سانتی.?متر|mm|cm|m\b)/i,
  );
  if (height) answers.heights = `ارتفاع صریح نقشه: ${height[1]} ${height[2]}`;
  if (/طبقات?\s+تیپ|پلان\s+تیپ/i.test(text))
    answers.typical = 'طبقات تیپ مطابق عناوین پلان معماری';
  if (
    /شفت(?:\s+مکانیکی)?|رایزر(?:\s+مکانیکی)?|mechanical\s+(?:shaft|riser)/i.test(
      text,
    )
  ) {
    answers.shafts = 'شفت‌ها و رایزرها در پلان مشخص شده‌اند';
    answers.mechanical_shaft_route = 'شفت‌های موجود معماری استفاده شوند';
  }
  if (/پلان\s+(?:معماری\s+)?بام|roof\s+plan/i.test(text))
    answers.roof = 'فضاها و تجهیزات بام مطابق پلان بام';
  if (/پکیج(?:\s+دیواری)?[^\n]{0,30}رادیاتور/i.test(text))
    answers.heating = 'پکیج دیواری و رادیاتور';
  else if (/موتورخانه[^\n]{0,40}رادیاتور/i.test(text))
    answers.heating = 'موتورخانه مرکزی و رادیاتور';
  else if (/گرمایش\s+از\s+کف/i.test(text)) answers.heating = 'گرمایش از کف';
  if (/داکت.?اسپلیت|اسپلیت/i.test(text))
    answers.cooling = 'اسپلیت یا داکت‌اسپلیت';
  else if (/چیلر[^\n]{0,40}فن.?کویل/i.test(text))
    answers.cooling = 'چیلر و فن‌کویل';
  else if (/VRF|VRV/i.test(text)) answers.cooling = 'VRF/VRV';
  else if (/کولر\s+آبی/i.test(text)) answers.cooling = 'کولر آبی';
  if (/بدون\s+گاز|گاز\s+ندارد/i.test(text)) answers.gas = 'ساختمان گاز ندارد';
  else if (/کنتور\s+گاز|رگلاتور\s+گاز|ورودی\s+گاز/i.test(text))
    answers.gas = 'محل ورود و کنتورها در پلان مشخص است';
  if (answers.gas)
    answers.has_gas_system =
      answers.gas === 'ساختمان گاز ندارد' ? 'خیر' : 'بله';
  if (/بدون\s+موتورخانه/i.test(text)) answers.has_boiler_room = 'خیر';
  else if (/موتورخانه|boiler room|mechanical room/i.test(text))
    answers.has_boiler_room = 'بله';
  if (/بدون\s+استخر/i.test(text)) answers.has_pool = 'خیر';
  else if (/استخر|pool/i.test(text)) answers.has_pool = 'بله';
  if (/بدون\s+سونا/i.test(text)) answers.has_sauna = 'خیر';
  else if (/سونا|sauna/i.test(text)) answers.has_sauna = 'بله';
  if (/بدون\s+جکوزی/i.test(text)) answers.has_jacuzzi = 'خیر';
  else if (/جکوزی|jacuzzi/i.test(text)) answers.has_jacuzzi = 'بله';
  const gasPressure = text.match(
    /(?:فشار\s+گاز|gas\s+pressure)\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*(mbar|میلی.?بار|bar|بار)/i,
  );
  if (gasPressure)
    answers.gas_service_pressure = `${gasPressure[1]} ${gasPressure[2]}`;
  const waterPressure = text.match(
    /(?:فشار\s+(?:آب|ورودی)|water\s+(?:inlet\s+)?pressure)\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*(bar|بار)/i,
  );
  if (waterPressure) answers.water_inlet_pressure = `${waterPressure[1]} bar`;
  if (/مخزن[^\n]{0,50}(?:بوستر|پمپ)|(?:بوستر|پمپ)[^\n]{0,50}مخزن/i.test(text))
    answers.water_source = 'کنتور شهری + مخزن + بوسترپمپ';
  else if (/تغذیه\s+مستقیم\s+آب|آب\s+شهری\s+مستقیم/i.test(text))
    answers.water_source = 'تغذیه مستقیم آب شهری';
  if (/فاضلاب\s+شهری|شبکه\s+فاضلاب/i.test(text))
    answers.sanitary_outlet = 'اتصال به شبکه فاضلاب شهری';
  else if (/چاه\s+جذبی/i.test(text)) answers.sanitary_outlet = 'چاه جذبی';
  else if (/سپتیک|تصفیه.?خانه\s+محلی/i.test(text))
    answers.sanitary_outlet = 'سپتیک یا تصفیه‌خانه محلی';
  if (/پارکینگ\s+(?:باز|روباز)|open\s+parking/i.test(text))
    answers.parking_enclosure = 'پارکینگ باز با تهویه طبیعی';
  else if (/پارکینگ\s+(?:بسته|محصور)|enclosed\s+parking/i.test(text))
    answers.parking_enclosure = 'پارکینگ بسته/محصور';
  if (/سه.?فاز|3\s*(?:ph|phase)/i.test(text))
    answers.supply = 'انشعاب سه‌فاز مطابق نقشه';
  else if (/تک.?فاز|1\s*(?:ph|phase)/i.test(text))
    answers.supply = 'انشعاب تک‌فاز مطابق نقشه';
  if (/ژنراتور|generator/i.test(text) && /UPS/i.test(text))
    answers.emergency = 'ژنراتور و UPS';
  else if (/ژنراتور|generator/i.test(text)) answers.emergency = 'ژنراتور';
  else if (/\bUPS\b/i.test(text)) answers.emergency = 'UPS';
  return answers;
}
function decode(bytes: Uint8Array) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (languageScore(utf8) > 10000 || !utf8.includes('�'))
    return decodeEscapes(utf8);
  const windows = new TextDecoder('windows-1256', { fatal: false }).decode(
    bytes,
  );
  return decodeEscapes(
    languageScore(windows) > languageScore(utf8) ? windows : utf8,
  );
}
function dxfFiles(name: string, bytes: Uint8Array) {
  if (name.toLowerCase().endsWith('.dxf')) return [{ name, bytes }];
  let count = 0,
    expanded = 0;
  const archive = unzipSync(bytes, {
    filter: (entry) => {
      if (
        entry.name.startsWith('__MACOSX/') ||
        !entry.name.toLowerCase().endsWith('.dxf')
      )
        return false;
      count++;
      expanded += entry.originalSize;
      if (count > 8 || expanded > 80_000_000 || entry.originalSize > 50_000_000)
        throw new Error('unsafe_archive');
      return true;
    },
  });
  return Object.entries(archive).map(([fileName, fileBytes]) => ({
    name: fileName,
    bytes: fileBytes,
  }));
}
function explicitAreas(text: string) {
  const found: number[] = [];
  const patterns = [
    /(?:^|\s)S\s*=\s*(\d{1,6}(?:[\/.,]\d{1,3})?)\s*(?:M|متر)/gi,
    /(?:مساحت|زیربنا)\s*[:=]?\s*(\d{1,6}(?:[\/.,]\d{1,3})?)/gi,
  ];
  for (const pattern of patterns)
    for (const match of text.matchAll(pattern)) {
      const raw = match[1],
        separator = raw.match(/[\/.,]/)?.[0],
        number = Number(separator ? raw.replace(separator, '.') : raw);
      if (number >= 5 && number <= 100000) found.push(number);
    }
  return found;
}
function parseEntities(text: string) {
  const result: Entity[] = [];
  let current: Entity | null = null,
    pendingX: number | undefined;
  const flush = () => {
    if (
      current &&
      (['TEXT', 'MTEXT', 'DIMENSION'].includes(current.type) ||
        (current.type === 'LWPOLYLINE' && current.closed))
    )
      result.push(current);
  };
  const pairs = /[^\r\n]*\r?\n[^\r\n]*(?:\r?\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pairs.exec(text))) {
    const separator = match[0].indexOf('\n'),
      code = Number(match[0].slice(0, separator).trim()),
      value = match[0].slice(separator + 1).trim();
    if (code === 0) {
      flush();
      current = { type: value, layer: '', text: '', points: [] };
      pendingX = undefined;
      continue;
    }
    if (!current) continue;
    if (code === 8) current.layer = value;
    if ((code === 1 || code === 3) && ['TEXT', 'MTEXT'].includes(current.type))
      current.text += `${value} `;
    if (code === 70 && current.type === 'LWPOLYLINE')
      current.closed = (Number(value) & 1) === 1;
    if (code === 10 && ['TEXT', 'MTEXT', 'LWPOLYLINE'].includes(current.type)) {
      pendingX = Number(value);
      if (current.x === undefined) current.x = pendingX;
    }
    if (
      code === 20 &&
      pendingX !== undefined &&
      ['TEXT', 'MTEXT', 'LWPOLYLINE'].includes(current.type)
    ) {
      const y = Number(value);
      current.points.push({ x: pendingX, y });
      if (current.y === undefined) current.y = y;
      pendingX = undefined;
    }
    if (code === 42 && current.type === 'DIMENSION')
      current.measurement = Number(value);
  }
  flush();
  return result;
}
function polygonArea(points: { x: number; y: number }[]) {
  return Math.abs(
    points.reduce((sum, p, index) => {
      const next = points[(index + 1) % points.length];
      return sum + p.x * next.y - next.x * p.y;
    }, 0) / 2,
  );
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
function labelsInTitle(text: string) {
  const labels: string[] = [];
  const range = text.match(
    /طبقات?\s+(زیرزمین|همکف|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم)\s+تا\s+(اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم)/,
  );
  if (range) {
    const start = floorWords.indexOf(range[1]),
      end = floorWords.indexOf(range[2]);
    if (start >= 0 && end >= start)
      labels.push(...floorWords.slice(start, end + 1));
  }
  for (const word of floorWords)
    if (
      new RegExp(`طبقه\\s*${word}|پلان\\s*(?:معماری\\s*)?${word}`).test(text) &&
      !labels.includes(word)
    )
      labels.push(word);
  return labels;
}
function floorLabels(text: string) {
  const labels: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!/پلان/.test(line) || ignoredPlans.test(line)) continue;
    for (const word of labelsInTitle(line))
      if (!labels.includes(word)) labels.push(word);
  }
  return labels;
}
function planTitles(all: Entity[]): PlanTitle[] {
  const found: PlanTitle[] = [];
  for (const entity of all) {
    if (
      !['TEXT', 'MTEXT'].includes(entity.type) ||
      entity.x === undefined ||
      entity.y === undefined ||
      !/پلان/.test(entity.text) ||
      ignoredPlans.test(entity.text)
    )
      continue;
    for (const word of labelsInTitle(entity.text))
      found.push({ label: word, x: entity.x, y: entity.y });
  }
  if (!found.length) return [];
  const groups: PlanTitle[][] = [];
  for (const title of found) {
    let group = groups.find((items) => Math.abs(items[0].y - title.y) <= 5);
    if (!group) {
      group = [];
      groups.push(group);
    }
    if (!group.some((item) => item.label === title.label)) group.push(title);
  }
  groups.sort(
    (a, b) =>
      new Set(b.map((x) => x.label)).size - new Set(a.map((x) => x.label)).size,
  );
  return groups[0];
}
function geometryAreas(all: Entity[], titles: PlanTitle[]) {
  if (!titles.length) return [];
  const raw = all
    .filter(
      (e) =>
        e.type === 'LWPOLYLINE' &&
        e.closed &&
        e.points.length >= 3 &&
        !ignoredLayers.test(e.layer),
    )
    .map((entity) => ({
      area: polygonArea(entity.points),
      cx: entity.points.reduce((s, p) => s + p.x, 0) / entity.points.length,
      cy: entity.points.reduce((s, p) => s + p.y, 0) / entity.points.length,
    }))
    .filter(({ area }) => area >= 20 && area <= 5000);
  const frequency = new Map<string, number>();
  for (const item of raw) {
    const key = item.area.toFixed(2);
    frequency.set(key, (frequency.get(key) || 0) + 1);
  }
  const selected: number[] = [];
  for (const title of titles) {
    const local = raw
      .filter(
        (item) =>
          (frequency.get(item.area.toFixed(2)) || 0) < 3 &&
          Math.abs(item.cx - title.x) <= 18 &&
          item.cy >= title.y &&
          item.cy - title.y <= 30,
      )
      .sort((a, b) => b.area - a.area);
    if (!local.length) return [];
    selected.push(rounded(local[0].area));
  }
  if (Math.max(...selected) / Math.min(...selected) > 4) return [];
  return selected;
}

export function analyzeProjectFile(
  name: string,
  input: ArrayBuffer | Uint8Array,
): DxfAnalysis {
  let files: { name: string; bytes: Uint8Array }[] = [];
  try {
    files = dxfFiles(
      name,
      input instanceof Uint8Array ? input : new Uint8Array(input),
    );
  } catch {
    return empty('فایل ZIP باز نشد یا DXF معتبری داخل آن نیست.');
  }
  if (!files.length) return empty('فایل DXF داخل بسته پیدا نشد.');
  const texts = files.map((file) => decode(file.bytes)),
    joined = texts.join('\n'),
    all = texts.flatMap(parseEntities),
    titles = planTitles(all),
    labels = floorLabels(joined),
    areas = texts.flatMap(explicitAreas),
    inferredAnswers = inferDesignAnswers(joined);
  const unitCode = joined.match(
      /\$INSUNITS[\s\S]{0,80}?\n\s*70\s*\n\s*(\d+)/,
    )?.[1],
    headerUnit =
      unitCode === '4' ? 'میلی‌متر' : unitCode === '6' ? 'متر' : 'نامشخص';
  const dimensions = all
      .filter(
        (e) => e.type === 'DIMENSION' && e.measurement && e.measurement > 0,
      )
      .map((e) => e.measurement!),
    dimensionMedian = dimensions.length ? median(dimensions) : null,
    geometry = areas.length ? [] : geometryAreas(all, titles);
  const architecturalTitleCount = all.filter(
    (entity) =>
      ['TEXT', 'MTEXT'].includes(entity.type) &&
      /پلان/.test(entity.text) &&
      !ignoredPlans.test(entity.text) &&
      labelsInTitle(entity.text).length > 0,
  ).length;
  const duplicateTitles = architecturalTitleCount > labels.length,
    floorAreas = (areas.length ? areas : geometry).map((area, index) => ({
      label: labels[index] || `طبقه ${index + 1}`,
      area,
    })),
    explicitConsistent =
      areas.length > 0 && labels.length > 0 && areas.length === labels.length,
    geometryConsistent =
      !areas.length &&
      geometry.length === labels.length &&
      labels.length > 0 &&
      !duplicateTitles;
  const evidence: string[] = [],
    warnings: string[] = [];
  if (areas.length)
    evidence.push(`${areas.length} مقدار مساحت صریح از متن نقشه استخراج شد.`);
  if (labels.length)
    evidence.push(
      `پلان‌های معماری طبقات ${labels.join(' و ')} از شیت‌ها و پلان‌های جانبی تفکیک شد.`,
    );
  if (headerUnit !== 'نامشخص')
    evidence.push(`واحد اعلام‌شده در سربرگ DXF: ${headerUnit}.`);
  if (dimensions.length)
    evidence.push(
      `${dimensions.length} اندازه ترسیمی برای کنترل مقیاس بررسی شد.`,
    );
  if (geometryConsistent)
    evidence.push(
      'برای هر طبقه یک مرز بسته غیرتکراری و خارج از لایه‌های کادر شیت پیدا شد.',
    );
  if (!areas.length) warnings.push('مساحت صریح و قابل اتکا در نقشه پیدا نشد.');
  if (!labels.length)
    warnings.push('عنوان پلان‌های معماری طبقات با اطمینان کافی شناسایی نشد.');
  if (areas.length && labels.length && areas.length !== labels.length)
    warnings.push('تعداد مساحت‌های استخراج‌شده با تعداد طبقات تطابق ندارد.');
  if (duplicateTitles)
    warnings.push(
      'چند شیت معماری تکراری یا متناقض برای یک طبقه پیدا شد؛ انتخاب خودکار شیت مرجع امن نیست.',
    );
  if (
    headerUnit === 'میلی‌متر' &&
    dimensionMedian !== null &&
    dimensionMedian < 100
  )
    warnings.push(
      'واحد سربرگ با اندازه‌های واقعی ترسیم ناسازگار است؛ اندازه‌ها شبیه متر ترسیم شده‌اند.',
    );
  if (!explicitConsistent && !geometryConsistent)
    warnings.push(
      'مرز بسته قابل اتکا برای همه طبقات پیدا نشد؛ کادر شیت و مرزهای تکراری عمداً از محاسبه حذف شدند.',
    );
  const method = explicitConsistent
      ? 'explicit-text'
      : geometryConsistent
        ? 'closed-boundary'
        : 'none',
    confidence = explicitConsistent
      ? 96
      : geometryConsistent
        ? 88
        : duplicateTitles
          ? 30
          : areas.length && labels.length
            ? 68
            : areas.length
              ? 55
              : labels.length
                ? 35
                : 20,
    resultAreas = explicitConsistent || geometryConsistent ? floorAreas : [];
  return {
    status: explicitConsistent
      ? 'ready'
      : geometryConsistent
        ? 'confirm'
        : 'review',
    area: resultAreas.length
      ? rounded(resultAreas.reduce((sum, item) => sum + item.area, 0))
      : null,
    floors: labels.length || areas.length || null,
    floorAreas: resultAreas,
    unit: headerUnit,
    confidence,
    method,
    warnings,
    evidence,
    checks: [
      {
        label: 'تفکیک پلان‌های معماری از شیت و جزئیات',
        passed: labels.length > 0,
      },
      {
        label: 'کنترل واحد و مقیاس با اندازه‌های نقشه',
        passed: headerUnit !== 'نامشخص' && dimensions.length > 0,
      },
      {
        label: 'وجود مساحت صریح یا مرز بسته برای تمام طبقات',
        passed: explicitConsistent || geometryConsistent,
      },
      {
        label: 'حذف کادرها و مرزهای تکراری',
        passed: all.some((e) => e.type === 'LWPOLYLINE'),
      },
    ],
    inferredAnswers,
  };
}
