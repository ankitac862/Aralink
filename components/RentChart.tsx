import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Circle, Svg } from 'react-native-svg';

// Define prop types for the RentChart component
interface RentChartProps {
  collected: number;
  pending: number;
  notPaid: number;
  total: number;
}

const RentChart: React.FC<RentChartProps> = ({ collected, pending, notPaid, total }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Calculate percentages — guard against division by zero (total=0 causes Infinity in SVG which freezes the renderer)
  const safeTotal = total > 0 ? total : 1;
  const collectedPercent = (collected / safeTotal) * 100;
  const pendingPercent = (pending / safeTotal) * 100;
  const notPaidPercent = (notPaid / safeTotal) * 100;
  
  // Calculate stroke-dasharray values
  const collectedDash = collectedPercent;
  const pendingDash = pendingPercent;
  const notPaidDash = notPaidPercent;
  
  // Calculate stroke-dashoffset for positioning
  const pendingOffset = -collectedDash;
  const notPaidOffset = -(collectedDash + pendingDash);
  
  // Colors
  const greenColor = '#34C759'; // Paid
  const yellowColor = '#FFC700'; // Pending
  const blueColor = isDark ? '#1e3a8a' : '#bfdbfe'; // Overdue/Not Paid
  
  // Format numbers with commas
  const formatCurrency = (num: number) => {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };
  
  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartWrapper}>
        <Svg width={160} height={160} viewBox="0 0 36 36" style={styles.svg}>
          {/* Background circle (remaining/not paid) */}
          <Circle
            cx="18"
            cy="18"
            r="15.9154943092"
            stroke={blueColor}
            strokeWidth="3.5"
            fill="transparent"
          />
          {/* Paid segment (green) */}
          <Circle
            cx="18"
            cy="18"
            r="15.9154943092"
            stroke={greenColor}
            strokeWidth="3.5"
            fill="transparent"
            strokeDasharray={`${collectedDash}, 100`}
            strokeDashoffset="0"
          />
          {/* Pending segment (yellow) */}
          <Circle
            cx="18"
            cy="18"
            r="15.9154943092"
            stroke={yellowColor}
            strokeWidth="3.5"
            fill="transparent"
            strokeDasharray={`${pendingDash}, 100`}
            strokeDashoffset={pendingOffset}
          />
        </Svg>
        {/* Centered text */}
        <View style={styles.centerTextContainer}>
          <Text style={[styles.centerTextLarge, { color: isDark ? '#F2F2F7' : '#101c22' }]}>
            ${formatCurrency(collected + pending)}
          </Text>
          <Text style={[styles.centerTextSmall, { color: isDark ? '#a0aec0' : '#8E8E93' }]}>
            out of ${formatCurrency(total)}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Define styles for RentChart
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
