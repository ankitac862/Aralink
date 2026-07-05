import React, { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View, Text, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface NavItem {
  name: string;
  label: string;
  icon: string;
  href: string;
}

interface WebNavbarProps {
  items: NavItem[];
  userRole: 'landlord' | 'manager' | 'tenant';
}

// Map navbar icons to SF Symbols (consistent with tab icons)
const NAVBAR_ICON_MAP: Record<string, string> = {
  home: 'house.fill',
  message: 'message.fill',
  bell: 'bell.fill',
  cog: 'gear',
  user: 'person.fill',
};

export function WebNavbar({ items, userRole }: WebNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const windowWidth = Dimensions.get('window').width;

  // Only show on web
  if (Platform.OS !== 'web') {
    return null;
  }

  const isDark = colorScheme === 'dark';
  
  // Enhanced color scheme with better theme support
  const bgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const textPrimaryColor = isDark ? '#FFFFFF' : '#111315';
  const textSecondaryColor = isDark ? '#9BA1A6' : '#6E7377';
  const activeColor = Colors[colorScheme ?? 'light'].tint;
  const inactiveColor = isDark ? '#9BA1A6' : '#6E7377';
  const hoverBgColor = isDark ? '#26282C' : '#E8E8EA';
  
  const isCompactMode = windowWidth < 768;

  const isActive = (href: string) => {
    return pathname.includes(href) || pathname === `/(tabs)/${href}`;
  };

  const handleNavigation = (item: NavItem) => {
    if (item.name === 'dashboard') {
      router.push(
        userRole === 'tenant'
          ? '/(tabs)/tenant-dashboard'
          : '/(tabs)/landlord-dashboard'
      );
    } else {
      router.push(`/(tabs)/${item.href}` as any);
    }
    setIsMenuOpen(false);
  };

  return (
    <View 
      style={[
        styles.navbar, 
        {
          backgroundColor: bgColor, 
          borderBottomColor: borderColor,
          borderBottomWidth: 1,
        }
      ]}
    >
      <View style={[styles.container, isCompactMode && styles.containerCompact]}>
        {/* Logo/Brand */}
        <TouchableOpacity
          style={styles.brand}
          onPress={() => router.push('/(tabs)/landlord-dashboard' as any)}
        >
          <Text style={[styles.brandText, { color: activeColor }]}>◆</Text>
          <Text style={[styles.brandText, { color: textPrimaryColor }]}>Aralink</Text>
        </TouchableOpacity>

        {/* Desktop Nav Items */}
        {!isCompactMode && (
          <View style={styles.navItems}>
            {items.map((item) => {
              const active = isActive(item.href);
              const mappedIcon = NAVBAR_ICON_MAP[item.icon] || 'circle.fill';
              
              return (
                <TouchableOpacity
                  key={item.name}
                  style={[
                    styles.navItem,
                    active && {
                      backgroundColor: activeColor + '15',
                      borderBottomColor: activeColor,
                      borderBottomWidth: 3,
                    },
                  ]}
                  onPress={() => handleNavigation(item)}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    size={20} 
                    name={mappedIcon as any}
                    color={active ? activeColor : inactiveColor}
                    style={styles.navItemIcon}
                  />
                  <Text 
                    style={[
                      styles.navLabel, 
                      { 
                        color: active ? activeColor : textSecondaryColor,
                        fontWeight: active ? '600' : '500',
                      }
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Right Section - Settings + Responsive Menu */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            style={[
              styles.settingsButton,
              {
                backgroundColor: hoverBgColor,
                borderColor: borderColor,
              }
            ]}
            onPress={() => router.push('/(tabs)/settings' as any)}
            activeOpacity={0.7}
          >
            <IconSymbol 
              size={20} 
              name="gear"
              color={textSecondaryColor}
            />
            {!isCompactMode && (
              <Text style={[styles.settingsText, { color: textSecondaryColor }]}>
                Settings
              </Text>
            )}
          </TouchableOpacity>

          {/* Mobile Menu Icon */}
          {isCompactMode && (
            <TouchableOpacity
              style={[styles.menuButton, { backgroundColor: hoverBgColor }]}
              onPress={() => setIsMenuOpen(!isMenuOpen)}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuIcon, { color: textPrimaryColor }]}>
                {isMenuOpen ? '✕' : '☰'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mobile Menu Dropdown */}
      {isCompactMode && isMenuOpen && (
        <View style={[styles.mobileMenu, { backgroundColor: bgColor, borderTopColor: borderColor }]}>
          {items.map((item) => {
            const active = isActive(item.href);
            const mappedIcon = NAVBAR_ICON_MAP[item.icon] || 'circle.fill';
            
            return (
              <TouchableOpacity
                key={item.name}
                style={[
                  styles.mobileMenuItem,
                  active && { backgroundColor: activeColor + '15' },
                ]}
                onPress={() => handleNavigation(item)}
              >
                <IconSymbol 
                  size={18} 
                  name={mappedIcon as any}
                  color={active ? activeColor : textSecondaryColor}
                  style={styles.mobileMenuItemIcon}
                />
                <Text 
                  style={[
                    styles.mobileMenuItemText,
                    { 
                      color: active ? activeColor : textSecondaryColor,
                      fontWeight: active ? '600' : '500',
                    }
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1400,
    marginHorizontal: 'auto',
    width: '100%',
    gap: 24,
  },
  containerCompact: {
    paddingHorizontal: 12,
    gap: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  navItems: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    borderRadius: 4,
    gap: 8,
    transition: 'all 0.2s ease-in-out',
  },
  navItemIcon: {
    width: 20,
    height: 20,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    transition: 'all 0.2s ease-in-out',
  },
  settingsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease-in-out',
  },
  menuIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  mobileMenu: {
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
    gap: 12,
    marginVertical: 4,
  },
  mobileMenuItemIcon: {
    width: 18,
    height: 18,
  },
  mobileMenuItemText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
