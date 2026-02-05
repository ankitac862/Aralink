# Transaction Analytics & Tenant-Property Relationship Updates

## Overview
Added two major features to the Aaralink app:

1. **Time-Series Transaction Analytics** - Visual graphs showing 30-day income/expense trends
2. **Tenant-Property Relationship Tracking** - Automatic profile updates when transactions are added

## Features Implemented

### 1. Time-Series Chart Component (`components/TimeSeriesChart.tsx`)
- Interactive line chart showing transaction trends over time
- Displays data with axes, grid lines, and data point circles
- Supports three view types:
  - **Income**: Shows all income transactions
  - **Expense**: Shows all expense transactions  
  - **Net**: Shows net cash flow (income - expense)
- Fully themed for light/dark modes
- Works with last 30 days of transaction data

### 2. Accounting Page Enhancements (`app/accounting.tsx`)
Added new sections:
- **30-Day Trend Chart**: Interactive graph with toggle buttons to switch between Income/Expense/Net views
- **Chart Type Toggle**: Quick buttons to switch between different data views
- **Enhanced State Management**: Now fetches time-series data alongside aggregates

### 3. Database Functions (`lib/supabase.ts`)

#### `getTimeSeriesTransactionData()`
```typescript
Function: getTimeSeriesTransactionData(userId, startDate, endDate, groupBy?)
Purpose: Fetches and aggregates transaction data by date
Returns: Array of TimeSeriesTransactionData with daily/weekly/monthly aggregates
```

#### `getTenantPropertyAssociation()`
```typescript
Function: getTenantPropertyAssociation(propertyId, unitId?, subunitId?)
Purpose: Finds which tenant rented a space and their transaction history
Returns: TenantPropertyAssociation with full ledger details
- Tenant name, email, lease status
- Total rent paid, pending, overdue amounts
- Last payment date
- Transaction count
```

#### `updateTenantProfileWithTransaction()`
```typescript
Function: updateTenantProfileWithTransaction(tenantId, propertyId, unitId?, subunitId?)
Purpose: Auto-updates tenant profile when transaction is added
Auto-called from: createTransaction() when tenant_id is present
Updates:
- property_id
- unit_id & unit_name
- Status (active/inactive based on lease)
- Rent amount (total paid)
```

#### `getTransactionCategorySummary()`
```typescript
Function: getTransactionCategorySummary(userId, startDate, endDate, type?)
Purpose: Aggregates transactions by category for pie/donut charts
Returns: Array with amounts, percentages, and transaction counts per category
```

### 4. Automatic Tenant Profile Updates
When a new transaction is created with `tenant_id`:
1. Transaction is saved to database
2. `updateTenantProfileWithTransaction()` is automatically called
3. Tenant's associated property/unit/subunit info is updated
4. Tenant's active/inactive status is updated based on lease
5. Total rent paid is stored in tenant profile

### 5. Data Types

**TimeSeriesTransactionData**:
- `date`: Transaction date (YYYY-MM-DD, YYYY-MM, or week start)
- `category`: Category of transaction
- `income`: Total income for that period
- `expense`: Total expense for that period
- `netCashFlow`: income - expense

**TenantPropertyAssociation**:
- `tenantId`, `tenantName`, `tenantEmail`
- `propertyId`, `propertyAddress`
- `unitId`, `unitName`, `subunitId`, `subunitName`
- `leaseId`, `leaseStatus`, `leaseStartDate`, `leaseEndDate`
- `totalTransactions`, `totalRentPaid`, `pendingAmount`, `overdueAmount`
- `lastPaymentDate`

**TransactionCategorySummary**:
- `category`: Transaction category
- `type`: 'income' or 'expense'
- `amount`: Total amount in that category
- `percentage`: % of total for that type
- `transactionCount`: Number of transactions

## Usage Examples

### Display Time-Series Chart
```tsx
import TimeSeriesChart from '@/components/TimeSeriesChart';

<TimeSeriesChart
  data={timeSeriesData}  // Array of TimeSeriesTransactionData
  type="net"            // 'income', 'expense', or 'net'
  isDark={isDark}
  height={280}
/>
```

### Check Tenant-Property Association
```tsx
import { getTenantPropertyAssociation } from '@/lib/supabase';

const association = await getTenantPropertyAssociation(propertyId, unitId);
if (association) {
  console.log(`${association.tenantName} rented this property`);
  console.log(`Total paid: $${association.totalRentPaid}`);
  console.log(`Last payment: ${association.lastPaymentDate}`);
}
```

### Create Transaction with Tenant Auto-Update
```tsx
import { createTransaction } from '@/lib/supabase';

const transaction = await createTransaction({
  user_id: landlordId,
  property_id: propertyId,
  unit_id: unitId,
  tenant_id: tenantId,  // Will trigger automatic profile update
  type: 'income',
  category: 'rent',
  amount: 1500,
  date: new Date().toISOString(),
  status: 'paid',
});
```

## SQL Migrations Required

These functions assume the following Supabase tables exist:
- `profiles` - User profiles
- `properties` - Property information
- `units` - Units within properties
- `sub_units` - Subunits/rooms within units
- `leases` - Lease agreements
- `transactions` - Transaction records with user_id, property_id, unit_id, subunit_id, tenant_id
- `tenants` - Tenant records

See `docs/COMPLETE_SETUP_SQL.sql` for full schema.

## UI Changes

### Accounting Page
- New 30-Day Trend section at top
- Chart type toggle buttons (Income/Expense/Net)
- Interactive line chart with hover capability
- Responsive design for mobile and web

## Error Handling
All functions include:
- Try-catch blocks for API failures
- Graceful fallbacks for missing data
- Console warnings for debugging
- Safe null handling for optional fields

## Performance Notes
- Time-series queries fetch paid transactions only
- Data grouped by day/week/month depending on date range
- Chart renders using native SVG for optimal performance
- Auto-update of tenant profiles happens after transaction creation (non-blocking)

## Future Enhancements
- [ ] Export transaction data as CSV/PDF
- [ ] Category-based pie charts
- [ ] Monthly/yearly comparisons
- [ ] Customizable date ranges
- [ ] Expense forecasting
- [ ] Tenant payment reminders
- [ ] Multi-currency support
