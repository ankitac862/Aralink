import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { ThemedText } from './themed-text';

export interface ChartDataPoint {
  date: string;
  income: number;
  expense: number;
  netCashFlow: number;
}

interface TimeSeriesChartProps {
  data: ChartDataPoint[];
  type?: 'income' | 'expense' | 'net';
  isDark?: boolean;
  height?: number;
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  type = 'net',
  isDark = false,
  height = 250,
}) => {
  const screenWidth = Dimensions.get('window').width - 40; // Account for padding
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = screenWidth - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <ThemedText style={{ textAlign: 'center', marginTop: height / 2 }}>
          No data available
        </ThemedText>
      </View>
    );
  }

  // Get values to display based on type
  const getValues = () => {
    if (type === 'income') return data.map(d => d.income);
    if (type === 'expense') return data.map(d => d.expense);
    return data.map(d => d.netCashFlow);
  };

  const values = getValues();
  const maxValue = Math.max(...values, 1); // At least 1 to avoid division by zero
  const minValue = Math.min(...values, 0); // Include 0 for context
  const range = maxValue - minValue;

  // Calculate points for the line chart
  const points = values.map((value, index) => {
    const x = padding.left + (index / (values.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((value - minValue) / (range || 1)) * chartHeight;
    return { x, y, value };
  });

  // Create polyline path string
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Colors based on theme and type
  const getLineColor = () => {
    if (type === 'income') return '#16A34A';
    if (type === 'expense') return '#DC2626';
    return '#137fec';
  };

  const lineColor = getLineColor();
  const axisColor = isDark ? '#475569' : '#cbd5e1';
  const textColor = isDark ? '#e0e6ed' : '#0d141b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  // Format date label (show every 2nd date to avoid crowding)
  const getDateLabel = (dateStr: string, index: number) => {
    if (data.length <= 4 || index % Math.ceil(data.length / 4) === 0) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return '';
  };

  // Create grid lines
  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const yValue = minValue + (range / 4) * i;
    const y = padding.top + chartHeight - (i / 4) * chartHeight;
    gridLines.push({
      y,
      label: yValue.toLocaleString('en-US', { maximumFractionDigits: 0 }),
    });
  }

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={screenWidth} height={height} viewBox={`0 0 ${screenWidth} ${height}`}>
        <Defs>
          <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {gridLines.map((grid, index) => (
          <Line
            key={`grid-${index}`}
            x1={padding.left}
            y1={grid.y}
            x2={screenWidth - padding.right}
            y2={grid.y}
            stroke={gridColor}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y-axis */}
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke={axisColor}
          strokeWidth={2}
        />

        {/* X-axis */}
        <Line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={screenWidth - padding.right}
          y2={padding.top + chartHeight}
          stroke={axisColor}
          strokeWidth={2}
        />

        {/* Y-axis labels */}
        {gridLines.map((grid, index) => (
          <SvgText
            key={`label-${index}`}
            x={padding.left - 10}
            y={grid.y + 4}
            fontSize={10}
            fill={textColor}
            textAnchor="end"
          >
            ${grid.label}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {data.map((point, index) => {
          const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
          const label = getDateLabel(point.date, index);
          return label ? (
            <SvgText
              key={`x-label-${index}`}
              x={x}
              y={padding.top + chartHeight + 20}
              fontSize={10}
              fill={textColor}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          ) : null;
        })}

        {/* Filled area under the line (polygon) */}
        {points.length > 1 && (
          <Polygon
            points={`${points[0].x},${points[0].y} ${polylinePoints} ${points[points.length - 1].x},${
              padding.top + chartHeight
            } ${points[0].x},${padding.top + chartHeight}`}
            fill={lineColor}
            opacity={0.1}
          />
        )}

        {/* Line chart */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={lineColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data point circles */}
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r={5}
            fill={lineColor}
            stroke={isDark ? '#101922' : '#ffffff'}
            strokeWidth={2}
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
});

export default TimeSeriesChart;
