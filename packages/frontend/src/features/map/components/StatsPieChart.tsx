'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface BBoxStats {
  total: number;
  asbestos: number;
  potentiallyAsbestos: number;
  clean: number;
  unknown: number;
}

interface StatsPieChartProps {
  stats: BBoxStats;
}

const COLORS = {
  asbestos: '#EF4444',        // red
  potentiallyAsbestos: '#F59E0B', // orange
  unknown: '#6B7280',         // gray
};

export default function StatsPieChart({ stats }: StatsPieChartProps) {
  // Prepare data for pie chart - only non-zero categories
  const data = [
    { name: 'Asbestos', value: stats.asbestos, color: COLORS.asbestos },
    { name: 'Potentially', value: stats.potentiallyAsbestos, color: COLORS.potentiallyAsbestos },
    { name: 'Unknown', value: stats.unknown, color: COLORS.unknown },
  ].filter(item => item.value > 0); // Only show categories with data

  // Custom label to show percentage
  const renderCustomLabel = (entry: any) => {
    const percent = ((entry.value / stats.total) * 100).toFixed(0);
    return `${percent}%`;
  };

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={60}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value} buildings`, '']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '8px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
