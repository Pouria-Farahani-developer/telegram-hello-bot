import type { Bot } from "grammy";
import { isLeapJalaaliYear, j2d, toJalaali } from "jalaali-js";
import type { MyContext } from "../bot.js";

// Persian names for weekdays (indexed by JS Date#getDay(), 0 = Sunday) and months.
export const persianWeekdays = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];
export const persianMonths = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
export const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

// Converts a non-negative integer's digits to their Persian-numeral form.
export const toPersianDigits = (n: number): string =>
  String(n)
    .split("")
    .map((digit) => persianDigits[Number(digit)])
    .join("");

// Length of the text-based year-progress bar, in segments.
export const progressBarLength = 20;

// Builds "██████░░░░"-style bar with `filledCount` of `progressBarLength` segments filled.
export function buildProgressBar(filledCount: number): string {
  return "█".repeat(filledCount) + "░".repeat(progressBarLength - filledCount);
}

// True if the given Gregorian year is a leap year.
export const isLeapGregorianYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// Builds "Today is <Weekday>, <Month> <Day>, <Year>" / Persian equivalent, plus how much
// of the current Jalali and Gregorian years have elapsed, for a given date.
export function formatTodayMessage(date: Date): string {
  const { jy, jm, jd } = toJalaali(date);
  const jalaliLine = `امروز ${persianWeekdays[date.getDay()]}، ${toPersianDigits(jd)} ${persianMonths[jm - 1]} ${toPersianDigits(jy)} است`;

  const gregorianLine = `Today is ${date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  // Jalali year progress, via Julian Day numbers: distance from Farvardin 1st plus one.
  const jalaliDayOfYear = j2d(jy, jm, jd) - j2d(jy, 1, 1) + 1;
  const jalaliTotalDays = isLeapJalaaliYear(jy) ? 366 : 365;
  const jalaliPercent = Math.round((jalaliDayOfYear / jalaliTotalDays) * 100);
  const jalaliFilledCount = Math.round((jalaliPercent / 100) * progressBarLength);
  const jalaliProgressLine = `${toPersianDigits(jalaliPercent)}% از سال ${toPersianDigits(jy)} گذشته است`;

  // Gregorian year progress, via plain Date arithmetic (both dates at local midnight).
  const gy = date.getFullYear();
  const msPerDay = 24 * 60 * 60 * 1000;
  const gregorianDayOfYear =
    Math.round((Date.UTC(gy, date.getMonth(), date.getDate()) - Date.UTC(gy, 0, 1)) / msPerDay) + 1;
  const gregorianTotalDays = isLeapGregorianYear(gy) ? 366 : 365;
  const gregorianPercent = Math.round((gregorianDayOfYear / gregorianTotalDays) * 100);
  const gregorianFilledCount = Math.round((gregorianPercent / 100) * progressBarLength);
  const gregorianProgressLine = `${gregorianPercent}% از سال ${gy} گذشته است`;

  return [
    jalaliLine,
    gregorianLine,
    "",
    jalaliProgressLine,
    buildProgressBar(jalaliFilledCount),
    gregorianProgressLine,
    buildProgressBar(gregorianFilledCount),
  ].join("\n");
}

export function registerTodayHandlers(bot: Bot<MyContext>): void {
  bot.command("today", (ctx) => ctx.reply(formatTodayMessage(new Date())));
  bot.hears("Today", (ctx) => ctx.reply(formatTodayMessage(new Date())));
}
