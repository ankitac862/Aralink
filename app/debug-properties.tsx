import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export default function DebugPropertiesScreen() {
  const { user } = useAuthStore();
  const [properties, setProperties] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDebugData();
  }, [user?.id]);

  const loadDebugData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    
    // Fetch all properties
    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    // Fetch all notifications
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'invite')
      .order('created_at', { ascending: false });
    
    setProperties(props || []);
    setNotifications(notifs || []);
    setLoading(false);
    
    console.log('=== DEBUG DATA ===');
    console.log('Properties:', props?.length);
    console.log('Notifications:', notifs?.length);
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    
    if (error) {
      Alert.alert('Error', 'Failed to delete notification');
    } else {
      Alert.alert('Success', 'Notification deleted');
      loadDebugData();
    }
  };

  const testPropertyExists = async (propertyId: string) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();
    
    if (error) {
      Alert.alert('Property Not Found', `Error: ${error.message}`);
    } else {
      Alert.alert('Property Found', `${data.address1}, ${data.city}`);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Debug: Properties & Notifications
      </Text>
      
      {/* Properties */}
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 }}>
        Your Properties ({properties.length})
      </Text>
      {properties.map((prop) => (
        <View key={prop.id} style={{ 
          padding: 15, 
          backgroundColor: '#f0f0f0', 
          marginBottom: 10,
          borderRadius: 8,
        }}>
          <Text style={{ fontWeight: 'bold' }}>{prop.address1}</Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
            ID: {prop.id}
          </Text>
          <Text style={{ fontSize: 12, color: '#666' }}>
            Created: {new Date(prop.created_at).toLocaleString()}
          </Text>
        </View>
      ))}

      {/* Notifications */}
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 30, marginBottom: 10 }}>
        Invite Notifications ({notifications.length})
      </Text>
      {notifications.map((notif) => {
        const propertyId = notif.data?.propertyId;
        const propertyExists = properties.some(p => p.id === propertyId);
        
        return (
          <View key={notif.id} style={{ 
            padding: 15, 
            backgroundColor: propertyExists ? '#e8f5e9' : '#ffebee', 
            marginBottom: 10,
            borderRadius: 8,
          }}>
            <Text style={{ fontWeight: 'bold' }}>{notif.title}</Text>
            <Text style={{ fontSize: 12, marginTop: 5 }}>
              Property ID: {propertyId || 'none'}
            </Text>
            <Text style={{ fontSize: 12, color: propertyExists ? 'green' : 'red', fontWeight: 'bold' }}>
              Status: {propertyExists ? '✅ Property Exists' : '❌ Property Missing'}
            </Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
              Created: {new Date(notif.created_at).toLocaleString()}
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => testPropertyExists(propertyId)}
                style={{ 
                  backgroundColor: '#2196F3', 
                  padding: 8, 
                  borderRadius: 4,
                  flex: 1,
                }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontSize: 12 }}>
                  Test Property
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Delete Notification',
                    'Are you sure you want to delete this notification?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(notif.id) }
                    ]
                  );
                }}
                style={{ 
                  backgroundColor: '#f44336', 
                  padding: 8, 
                  borderRadius: 4,
                  flex: 1,
                }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontSize: 12 }}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}
