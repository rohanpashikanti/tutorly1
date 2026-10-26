import React, { useState } from 'react';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  value?: number;
  segments?: Segment[];
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  centerValue?: string;
  centerLabel?: string;
  centerText?: string;
  centerSub?: string;
  color?: string;
  trackColor?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  value,
  segments,
  size = 140,
  strokeWidth = 14,
  label,
  sublabel,
  centerValue,
  centerLabel,
  centerText,
  centerSub,
  color = '#6366F1',
  trackColor = '#F1F5F9',
}) => {
  const displayValue = centerValue || centerText || (value !== undefined ? `${value}%` : label || '');
  const displayLabel = centerLabel || centerSub || sublabel || '';

  if (segments && segments.length > 0) {
    const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let accumulated = 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
        <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="transparent" />
            {segments.map((s, idx) => {
              const strokeLength = (s.value / total) * circumference;
              const rotateAngle = (accumulated / total) * 360;
              accumulated += s.value;

              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                  strokeDashoffset={0}
                  fill="transparent"
                  style={{
                    transformOrigin: `${size / 2}px ${size / 2}px`,
                    transform: `rotate(${rotateAngle}deg)`,
                    transition: 'all 0.5s ease',
                  }}
                />
              );
            })}
          </svg>
          <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none', padding: '0 8px' }}>
            <div style={{ fontSize: size > 160 ? '18px' : '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
              {displayValue}
            </div>
            {displayLabel && (
              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 500, marginTop: '2px' }}>
                {displayLabel}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', justifyContent: 'center', fontSize: '11px' }}>
          {segments.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color }} />
              <span style={{ color: '#475569' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const numericVal = value ?? 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (numericVal / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="transparent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
          {displayValue || `${numericVal}%`}
        </div>
        {displayLabel && (
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500, marginTop: '2px' }}>
            {displayLabel}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Multi-segment Donut Chart ---
interface Segment {
  label: string;
  value: number;
  color: string;
}

export const MultiDonutChart: React.FC<{ segments: Segment[]; size?: number; strokeWidth?: number; centerText?: string; centerSub?: string }> = ({
  segments,
  size = 150,
  strokeWidth = 16,
  centerText,
  centerSub,
}) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#F1F5F9" strokeWidth={strokeWidth} fill="transparent" />
        {segments.map((s, idx) => {
          const strokeLength = (s.value / total) * circumference;
          const strokeOffset = circumference - strokeLength;
          const rotateAngle = (accumulated / total) * 360;
          accumulated += s.value;

          return (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
              strokeDashoffset={0}
              fill="transparent"
              style={{
                transformOrigin: `${size / 2}px ${size / 2}px`,
                transform: `rotate(${rotateAngle}deg)`,
                transition: 'all 0.5s ease',
              }}
            />
          );
        })}
      </svg>
      {centerText && (
        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{centerText}</div>
          {centerSub && <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>{centerSub}</div>}
        </div>
      )}
    </div>
  );
};

interface LineTrendItem {
  label: string;
  line1: number;
  line2?: number;
  bar?: number;
}

interface LineTrendProps {
  data: number[] | LineTrendItem[];
  labels?: string[];
  height?: number;
  lineColor?: string;
  line1Label?: string;
  line2Label?: string;
  barLabel?: string;
}

export const LineTrendChart: React.FC<LineTrendProps> = ({
  data,
  labels,
  height = 200,
  lineColor = '#6366F1',
  line1Label = 'Tuition Tests',
  line2Label,
  barLabel,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Normalize data if passed as array of numbers
  const normalizedData: LineTrendItem[] = Array.isArray(data) && typeof data[0] === 'number'
    ? (data as number[]).map((val, idx) => ({
        label: labels?.[idx] || `${idx + 1}`,
        line1: val,
      }))
    : (data as LineTrendItem[]);

  const maxVal = Math.max(100, ...normalizedData.map((d) => Math.max(d.line1, d.line2 || 0, d.bar || 0)));
  const paddingX = 40;
  const paddingY = 24;
  const chartWidth = 560;
  const chartHeight = height;

  const getX = (index: number) => paddingX + (index / (Math.max(1, normalizedData.length - 1))) * (chartWidth - paddingX * 2);
  const getY = (val: number) => chartHeight - paddingY - (val / maxVal) * (chartHeight - paddingY * 2);

  const pointsLine1 = normalizedData.map((d, i) => `${getX(i)},${getY(d.line1)}`).join(' ');
  const pointsLine2 = line2Label && normalizedData[0]?.line2 !== undefined ? normalizedData.map((d, i) => `${getX(i)},${getY(d.line2 || 0)}`).join(' ') : null;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="#F1F5F9" strokeWidth="1" />
              <text x={paddingX - 10} y={y + 4} fontSize="10" fill="#94A3B8" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Optional Bars under line */}
        {barLabel &&
          normalizedData.map((d, i) => {
            if (d.bar === undefined) return null;
            const x = getX(i) - 12;
            const y = getY(d.bar);
            const bHeight = chartHeight - paddingY - y;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width="24"
                height={Math.max(0, bHeight)}
                rx="4"
                fill="#EEF2FF"
                opacity="0.8"
              />
            );
          })}

        {/* Line 1 Path */}
        <polyline fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pointsLine1} />

        {/* Line 2 Path (if exists) */}
        {pointsLine2 && (
          <polyline fill="none" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" points={pointsLine2} />
        )}

        {/* Points & Hover Area */}
        {normalizedData.map((d, i) => {
          const x = getX(i);
          const y = getY(d.line1);
          const isHovered = hoverIndex === i;

          return (
            <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={isHovered ? 6 : 4} fill="#FFFFFF" stroke={lineColor} strokeWidth="2.5" />
              <text x={x} y={chartHeight - 6} fontSize="11" fill="#64748B" textAnchor="middle" fontWeight={isHovered ? '700' : '500'}>
                {d.label}
              </text>
              {isHovered && (
                <g>
                  <rect x={x - 28} y={y - 30} width="56" height="22" rx="4" fill="#0F172A" />
                  <text x={x} y={y - 15} fill="#FFFFFF" fontSize="11" fontWeight="700" textAnchor="middle">
                    {d.line1}%
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// --- Bar Chart ---
interface BarChartProps {
  data: { label: string; value: number; secondaryValue?: number; color?: string }[];
  height?: number;
  valueFormatter?: (v: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 180,
  valueFormatter = (v) => `${v}%`,
}) => {
  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondaryValue || 0))) * 1.15 || 100;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height, width: '100%', padding: '10px 0 20px' }}>
      {data.map((item, idx) => {
        const heightPct = (item.value / maxVal) * 100;
        const barColor = item.color || '#6366F1';

        return (
          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>{valueFormatter(item.value)}</span>
            <div
              style={{
                width: '100%',
                maxWidth: '42px',
                height: `${heightPct}%`,
                background: `linear-gradient(180deg, ${barColor} 0%, ${barColor}E6 100%)`,
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.4s ease',
              }}
            />
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' }}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
