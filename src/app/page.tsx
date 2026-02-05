"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

type TripEvent = {
  id: string;
  title: string;
  startAt: string; // ISO
  location?: string;
  note?: string;
};

type DayItem = {
  id: string;
  date: string; // YYYY-MM-DD
};

const EVENTS_KEY = "family_trip_events_v2";
const DAYS_KEY = "family_trip_days_v2";

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toYmd(input: string | Date) {
  return dayjs(input).format("YYYY-MM-DD");
}

function loadEvents(): TripEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEvents(events: TripEvent[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

function loadDays(): DayItem[] {
  try {
    const raw = localStorage.getItem(DAYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDays(days: DayItem[]) {
  localStorage.setItem(DAYS_KEY, JSON.stringify(days));
}

function mapsUrl(q?: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || "")}`;
}

export default function Page() {
  // Data
  const [days, setDays] = useState<DayItem[]>([]);
  const [events, setEvents] = useState<TripEvent[]>([]);

  // UI state
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showAdd, setShowAdd] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const now = dayjs();
  const [title, setTitle] = useState("");
  const [dateTime, setDateTime] = useState(now.add(1, "hour").format("YYYY-MM-DDTHH:mm"));
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");

  // init
  useEffect(() => {
    const loadedEvents = loadEvents();
    const loadedDays = loadDays();

    if (loadedDays.length > 0) {
      setDays(loadedDays);
    } else {
      // 預設先建 2 天
      const d1 = toYmd(dayjs());
      const d2 = toYmd(dayjs().add(1, "day"));
      const initialDays: DayItem[] = [
        { id: makeId(), date: d1 },
        { id: makeId(), date: d2 },
      ];
      setDays(initialDays);
      saveDays(initialDays);
    }

    setEvents(loadedEvents);
  }, []);

  const activeDay = days[activeDayIndex];

  // 依日期分組事件
  const eventsByDate = useMemo(() => {
    const map = new Map<string, TripEvent[]>();
    for (const e of events) {
      const key = toYmd(e.startAt);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    for (const [k, list] of map) {
      map.set(
        k,
        [...list].sort((a, b) => (a.startAt > b.startAt ? 1 : -1))
      );
    }
    return map;
  }, [events]);

  const activeEvents = useMemo(() => {
    if (!activeDay) return [];
    return eventsByDate.get(activeDay.date) ?? [];
  }, [activeDay, eventsByDate]);

  function quickAddMinutes(min: number) {
    setDateTime(dayjs().add(min, "minute").format("YYYY-MM-DDTHH:mm"));
  }

  function quickSetTime(h: number, m: number) {
    const base = activeDay ? dayjs(activeDay.date) : dayjs();
    setDateTime(base.hour(h).minute(m).second(0).format("YYYY-MM-DDTHH:mm"));
  }

  function addDay() {
    const nextDate =
      days.length === 0
        ? toYmd(dayjs())
        : toYmd(dayjs(days[days.length - 1].date).add(1, "day"));

    const nextDays = [...days, { id: makeId(), date: nextDate }];
    setDays(nextDays);
    saveDays(nextDays);
    setActiveDayIndex(nextDays.length - 1);
    setToast("已新增一天 ✅");
    setTimeout(() => setToast(null), 1000);
  }

  function resetAll() {
    if (!confirm("確定要重置全部行程嗎？")) return;
    const d1 = toYmd(dayjs());
    const d2 = toYmd(dayjs().add(1, "day"));
    const initialDays: DayItem[] = [
      { id: makeId(), date: d1 },
      { id: makeId(), date: d2 },
    ];

    setDays(initialDays);
    saveDays(initialDays);

    setEvents([]);
    saveEvents([]);

    setActiveDayIndex(0);
    setTitle("");
    setLocation("");
    setNote("");
    setDateTime(dayjs().add(1, "hour").format("YYYY-MM-DDTHH:mm"));

    setToast("已重置");
    setTimeout(() => setToast(null), 1000);
  }

  function exportJson() {
    const payload = {
      days,
      events: [...events].sort((a, b) => (a.startAt > b.startAt ? 1 : -1)),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trip-${dayjs().format("YYYYMMDD-HHmmss")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function addEvent() {
    if (!title.trim()) return;
    if (!activeDay) return;

    const picked = dayjs(dateTime);
    const fixed = dayjs(activeDay.date)
      .hour(picked.hour())
      .minute(picked.minute())
      .second(0);

    const newEvent: TripEvent = {
      id: makeId(),
      title: title.trim(),
      startAt: fixed.toISOString(),
      location: location.trim() || undefined,
      note: note.trim() || undefined,
    };

    const next = [...events, newEvent];
    setEvents(next);
    saveEvents(next);

    setTitle("");
    setLocation("");
    setNote("");
    setShowMore(false);
    setShowTimePicker(false);

    setToast("已新增行程 ✅");
    setTimeout(() => setToast(null), 1000);
  }

  function removeEvent(id: string) {
    const next = events.filter((e) => e.id !== id);
    setEvents(next);
    saveEvents(next);
  }

  return (
    <main className="w-full min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-[480px] px-3 py-3 sm:max-w-[640px] sm:px-4">
        {/* Header */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
              Trip
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-bold leading-tight">我的行程</h1>
              <p className="text-sm text-slate-500">手機版行程規劃</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={addDay}
              className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-medium"
            >
              + 新增一天
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-medium"
            >
              匯出 JSON
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-medium"
            >
              重置
            </button>
          </div>
        </section>

        {/* Day selector */}
        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2">
            <h2 className="text-2xl font-bold">行程天數</h2>
            <p className="text-sm text-slate-500">點選切換 Day；手機也好滑</p>
          </div>

          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2">
            {days.map((d, idx) => {
              const cnt = (eventsByDate.get(d.date) ?? []).length;
              const active = idx === activeDayIndex;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setActiveDayIndex(idx);
                    // 同步時間到該天（保留時分）
                    const t = dayjs(dateTime);
                    setDateTime(dayjs(d.date).hour(t.hour()).minute(t.minute()).format("YYYY-MM-DDTHH:mm"));
                  }}
                  className={`min-w-[180px] rounded-2xl border p-3 text-left transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold">Day {idx + 1}</div>
                    <div className={`text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
                      {cnt} 項
                    </div>
                  </div>
                  <div className={`mt-1 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
                    {dayjs(d.date).format("YYYY/MM/DD")}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Add / Edit panel */}
        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold">
              {activeDay ? `Day ${activeDayIndex + 1}` : "新增行程"}
            </h2>
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium"
            >
              {showAdd ? "收起" : "+ 新增行程"}
            </button>
          </div>
          <p className="text-lg text-slate-500">
            {activeDay ? dayjs(activeDay.date).format("YYYY/MM/DD") : "-"}
          </p>

          {toast && (
            <div className="mt-3 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              {toast}
            </div>
          )}

          {showAdd && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">要做什麼（必填）</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：早餐、景點、集合"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">時間</label>
                  <button
                    type="button"
                    onClick={() => setShowMore((v) => !v)}
                    className="text-sm text-slate-500 underline"
                  >
                    {showMore ? "收起地點/備註" : "更多（地點/備註）"}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => quickAddMinutes(30)} className="rounded-full border border-slate-200 px-3 py-2 text-sm">
                    +30分
                  </button>
                  <button type="button" onClick={() => quickAddMinutes(60)} className="rounded-full border border-slate-200 px-3 py-2 text-sm">
                    +1小時
                  </button>
                  <button type="button" onClick={() => quickSetTime(9, 0)} className="rounded-full border border-slate-200 px-3 py-2 text-sm">
                    09:00
                  </button>
                  <button type="button" onClick={() => quickSetTime(12, 0)} className="rounded-full border border-slate-200 px-3 py-2 text-sm">
                    12:00
                  </button>
                  <button type="button" onClick={() => quickSetTime(18, 0)} className="rounded-full border border-slate-200 px-3 py-2 text-sm">
                    18:00
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTimePicker((v) => !v)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-left"
                >
                  <div className="text-xs text-slate-500">目前時間</div>
                  <div className="text-base font-semibold">{dayjs(dateTime).format("M/D (ddd) HH:mm")}</div>
                </button>

                {showTimePicker && (
                  <div className="mt-2">
                    <input
                      type="datetime-local"
                      value={dateTime}
                      onChange={(e) => setDateTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                    />
                  </div>
                )}
              </div>

              {showMore && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700">地點（選填）</label>
                    <div className="mt-1 flex gap-2">
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="例如：101、碼頭"
                        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                      />
                      <button
                        type="button"
                        onClick={() => window.open(mapsUrl(location), "_blank", "noopener,noreferrer")}
                        className="shrink-0 rounded-xl border border-slate-200 px-3 text-sm"
                      >
                        地圖
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">備註（選填）</label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="例如：要帶什麼、集合點"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                    />
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={addEvent}
                disabled={!title.trim()}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-lg font-semibold text-white disabled:opacity-40"
              >
                一鍵新增
              </button>
            </div>
          )}
        </section>

        {/* Events list */}
        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {activeEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-3xl font-bold text-slate-800">今天還沒安排</p>
              <p className="mt-1 text-slate-500">按上方「新增行程」開始新增</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeEvents.map((e) => (
                <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                        {dayjs(e.startAt).format("HH:mm")}
                      </div>
                      <h3 className="mt-2 text-xl font-bold break-words">{e.title}</h3>

                      {e.location && (
                        <a
                          href={mapsUrl(e.location)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 inline-block rounded-full bg-slate-900 px-3 py-1 text-xs text-white underline"
                        >
                          📍 {e.location}（在 Google Maps 開啟）
                        </a>
                      )}

                      {e.note && <p className="mt-2 text-sm text-slate-600 break-words">{e.note}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeEvent(e.id)}
                      className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            最後更新：{dayjs().format("M/D/YYYY, h:mm:ss A")}
          </p>
        </section>
      </div>
    </main>
  );
}
