"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type ItineraryItem = {
  id: string;
  time: string; // "09:30"
  title: string;
  location: string;
  note: string;
};

type DayPlan = {
  id: string;
  label: string; // "Day 1"
  dateText: string; // "2026/02/04"
  items: ItineraryItem[];
};

type Trip = {
  id: string;
  name: string;
  dateRange: string;
  days: DayPlan[];
  updatedAt: number;
};

const STORAGE_KEY = "trip_planner_v1";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function sortByTime(items: ItineraryItem[]) {
  // robust-ish time sort; empty time goes bottom
  return [...items].sort((a, b) => {
    const ta = a.time?.trim() || "99:99";
    const tb = b.time?.trim() || "99:99";
    return ta.localeCompare(tb);
  });
}

const defaultTrip: Trip = {
  id: uid("trip"),
  name: "我的行程",
  dateRange: "選擇日期區間（之後可做成日曆）",
  updatedAt: Date.now(),
  days: [
    {
      id: uid("day"),
      label: "Day 1",
      dateText: "2026/02/04",
      items: [
        { id: uid("item"), time: "09:30", title: "早餐", location: "附近早餐店", note: "先墊胃，走行程比較有力" },
        { id: uid("item"), time: "11:00", title: "景點", location: "台北 101", note: "上觀景台 / 拍照" },
      ],
    },
    {
      id: uid("day"),
      label: "Day 2",
      dateText: "2026/02/05",
      items: [{ id: uid("item"), time: "10:00", title: "咖啡", location: "咖啡廳", note: "" }],
    },
    {
      id: uid("day"),
      label: "Day 3",
      dateText: "2026/02/06",
      items: [],
    },
  ],
};

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function Page() {
  const [trip, setTrip] = useState<Trip>(defaultTrip);
  const [activeDayId, setActiveDayId] = useState<string>(defaultTrip.days[0]?.id ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // modal fields
  const [fTime, setFTime] = useState("09:00");
  const [fTitle, setFTitle] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fNote, setFNote] = useState("");

  const titleRef = useRef<HTMLInputElement | null>(null);

  // Load from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Trip;
      if (parsed?.days?.length) {
        setTrip(parsed);
        setActiveDayId(parsed.days[0].id);
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
    } catch {
      // ignore
    }
  }, [trip]);

  const activeDay = useMemo(() => {
    return trip.days.find((d) => d.id === activeDayId) ?? trip.days[0];
  }, [trip.days, activeDayId]);

  const activeItems = useMemo(() => sortByTime(activeDay?.items ?? []), [activeDay?.items]);

  function updateTrip(patch: Partial<Trip>) {
    setTrip((t) => ({ ...t, ...patch, updatedAt: Date.now() }));
  }

  function updateDay(dayId: string, updater: (day: DayPlan) => DayPlan) {
    setTrip((t) => ({
      ...t,
      updatedAt: Date.now(),
      days: t.days.map((d) => (d.id === dayId ? updater(d) : d)),
    }));
  }

  function openAddModal() {
    setIsModalOpen(true);
    // reset fields (keep time friendly)
    setFTitle("");
    setFLocation("");
    setFNote("");
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  function closeAddModal() {
    setIsModalOpen(false);
  }

  function addItem() {
    const title = fTitle.trim();
    const location = fLocation.trim();
    if (!title) return;

    const newItem: ItineraryItem = {
      id: uid("item"),
      time: (fTime || "").trim(),
      title,
      location,
      note: fNote.trim(),
    };

    updateDay(activeDay.id, (d) => ({ ...d, items: [...d.items, newItem] }));
    closeAddModal();
  }

  function deleteItem(itemId: string) {
    updateDay(activeDay.id, (d) => ({ ...d, items: d.items.filter((x) => x.id !== itemId) }));
  }

  function moveItem(itemId: string, dir: "up" | "down") {
    updateDay(activeDay.id, (d) => {
      const sorted = sortByTime(d.items);
      const idx = sorted.findIndex((x) => x.id === itemId);
      if (idx < 0) return d;

      const j = dir === "up" ? idx - 1 : idx + 1;
      if (j < 0 || j >= sorted.length) return d;

      const swapped = [...sorted];
      [swapped[idx], swapped[j]] = [swapped[j], swapped[idx]];

      // keep as swapped order (not re-sorted) by injecting a stable pseudo-time trick? we’ll keep order as is:
      // To keep it simple, write back as swapped without sorting.
      return { ...d, items: swapped };
    });
  }

  function addDay() {
    const nextIndex = trip.days.length + 1;
    const newDay: DayPlan = {
      id: uid("day"),
      label: `Day ${nextIndex}`,
      dateText: "（可填日期）",
      items: [],
    };
    setTrip((t) => ({
      ...t,
      updatedAt: Date.now(),
      days: [...t.days, newDay],
    }));
    setActiveDayId(newDay.id);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(trip, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(trip.name || "trip").replaceAll(" ", "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    const fresh = { ...defaultTrip, id: uid("trip"), updatedAt: Date.now() };
    setTrip(fresh);
    setActiveDayId(fresh.days[0]?.id ?? "");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white grid place-items-center shadow-sm">
              <span className="text-sm font-semibold">Trip</span>
            </div>

            <div className="min-w-0 flex-1">
              <input
                value={trip.name}
                onChange={(e) => updateTrip({ name: e.target.value })}
                className="w-full truncate rounded-xl border border-transparent bg-transparent px-2 py-1 text-lg font-semibold outline-none focus:border-slate-200 focus:bg-white"
                placeholder="行程名稱"
              />
              <input
                value={trip.dateRange}
                onChange={(e) => updateTrip({ dateRange: e.target.value })}
                className="w-full truncate rounded-xl border border-transparent bg-transparent px-2 py-1 text-sm text-slate-500 outline-none focus:border-slate-200 focus:bg-white"
                placeholder="例如：2026/02/04 - 2026/02/06"
              />
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={addDay}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 active:scale-[0.99]"
            >
              + 新增一天
            </button>
            <button
              onClick={exportJson}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 active:scale-[0.99]"
            >
              匯出 JSON
            </button>
            <button
              onClick={resetAll}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 active:scale-[0.99]"
            >
              重置
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Days */}
          <section className="lg:sticky lg:top-[76px] lg:h-[calc(100vh-96px)]">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-4">
                <div>
                  <div className="text-sm font-semibold">行程天數</div>
                  <div className="text-xs text-slate-500">點選切換 Day；手機也好滑</div>
                </div>
                <button
                  onClick={addDay}
                  className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99]"
                >
                  + Day
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-col lg:overflow-visible">
                {trip.days.map((d) => {
                  const active = d.id === activeDayId;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setActiveDayId(d.id)}
                      className={clsx(
                        "min-w-[180px] lg:min-w-0 rounded-2xl border px-4 py-3 text-left transition",
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={clsx("font-semibold", active ? "text-white" : "text-slate-900")}>{d.label}</div>
                        <div className={clsx("text-xs", active ? "text-white/80" : "text-slate-500")}>
                          {d.items.length} 項
                        </div>
                      </div>
                      <div className={clsx("mt-1 text-xs", active ? "text-white/80" : "text-slate-500")}>
                        {d.dateText}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-4 pb-4 sm:hidden">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={exportJson}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold shadow-sm"
                  >
                    匯出
                  </button>
                  <button
                    onClick={resetAll}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold shadow-sm"
                  >
                    重置
                  </button>
                  <button
                    onClick={openAddModal}
                    className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm"
                  >
                    + 新增
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold">小提示</div>
              <ul className="mt-2 list-disc pl-5 text-xs text-slate-600 space-y-1">
                <li>卡片的「地點」可直接跳到 Google Maps。</li>
                <li>想更漂亮：下一步加「拖拉排序」「地圖預覽」「AI 自動排程」。</li>
                <li>資料會存在瀏覽器 localStorage（重整不會不見）。</li>
              </ul>
            </div>
          </section>

          {/* Day details */}
          <section>
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3 px-5 py-5">
                <div className="min-w-0">
                  <div className="text-xl font-semibold">{activeDay?.label}</div>
                  <div className="mt-1 text-sm text-slate-500">{activeDay?.dateText}</div>
                </div>

                <button
                  onClick={openAddModal}
                  className="hidden sm:inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99]"
                >
                  + 新增行程
                </button>
              </div>

              <div className="px-5 pb-6">
                {activeItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                    <div className="text-sm font-semibold">今天還沒安排</div>
                    <div className="mt-1 text-xs text-slate-500">按右下角或上方「新增行程」開始</div>
                    <button
                      onClick={openAddModal}
                      className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                    >
                      + 新增第一個行程
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeItems.map((it) => (
                      <div
                        key={it.id}
                        className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex rounded-xl bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                                {it.time || "--:--"}
                              </span>
                              <div className="min-w-0 truncate text-base font-semibold">{it.title}</div>
                            </div>

                            {it.location?.trim() ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                <span className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                                  📍 {it.location}
                                </span>
                                <a
                                  href={mapsSearchUrl(it.location)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:opacity-95"
                                >
                                  在 Google Maps 開啟 →
                                </a>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-slate-400">（未填地點）</div>
                            )}

                            {it.note?.trim() ? (
                              <div className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{it.note}</div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                            <button
                              onClick={() => moveItem(it.id, "up")}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                              title="上移"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveItem(it.id, "down")}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                              title="下移"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => deleteItem(it.id)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                              title="刪除"
                            >
                              刪
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer hint */}
            <div className="mt-4 text-xs text-slate-500">
              最後更新：{new Date(trip.updatedAt).toLocaleString()}
            </div>
          </section>
        </div>
      </main>

      {/* Floating button (mobile) */}
      <button
        onClick={openAddModal}
        className="sm:hidden fixed bottom-5 right-5 z-40 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg active:scale-[0.99]"
      >
        + 新增
      </button>

      {/* Modal */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={closeAddModal}>
          <div
            className="w-full max-w-lg rounded-3xl bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-5 border-b border-slate-200">
              <div className="text-lg font-semibold">新增行程（{activeDay?.label}）</div>
              <div className="mt-1 text-sm text-slate-500">越快越好：先填標題和地點就能出發</div>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs font-semibold text-slate-600 mb-1">時間</div>
                  <input
                    value={fTime}
                    onChange={(e) => setFTime(e.target.value)}
                    type="time"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-slate-600 mb-1">標題（必填）</div>
                  <input
                    ref={titleRef}
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder="例如：吃拉麵 / 逛街 / 看展"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>

              <label className="block">
                <div className="text-xs font-semibold text-slate-600 mb-1">地點</div>
                <input
                  value={fLocation}
                  onChange={(e) => setFLocation(e.target.value)}
                  placeholder="例如：中山站 / 某某餐廳 / 景點名稱"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
                />
                {fLocation.trim() ? (
                  <a
                    href={mapsSearchUrl(fLocation)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                  >
                    在 Google Maps 預覽 → 
                    <span className="opacity-80">{fLocation}</span>
                  </a>
                ) : null}
              </label>

              <label className="block">
                <div className="text-xs font-semibold text-slate-600 mb-1">備註</div>
                <textarea
                  value={fNote}
                  onChange={(e) => setFNote(e.target.value)}
                  placeholder="例如：記得訂位 / 門票 / 交通提醒"
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
            </div>

            <div className="px-5 py-5 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={closeAddModal}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={addItem}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                disabled={!fTitle.trim()}
              >
                新增
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
