import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer }          from '@react-navigation/native';
import { createNativeStackNavigator }   from '@react-navigation/native-stack';
import { createBottomTabNavigator }     from '@react-navigation/bottom-tabs';
import { SafeAreaProvider }             from 'react-native-safe-area-context';
import { GestureHandlerRootView }       from 'react-native-gesture-handler';
import { Ionicons }                     from '@expo/vector-icons';

import { AuthProvider, useAuth, AUTH_STATE } from './src/context/AuthContext';
import { WalletProvider, useWallet }         from './src/context/WalletContext';
import { COLORS, SHADOWS }                   from './src/utils/theme';

import RegisterScreen          from './src/screens/RegisterScreen';
import SetPinScreen            from './src/screens/SetPinScreen';
import LoginScreen             from './src/screens/LoginScreen';
import LockScreen              from './src/screens/LockScreen';
import HomeScreen              from './src/screens/HomeScreen';
import PocketDetailScreen      from './src/screens/PocketDetailScreen';
import PaymentScreen           from './src/screens/PaymentScreen';
import ReportScreen            from './src/screens/ReportScreen';
import NotificationsScreen     from './src/screens/NotificationsScreen';
import ScheduledPaymentsScreen from './src/screens/ScheduledPaymentsScreen';
import SchedulePaymentScreen   from './src/screens/SchedulePaymentScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabNavigator() {
  const { unreadCount, schedulesToday } = useWallet();
  const schedBadge = schedulesToday?.length || 0;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home:          focused ? 'wallet'          : 'wallet-outline',
            Scheduled:     focused ? 'calendar-number' : 'calendar-number-outline',
            Report:        focused ? 'bar-chart'       : 'bar-chart-outline',
            Notifications: focused ? 'notifications'   : 'notifications-outline',
          };
          return <Ionicons name={icons[route.name]} size={24} color={color} />;
        },
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor:'#FFFFFF', borderTopWidth:0, paddingTop:6, paddingBottom:10, height:65, ...SHADOWS.lg },
        tabBarLabelStyle: { fontSize:11, fontWeight:'600' },
        headerStyle:      { backgroundColor:COLORS.background, shadowColor:'transparent', elevation:0 },
        headerTitleStyle: { fontSize:18, fontWeight:'800', color:COLORS.text },
      })}
    >
      <Tab.Screen name="Home"      component={HomeScreen}              options={{ headerShown:false, title:'Wallet' }} />
      <Tab.Screen name="Scheduled" component={ScheduledPaymentsScreen} options={{ headerShown:false, title:'Scheduled', tabBarBadge: schedBadge>0?schedBadge:undefined, tabBarBadgeStyle:{ backgroundColor:'#7C3AED', fontSize:10 } }} />
      <Tab.Screen name="Report"    component={ReportScreen}            options={{ title:'Monthly Report' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title:'Alerts', tabBarBadge:unreadCount>0?unreadCount:undefined, tabBarBadgeStyle:{ backgroundColor:COLORS.danger, fontSize:10 } }} />
    </Tab.Navigator>
  );
}

function AppStack() {
  const hdr = {
    headerShown:true, headerBackTitle:'Back',
    headerStyle:{ backgroundColor:COLORS.background }, headerShadowVisible:false,
    headerTitleStyle:{ fontSize:17, fontWeight:'700' }, headerTintColor:COLORS.primary,
  };
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="Tabs"           component={TabNavigator} />
      <Stack.Screen name="PocketDetail"   component={PocketDetailScreen}      options={{ ...hdr, title:'Pocket' }} />
      <Stack.Screen name="Payment"        component={PaymentScreen}           options={({ route }) => { const t={ 'upi-qr':'Scan QR','upi-phone':'UPI Phone','upi-id':'UPI ID',bank:'Bank Transfer',razorpay:'Razorpay' }; return { ...hdr, title:t[route.params?.paymentType]||'Pay' }; }} />
      <Stack.Screen name="SchedulePayment" component={SchedulePaymentScreen} options={({ route }) => ({ ...hdr, title: route.params?.scheduleId?'Edit Schedule':'Schedule Payment' })} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { authState } = useAuth();

  if (authState === AUTH_STATE.LOADING) {
    return (
      <View style={{ flex:1, backgroundColor:'#0D0D1A', alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown:false, animation:'fade' }}>
        {authState === AUTH_STATE.REGISTER && <Stack.Screen name="Register" component={RegisterScreen} />}
        {authState === AUTH_STATE.SET_PIN  && <Stack.Screen name="SetPin"   component={SetPinScreen}   />}
        {authState === AUTH_STATE.LOGIN    && <Stack.Screen name="Login"    component={LoginScreen}    />}
        {authState === AUTH_STATE.LOCK     && <Stack.Screen name="Lock"     component={LockScreen}     />}
        {authState === AUTH_STATE.APP      && <Stack.Screen name="App"      component={AppStack}       />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex:1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <WalletProvider>
            <RootNavigator />
          </WalletProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
