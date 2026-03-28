import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/language';
import { STRINGS } from '@/constants/i18n';

const ACTIVE   = '#D97706';
const INACTIVE = '#888888';
const TAB_BG   = '#111111';

export default function TabLayout() {
  const { lang } = useLanguage();
  const t = STRINGS[lang];

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor:   ACTIVE,
      tabBarInactiveTintColor: INACTIVE,
      tabBarStyle: {
        backgroundColor: TAB_BG,
        borderTopColor:  '#222222',
      },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabItems,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: t.tabSubscriptions,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="refresh-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabSettings,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
