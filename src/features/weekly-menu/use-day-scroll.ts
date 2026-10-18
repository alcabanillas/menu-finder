'use client';

import { useEffect, useRef, useState } from 'react';
import type { DayDto } from '@/application/dto/weekly-menu';

type Day = { day: DayDto; date: string };

// The reading band, under the shell's header and the day bar (136 px at most) and above the lower 65 % of the
// viewport: the day crossing it is the day in view (design D2 of MF-69).
const READING_BAND = '-136px 0px -65% 0px';
// A click scrolls through the days in between; the bar ignores them for this long (design D3 of MF-69).
const CLICK_SCROLL_LOCK_MS = 500;

/**
 * The day in view in the continuous scroll of the week, and a way to take the page to a day. On mount the page goes to
 * today's section, only when the week holds today.
 */
export function useDayScroll(days: Day[], today: string): { active: DayDto; goTo: (day: DayDto) => void } {
  const todays = days.find(({ date }) => date === today)?.day;
  const [active, setActive] = useState(todays ?? days[0].day);
  const locked = useRef(false);
  const unlock = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (todays) scrollToSection(todays, 'auto');
  }, [todays]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (locked.current) return;
      const day = dayInView(days, entries);
      if (day) setActive(day);
    }, { rootMargin: READING_BAND });
    observeSections(observer, days);
    return () => {
      observer.disconnect();
      if (unlock.current) clearTimeout(unlock.current);
    };
  }, [days]);

  const goTo = (day: DayDto) => {
    setActive(day);
    locked.current = true;
    if (unlock.current) clearTimeout(unlock.current);
    scrollToSection(day, prefersReducedMotion() ? 'auto' : 'smooth');
    unlock.current = setTimeout(() => {
      locked.current = false;
    }, CLICK_SCROLL_LOCK_MS);
  };

  return { active, goTo };
}

/** The id of a day's section, the target the page scrolls to and the bar watches. */
export function daySectionId(day: DayDto): string {
  return `menu-day-${day}`;
}

function scrollToSection(day: DayDto, behavior: ScrollBehavior) {
  document.getElementById(daySectionId(day))?.scrollIntoView?.({ behavior, block: 'start' });
}

function dayInView(days: Day[], entries: IntersectionObserverEntry[]): DayDto | undefined {
  const entering = entries.find((entry) => entry.isIntersecting);
  return days.find(({ day }) => daySectionId(day) === entering?.target.id)?.day;
}

function observeSections(observer: IntersectionObserver, days: Day[]) {
  days.forEach(({ day }) => {
    const section = document.getElementById(daySectionId(day));
    if (section) observer.observe(section);
  });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
