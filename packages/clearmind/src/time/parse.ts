// Deterministic parser for relative and absolute time phrases against a reference date.
// Returns { start, end, phrase } ranges (UTC, inclusive start, exclusive end) or null.

export interface TimeRange {
  start: Date;
  end: Date;
  phrase: string;
}

const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const FAR_FUTURE = new Date("9999-12-31T23:59:59.999Z");
const EPOCH_START = new Date(0);

const dayStart = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
const dayEnd = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));

interface MatchResult {
  start: Date;
  end: Date;
  phrase: string;
  index: number;
}

function parseBaseDate(text: string, ref: Date, allowBare: boolean): MatchResult | null {
  const refY = ref.getUTCFullYear();
  const refM = ref.getUTCMonth();
  const refD = ref.getUTCDate();
  const refW = ref.getUTCDay();
  const diffToMon = (refW + 6) % 7;

  // 1. today / yesterday
  const todayMatch = /\b(today|yesterday)\b/i.exec(text);
  if (todayMatch) {
    const isToday = todayMatch[1].toLowerCase() === "today";
    const d = isToday ? refD : refD - 1;
    return {
      start: dayStart(refY, refM, d),
      end: isToday ? dayEnd(refY, refM, d) : dayStart(refY, refM, refD),
      phrase: todayMatch[0],
      index: todayMatch.index,
    };
  }

  // 2. last/this/next week|month|year
  const relMatch = /\b(last|this|next)\s+(week|month|year)\b/i.exec(text);
  if (relMatch) {
    const dir = relMatch[1].toLowerCase();
    const unit = relMatch[2].toLowerCase();
    if (unit === "week") {
      const offset = dir === "last" ? -7 : dir === "next" ? 7 : 0;
      const startD = refD - diffToMon + offset;
      return {
        start: dayStart(refY, refM, startD),
        end: dayStart(refY, refM, startD + 7),
        phrase: relMatch[0],
        index: relMatch.index,
      };
    }
    if (unit === "month") {
      const offset = dir === "last" ? -1 : dir === "next" ? 1 : 0;
      return {
        start: dayStart(refY, refM + offset, 1),
        end: dayStart(refY, refM + offset + 1, 1),
        phrase: relMatch[0],
        index: relMatch.index,
      };
    }
    if (unit === "year") {
      const offset = dir === "last" ? -1 : dir === "next" ? 1 : 0;
      return {
        start: dayStart(refY + offset, 0, 1),
        end: dayStart(refY + offset + 1, 0, 1),
        phrase: relMatch[0],
        index: relMatch.index,
      };
    }
  }

  // 3. N days/weeks/months ago
  const agoMatch = /\b(\d+)\s+(days?|weeks?|months?)\s+ago\b/i.exec(text);
  if (agoMatch) {
    const n = parseInt(agoMatch[1], 10);
    const unit = agoMatch[2].toLowerCase();
    if (unit.startsWith("day")) {
      return {
        start: dayStart(refY, refM, refD - n),
        end: dayStart(refY, refM, refD - n + 1),
        phrase: agoMatch[0],
        index: agoMatch.index,
      };
    }
    if (unit.startsWith("week")) {
      const startD = refD - diffToMon - n * 7;
      return {
        start: dayStart(refY, refM, startD),
        end: dayStart(refY, refM, startD + 7),
        phrase: agoMatch[0],
        index: agoMatch.index,
      };
    }
    if (unit.startsWith("month")) {
      return {
        start: dayStart(refY, refM - n, 1),
        end: dayStart(refY, refM - n + 1, 1),
        phrase: agoMatch[0],
        index: agoMatch.index,
      };
    }
  }

  // 4. last <weekday>
  const weekdayMatch = /\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i.exec(text);
  if (weekdayMatch) {
    const targetW = WEEKDAYS[weekdayMatch[1].toLowerCase()]!;
    let diff = (refW - targetW + 7) % 7;
    if (diff === 0) diff = 7;
    return {
      start: dayStart(refY, refM, refD - diff),
      end: dayStart(refY, refM, refD - diff + 1),
      phrase: weekdayMatch[0],
      index: weekdayMatch.index,
    };
  }

  // 5. ISO date (YYYY-MM-DD or YYYY-MM)
  const isoDayMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (isoDayMatch) {
    const y = parseInt(isoDayMatch[1], 10);
    const m = parseInt(isoDayMatch[2], 10) - 1;
    const d = parseInt(isoDayMatch[3], 10);
    return {
      start: dayStart(y, m, d),
      end: dayStart(y, m, d + 1),
      phrase: isoDayMatch[0],
      index: isoDayMatch.index,
    };
  }

  const isoMonthMatch = /\b(\d{4})-(\d{2})\b(?!\s*-\s*\d{2})/.exec(text);
  if (isoMonthMatch) {
    const y = parseInt(isoMonthMatch[1], 10);
    const m = parseInt(isoMonthMatch[2], 10) - 1;
    return {
      start: dayStart(y, m, 1),
      end: dayStart(y, m + 1, 1),
      phrase: isoMonthMatch[0],
      index: isoMonthMatch.index,
    };
  }

  // 6. on <Month day> (e.g. on May 15, on May 15th, on May 15 2023, on 15 May)
  // or bare <Month day> if allowBare is true
  const monthDayPrefix = allowBare ? "(?:on\\s+)?" : "on\\s+";
  const mdRegex1 = new RegExp(`\\b${monthDayPrefix}([A-Za-z]+)\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i");
  const mdMatch1 = mdRegex1.exec(text);
  if (mdMatch1 && MONTHS[mdMatch1[1].toLowerCase()] !== undefined) {
    const m = MONTHS[mdMatch1[1].toLowerCase()]!;
    const d = parseInt(mdMatch1[2], 10);
    if (d >= 1 && d <= 31) {
      let y = mdMatch1[3] ? parseInt(mdMatch1[3], 10) : (Date.UTC(refY, m, d) <= Date.UTC(refY, refM, refD) ? refY : refY - 1);
      return {
        start: dayStart(y, m, d),
        end: dayStart(y, m, d + 1),
        phrase: mdMatch1[0],
        index: mdMatch1.index,
      };
    }
  }

  const mdRegex2 = new RegExp(`\\b${monthDayPrefix}(\\d{1,2})(?:st|nd|rd|th)?\\s+([A-Za-z]+)(?:,?\\s+(\\d{4}))?\\b`, "i");
  const mdMatch2 = mdRegex2.exec(text);
  if (mdMatch2 && MONTHS[mdMatch2[2].toLowerCase()] !== undefined) {
    const m = MONTHS[mdMatch2[2].toLowerCase()]!;
    const d = parseInt(mdMatch2[1], 10);
    if (d >= 1 && d <= 31) {
      let y = mdMatch2[3] ? parseInt(mdMatch2[3], 10) : (Date.UTC(refY, m, d) <= Date.UTC(refY, refM, refD) ? refY : refY - 1);
      return {
        start: dayStart(y, m, d),
        end: dayStart(y, m, d + 1),
        phrase: mdMatch2[0],
        index: mdMatch2.index,
      };
    }
  }

  // 7. in <Month> (e.g. in May, in May 2023) or bare <Month> if allowBare is true
  const monthPrefix = allowBare ? "(?:in\\s+)?" : "in\\s+";
  const mRegex = new RegExp(`\\b${monthPrefix}([A-Za-z]+)(?:\\s+(\\d{4}))?\\b`, "i");
  const mMatch = mRegex.exec(text);
  if (mMatch && MONTHS[mMatch[1].toLowerCase()] !== undefined) {
    const m = MONTHS[mMatch[1].toLowerCase()]!;
    let y = mMatch[2] ? parseInt(mMatch[2], 10) : (m <= refM ? refY : refY - 1);
    return {
      start: dayStart(y, m, 1),
      end: dayStart(y, m + 1, 1),
      phrase: mMatch[0],
      index: mMatch.index,
    };
  }

  return null;
}

export function parseTime(query: string, referenceDate: Date = new Date()): TimeRange | null {
  if (typeof query !== "string" || !query.trim()) return null;
  const ref = Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate;
  const refY = ref.getUTCFullYear();
  const refM = ref.getUTCMonth();
  const refD = ref.getUTCDate();
  const refDayEnd = dayEnd(refY, refM, refD);

  // Check since / before / after <date> first
  const modRegex = /\b(since|before|after)\s+/gi;
  let modMatch: RegExpExecArray | null;
  while ((modMatch = modRegex.exec(query)) !== null) {
    const mod = modMatch[1].toLowerCase();
    const afterModIndex = modMatch.index + modMatch[0].length;
    const rest = query.slice(afterModIndex);
    const base = parseBaseDate(rest, ref, true);
    if (base && base.index === 0) {
      const phrase = query.slice(modMatch.index, afterModIndex + base.phrase.length);
      if (mod === "before") {
        return { start: EPOCH_START, end: base.start, phrase };
      }
      if (mod === "after") {
        const end = refDayEnd > base.end ? refDayEnd : FAR_FUTURE;
        return { start: base.end, end, phrase };
      }
      // since
      const end = refDayEnd > base.start ? refDayEnd : FAR_FUTURE;
      return { start: base.start, end, phrase };
    }
  }

  // Direct date phrases (no modifier)
  const direct = parseBaseDate(query, ref, false);
  if (direct) {
    return {
      start: direct.start,
      end: direct.end,
      phrase: direct.phrase,
    };
  }

  return null;
}

export const parseTimeRange = parseTime;
