# Data Flow & Architecture Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AARALINK APP (React Native)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Accounting Page (app/accounting.tsx)           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  • Transaction List                                      │   │
│  │  • Income/Expense Toggle                                 │   │
│  │  • Category Filters                                      │   │
│  │  • Mini Bar Chart (last 7 days)                          │   │
│  │  ├─ NEW: 30-Day Trend Chart        ⭐                   │   │
│  │  │  └─ TimeSeriesChart Component                        │   │
│  │  │     • Income View                                     │   │
│  │  │     • Expense View                                    │   │
│  │  │     • Net Cash Flow View                              │   │
│  │  └─ Chart Type Toggle (Income/Expense/Net)              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                       │
│                           ├─→ TimeSeriesChart Component          │
│                           │   (components/TimeSeriesChart.tsx)   │
│                           │   • SVG rendering                    │
│                           │   • Grid lines & axis labels         │
│                           │   • Data point visualization         │
│                           │                                       │
│                           ├─→ NEW: getTimeSeriesTransactionData()│
│                           │   (lib/supabase.ts)                  │
│                           │   • Fetch 30-day data               │
│                           │   • Group by date                    │
│                           │   • Calculate aggregates             │
│                           │                                       │
│                           └─→ NEW: getTenantPropertyAssociation()│
│                               (lib/supabase.ts)                  │
│                               • Find associated tenant            │
│                               • Get lease info                    │
│                               • Calculate totals                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        Supabase Database (PostgreSQL)
        ├─ profiles
        ├─ properties
        ├─ units
        ├─ sub_units
        ├─ leases
        ├─ transactions ◀─ Primary data source
        ├─ tenants
        └─ lease_documents
```

---

## Data Flow: Time-Series Chart

```
User opens Accounting Page
    │
    ├─→ app/accounting.tsx mounts
    │   • Initialize state: timeSeriesData = []
    │   • Initialize state: chartType = 'net'
    │
    ├─→ useEffect hook triggers loadTransactions()
    │
    ├─→ Make 3 parallel API calls:
    │   │
    │   ├─ fetchTransactions(userId)
    │   │  └─ Get all transactions
    │   │
    │   ├─ getTransactionAggregates(userId, startMonth, endMonth)
    │   │  └─ Get current month totals + bar chart data
    │   │
    │   └─ getTimeSeriesTransactionData(userId, 30daysAgo, today) ⭐
    │      │
    │      └─ Query transactions table:
    │         • Filter: user_id = userId, status = 'paid'
    │         • Filter: date BETWEEN 30daysAgo AND today
    │         • Group by DATE
    │         • Calculate SUM(amount) for each date
    │         • Separate into income vs expense
    │         • Return array of daily aggregates
    │
    ├─→ Update state: setTimeSeriesData(data)
    │
    ├─→ Render UI:
    │   │
    │   ├─ "30-Day Trend" Section
    │   │  ├─ Chart Type Toggle (Income/Expense/Net)
    │   │  │
    │   │  └─ TimeSeriesChart Component
    │   │     │
    │   │     ├─ Input: timeSeriesData array
    │   │     ├─ Input: chartType prop
    │   │     │
    │   │     └─ Processing:
    │   │        1. Extract values based on chartType
    │   │           • 'income' → data.map(d => d.income)
    │   │           • 'expense' → data.map(d => d.expense)
    │   │           • 'net' → data.map(d => d.netCashFlow)
    │   │        2. Calculate min/max for scaling
    │   │        3. Calculate x,y coordinates for each point
    │   │        4. Build SVG elements
    │   │           - Grid lines
    │   │           - Axes with labels
    │   │           - Polyline connecting points
    │   │           - Filled polygon under line
    │   │           - Circle markers for data points
    │   │        5. Render SVG
    │   │
    │   └─ User sees beautiful line chart!
    │
    └─→ User clicks chart type toggle
        • setChartType('income' / 'expense' / 'net')
        • Component re-renders with new data
        • No API call needed (data already loaded)
```

---

## Data Flow: Tenant-Property Auto-Update

```
User adds transaction
    │
    ├─→ app/add-transaction.tsx
    │   • Fill: amount, date, category, propertyId, unitId
    │   • Select: tenantId (optional)
    │   • Click "Save Transaction"
    │
    ├─→ Call createTransaction()
    │   │
    │   ├─ Insert into transactions table
    │   │  {user_id, property_id, unit_id, tenant_id, ...}
    │   │
    │   └─ If tenant_id provided:
    │      │
    │      └─ Call updateTenantProfileWithTransaction() ⭐
    │         │
    │         ├─ Call getTenantPropertyAssociation()
    │         │  │
    │         │  ├─ Find active lease
    │         │  ├─ Get tenant details
    │         │  ├─ Get property & unit info
    │         │  └─ Calculate financial totals
    │         │     • Total rent paid
    │         │     • Pending amounts
    │         │     • Overdue amounts
    │         │
    │         └─ UPDATE tenants table
    │            SET property_id, unit_id, unit_name,
    │                status, rent_amount, updated_at
    │
    ├─→ Transaction saved ✓
    ├─→ Tenant profile updated ✓
    │
    └─→ User sees success message
        • Transaction in list
        • Tenant linked to property
        • Profile keeps latest data
```

---

## Key Features Summary

### 🎨 Time-Series Chart
- **30-day transaction trends**
- **3 view modes**: Income / Expense / Net Cash Flow
- **Interactive line chart** with hover capability
- **Professional design** with grid lines and labels
- **Fully responsive** for mobile and web

### 👤 Tenant-Property Tracking
- **Automatic profile updates** when transaction added
- **Query tenant info** with `getTenantPropertyAssociation()`
- **Financial ledger** for each tenant
- **Payment status** tracking (paid/pending/overdue)

### 💾 Database Integration
- **Uses existing tables** (no migrations needed)
- **4 new functions** added
- **3 new interfaces** for type safety
- **Non-blocking auto-updates**

---

## Implementation Checklist

✅ TimeSeriesChart component created
✅ Accounting page updated with chart UI
✅ getTimeSeriesTransactionData() implemented
✅ getTenantPropertyAssociation() implemented
✅ updateTenantProfileWithTransaction() implemented
✅ getTransactionCategorySummary() implemented
✅ createTransaction() auto-update logic added
✅ New TypeScript interfaces defined
✅ Styles added to accounting page
✅ Error handling implemented
✅ Documentation completed
✅ Code verified (no errors)

---

## Ready for Production ✅
