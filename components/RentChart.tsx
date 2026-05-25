import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Circle, Svg } from 'react-native-svg';

interface RentChartProps {
  collected: number;
  overdue: number;   // replaces notPaid + pending — truly unpaid amount
  advance: number;   // collected > total: cash paid in advance
  total: number;
}

const RentChart: React.FC<RentChartProps> = ({ collected, overdue, advance, total }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const safeTotal = total > 0 ? total : (collected > 0 ? collected : 1);

  // Cap paid at 100% of total for chart purposes
  const paidPercent = Math.min((collected / safeTotal) * 100, 100);
  const overduePercent = Math.max(0, 100 - paidPercent);

  const greenColor = '#34C759';
  const redColor = '#FF3B30';
  const advanceColor = '#AF52DE'; // purple for cash in advance
  const trackColor = isDark ? '#374151' : '#E5E7EB';

  const formatCurrency = (n: number) =>
    n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartWrapper}>
        <Svg width={160} height={160} viewBox="0 0 36 36" style={styles.svg}>
          {/* Track (full circle — overdue / grey) */}
          <Circle
            cx="18" cy="18" r="15.9154943092"
            stroke={overdue > 0 ? redColor : trackColor}
            strokeWidth="3.5"
            fill="transparent"
          />
          {/* Paid segment (green) */}
          {paidPercent > 0 && (
            <Circle
              cx="18" cy="18" r="15.9154943092"
              stroke={advance > 0 ? advanceColor : greenColor}
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray={`${paidPercent}, 100`}
              strokeDashoffset="0"
            />
          )}
        </Svg>

        <View style={styles.centerTextContainer}>
          <Text style={[styles.centerTextLarge, { color: isDark ? '#F2F2F7' : '#101c22' }]}>
            ${formatCurrency(collected)}
          </Text>
          <Text style={[styles.centerTextSmall, { color: isDark ? '#a0aec0' : '#8E8E93' }]}>
            {advance > 0 ? `+$${formatCurrency(advance)} adv.` : `of $${formatCurrency(total)}`}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  chartWrapper: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  svg: {
    transform: [{ rotate: '-90deg' }],
  },
  centerTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  centerTextLarge: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerTextSmall: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default RentChart;
