const fs = require('fs');
const file = 'app/(tabs)/tenant-dashboard.tsx';
let data = fs.readFileSync(file, 'utf8');

const target = `        loadNotifications();
        loadTenantData();
      }
    }, [user])
  );`;

const replacement = `        loadNotifications();
        loadTenantData();
        loadPendingLeases();
      }
    }, [user])
  );

  const loadPendingLeases = async () => {
    if (!user?.id) return;
    try {
      const leases = await fetchLeasesByTenant(user.id);
      if (leases) {
        // Find leases that are generated or sent to the tenant but not signed yet
        const pending = leases.filter(l => l.status === 'sent' || l.status === 'generated' || l.status === 'pending_signature');
        setPendingLeases(pending);
      }
    } catch (err) {
      console.error('Error loading pending leases:', err);
    }
  };`;

data = data.replace(target, replacement);
fs.writeFileSync(file, data);
