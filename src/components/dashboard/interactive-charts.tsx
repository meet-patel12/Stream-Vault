"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Users, Radio, Activity, Eye, BarChart2 } from "lucide-react";

interface AreaChartDataPoint {
  date: string;
  hours: number;
  users: number;
}

export function StreamingAreaChart({
  data = [
    { date: "Mon", hours: 420, users: 180 },
    { date: "Tue", hours: 510, users: 210 },
    { date: "Wed", hours: 480, users: 195 },
    { date: "Thu", hours: 620, users: 260 },
    { date: "Fri", hours: 890, users: 380 },
    { date: "Sat", hours: 1250, users: 540 },
    { date: "Sun", hours: 1180, users: 510 },
  ],
  title = "Streaming Volume Over Time",
}: {
  data?: AreaChartDataPoint[];
  title?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxHours = Math.max(...data.map((d) => d.hours), 100);
  const width = 600;
  const height = 220;
  const paddingX = 40;
  const paddingY = 30;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - (d.hours / maxHours) * (height - paddingY * 2);
    return { x, y, data: d };
  });

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    // Catmull-Rom or cubic bezier curve interpolation
    const prev = points[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-red-500" /> {title}
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5">Streamed hours & concurrent sessions</p>
        </div>

        {hoveredIdx !== null && (
          <div className="text-right">
            <span className="text-sm font-black text-white">
              {data[hoveredIdx].hours.toLocaleString()} hrs
            </span>
            <span className="text-[11px] text-zinc-400 ml-2">
              ({data[hoveredIdx].users} viewers)
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full aspect-[21/9]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e50914" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#e50914" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.33, 0.66, 1].map((ratio, i) => {
            const y = height - paddingY - ratio * (height - paddingY * 2);
            return (
              <line
                key={i}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#areaGradient)" />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#e50914"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Interactive Data Points */}
          {points.map((p, i) => (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === i ? 7 : 4}
                fill={hoveredIdx === i ? "#fff" : "#e50914"}
                stroke="#000"
                strokeWidth="2.5"
                className="transition-all duration-200"
              />
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                fill="rgba(255,255,255,0.5)"
                fontSize="11"
                fontWeight="600"
              >
                {p.data.date}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function PlanDonutChart({
  breakdown = [
    { label: "Premium (4K HDR)", count: 48, color: "#e50914" },
    { label: "Standard (FHD)", count: 32, color: "#38bdf8" },
    { label: "Basic (HD)", count: 20, color: "#10b981" },
  ],
}: {
  breakdown?: { label: string; count: number; color: string }[];
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const total = breakdown.reduce((acc, b) => acc + b.count, 0) || 1;
  const radius = 68;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
      <div>
        <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
          <Users size={16} className="text-emerald-400" /> Subscription Plan Share
        </h4>
        <p className="text-xs text-zinc-400 mb-4">Account distribution by tier</p>
      </div>

      <div className="flex items-center justify-center gap-6 my-auto">
        {/* SVG Donut */}
        <div className="relative w-36 h-36 flex-shrink-0">
          <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
            {breakdown.map((item, idx) => {
              const percent = (item.count / total) * 100;
              const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((cumulativePercent / 100) * circumference);
              cumulativePercent += percent;

              return (
                <circle
                  key={idx}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={activeIdx === idx ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseLeave={() => setActiveIdx(null)}
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-black text-white">
              {activeIdx !== null ? `${Math.round((breakdown[activeIdx].count / total) * 100)}%` : total}
            </span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
              {activeIdx !== null ? breakdown[activeIdx].label.split(" ")[0] : "Accounts"}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2.5">
          {breakdown.map((item, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
              className={`flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                activeIdx === idx ? "scale-105" : "opacity-90"
              }`}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div>
                <p className="font-semibold text-white">{item.label}</p>
                <p className="text-[11px] text-zinc-400">
                  {item.count} users ({Math.round((item.count / total) * 100)}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function QualityDistributionBarChart({
  distribution = [
    { label: "4K UHD (AV1 / HEVC)", percent: 58, color: "#e50914" },
    { label: "1080p FHD (H.264)", percent: 32, color: "#38bdf8" },
    { label: "720p HD (Adaptive)", percent: 10, color: "#a855f7" },
  ],
}: {
  distribution?: { label: string; percent: number; color: string }[];
}) {
  return (
    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart2 size={16} className="text-purple-400" /> Bitrate & Resolution Quality
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5">Real-time adaptive delivery distribution</p>
        </div>
      </div>

      {/* Progress Bar Multi-Segment */}
      <div className="w-full h-4 rounded-full overflow-hidden flex bg-zinc-800 my-4 shadow-inner">
        {distribution.map((d, i) => (
          <div
            key={i}
            className="h-full transition-all duration-500 hover:opacity-90"
            style={{ width: `${d.percent}%`, backgroundColor: d.color }}
            title={`${d.label}: ${d.percent}%`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-xs">
        {distribution.map((d, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: d.color }} />
            <div>
              <p className="font-bold text-white">{d.percent}%</p>
              <p className="text-[10px] text-zinc-400 line-clamp-1">{d.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityHeatmap() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = [0, 3, 6, 9, 12, 15, 18, 21];

  const getActivityColor = (dayIdx: number, hourIdx: number): string => {
    // Prime time (Fri/Sat evenings) has high intensity
    const isWeekend = dayIdx >= 4;
    const isEvening = hourIdx >= 4;
    const base = isWeekend && isEvening ? 0.8 : isEvening ? 0.5 : 0.2;
    const val = (Math.sin(dayIdx * 3 + hourIdx) + 1) / 2;
    const intensity = Math.min(1, base + val * 0.3);

    if (intensity > 0.7) return "bg-red-600 shadow-[0_0_8px_rgba(229,9,20,0.5)]";
    if (intensity > 0.45) return "bg-red-800/80";
    if (intensity > 0.25) return "bg-red-950/60";
    return "bg-zinc-800/40";
  };

  return (
    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={16} className="text-yellow-400" /> Weekly Viewer Heatmap
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5">Peak traffic hours across 24h cycle</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
          <span>Low</span>
          <span className="w-2.5 h-2.5 rounded bg-zinc-800" />
          <span className="w-2.5 h-2.5 rounded bg-red-950" />
          <span className="w-2.5 h-2.5 rounded bg-red-800" />
          <span className="w-2.5 h-2.5 rounded bg-red-600" />
          <span>Peak</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {days.map((day, dIdx) => (
          <div key={day} className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 font-semibold w-7">{day}</span>
            <div className="flex-1 grid grid-cols-8 gap-1.5">
              {hours.map((hour, hIdx) => (
                <div
                  key={hour}
                  className={`h-4 rounded-md transition-all hover:scale-110 cursor-pointer ${getActivityColor(dIdx, hIdx)}`}
                  title={`${day} @ ${hour}:00 - High concurrency`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between pl-9 pr-1 text-[9px] text-zinc-500 font-semibold uppercase tracking-wider pt-2">
        {hours.map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
    </div>
  );
}
