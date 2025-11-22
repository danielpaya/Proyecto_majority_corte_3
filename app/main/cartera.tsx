import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedButton } from '@/components/themed-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '../../utils/supabase';
import { FabChat } from '@/components/FabChat';

type SubscriptionPlan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cop: number;
  duration_days: number;
  features: string[] | null;
};

export default function CarteraScreen() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [addingMoney, setAddingMoney] = useState(false);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  const loadWalletData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Cargar balance de la cartera
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', profile.id)
        .single();

      if (!profileError && profileData) {
        setWalletBalance(Number(profileData.wallet_balance) || 0);
      }

      // Cargar planes de suscripción
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('active', true)
        .order('price_cop', { ascending: true });

      if (!plansError && plansData) {
        const formattedPlans = plansData.map((plan) => ({
          ...plan,
          features: (plan.features as any) || [],
        }));
        setPlans(formattedPlans);
      }
    } catch (error) {
      console.error('[Cartera] Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const handleAddMoney = useCallback(async () => {
    const amount = parseFloat(amountInput.replace(/[^0-9.]/g, ''));
    
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    if (amount > 10000000) {
      Alert.alert('Error', 'El monto máximo es $10,000,000 COP');
      return;
    }

    // Validar datos de tarjeta (simulado)
    if (!cardNumber || cardNumber.length < 16) {
      Alert.alert('Error', 'Ingresa un número de tarjeta válido (16 dígitos)');
      return;
    }

    if (!cardName.trim()) {
      Alert.alert('Error', 'Ingresa el nombre del titular');
      return;
    }

    if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      Alert.alert('Error', 'Ingresa una fecha de expiración válida (MM/AA)');
      return;
    }

    if (!cardCvv || cardCvv.length < 3) {
      Alert.alert('Error', 'Ingresa un CVV válido');
      return;
    }

    try {
      setAddingMoney(true);

      // Simular procesamiento de pago (esperar 1.5 segundos)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Llamar a la función SQL para agregar dinero
      const { error } = await supabase.rpc('add_wallet_balance', {
        p_user_id: profile?.id,
        p_amount: amount,
        p_description: 'Depósito simulado desde tarjeta',
      });

      if (error) throw error;

      Alert.alert('Éxito', `Se agregaron $${amount.toLocaleString('es-CO')} COP a tu cartera`);
      
      // Limpiar formulario
      setAmountInput('');
      setCardNumber('');
      setCardName('');
      setCardExpiry('');
      setCardCvv('');
      setShowAddMoney(false);

      // Recargar datos
      await loadWalletData();
      await refreshProfile();
    } catch (error: any) {
      console.error('[Cartera] Error agregando dinero:', error);
      Alert.alert('Error', error.message || 'No se pudo agregar el dinero');
    } finally {
      setAddingMoney(false);
    }
  }, [amountInput, cardNumber, cardName, cardExpiry, cardCvv, profile?.id, loadWalletData, refreshProfile]);

  const handleSubscribe = useCallback(async (planId: string, planName: string, price: number) => {
    if (walletBalance < price) {
      Alert.alert(
        'Saldo insuficiente',
        `Necesitas $${price.toLocaleString('es-CO')} COP pero tienes $${walletBalance.toLocaleString('es-CO')} COP en tu cartera.`
      );
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Confirmar suscripción',
        `¿Deseas suscribirte al plan ${planName} por $${price.toLocaleString('es-CO')} COP?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirmar', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    try {
      setProcessingPayment(planId);

      // Simular procesamiento (esperar 1.5 segundos)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Llamar a la función SQL para procesar el pago
      const { data, error } = await supabase.rpc('process_subscription_payment', {
        p_user_id: profile?.id,
        p_plan_id: planId,
      });

      if (error) throw error;

      const result = data as any;
      
      if (!result.success) {
        Alert.alert('Error', result.message || 'No se pudo procesar el pago');
        return;
      }

      Alert.alert(
        '¡Suscripción activada!',
        `Tu plan ${planName} está activo. Nuevo saldo: $${result.new_balance.toLocaleString('es-CO')} COP`
      );

      // Recargar datos
      await loadWalletData();
      await refreshProfile();
    } catch (error: any) {
      console.error('[Cartera] Error procesando pago:', error);
      Alert.alert('Error', error.message || 'No se pudo procesar el pago');
    } finally {
      setProcessingPayment(null);
    }
  }, [walletBalance, profile?.id, loadWalletData, refreshProfile]);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '').replace(/\D/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19);
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
          <ThemedText style={styles.loadingText}>Cargando cartera...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? Colors.dark.text : Colors.light.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>Mi Cartera</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Balance de cartera */}
        <ThemedView
          style={[styles.balanceCard, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
          lightColor="#f9f9f9"
          darkColor="#1a1a2e">
          <ThemedText style={styles.balanceLabel}>Saldo disponible</ThemedText>
          <ThemedText type="title" style={[styles.balanceAmount, { color: isDark ? '#4a9eff' : '#0a7aff' }]}>
            ${walletBalance.toLocaleString('es-CO')} COP
          </ThemedText>
          <ThemedButton
            title="Agregar dinero"
            onPress={() => setShowAddMoney(true)}
            highlight={false}
            style={{ marginTop: 16 }}
          />
        </ThemedView>

        {/* Formulario para agregar dinero */}
        {showAddMoney && (
          <ThemedView
            style={[styles.addMoneyCard, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
            lightColor="#ffffff"
            darkColor="#121224">
            <View style={styles.addMoneyHeader}>
              <ThemedText type="subtitle" style={styles.addMoneyTitle}>Agregar dinero</ThemedText>
              <TouchableOpacity onPress={() => setShowAddMoney(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? Colors.dark.text : Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.inputLabel}>Monto (COP)</ThemedText>
            <TextInput
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Ej: 50000"
              placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
              value={amountInput}
              onChangeText={(text) => setAmountInput(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />

            <ThemedText style={styles.inputLabel}>Número de tarjeta (simulado)</ThemedText>
            <TextInput
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
              value={cardNumber}
              onChangeText={(text) => setCardNumber(formatCardNumber(text))}
              keyboardType="numeric"
              maxLength={19}
            />

            <ThemedText style={styles.inputLabel}>Nombre del titular</ThemedText>
            <TextInput
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Nombre completo"
              placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
              value={cardName}
              onChangeText={setCardName}
            />

            <View style={styles.cardRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <ThemedText style={styles.inputLabel}>Vencimiento</ThemedText>
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="MM/AA"
                  placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
                  value={cardExpiry}
                  onChangeText={(text) => setCardExpiry(formatExpiry(text))}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <ThemedText style={styles.inputLabel}>CVV</ThemedText>
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="123"
                  placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
                  value={cardCvv}
                  onChangeText={(text) => setCardCvv(text.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>

            <ThemedButton
              title={addingMoney ? 'Procesando...' : 'Agregar dinero'}
              onPress={handleAddMoney}
              loading={addingMoney}
              disabled={addingMoney}
              style={{ marginTop: 16 }}
            />
          </ThemedView>
        )}

        {/* Planes de suscripción */}
        <ThemedText type="subtitle" style={styles.plansTitle}>Planes de suscripción</ThemedText>
        
        {plans.map((plan) => {
          const canAfford = walletBalance >= plan.price_cop;
          const isProcessing = processingPayment === plan.id;
          
          return (
            <ThemedView
              key={plan.id}
              style={[styles.planCard, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
              lightColor="#fafafa"
              darkColor="#1a1a2e">
              <View style={styles.planHeader}>
                <ThemedText type="defaultSemiBold" style={styles.planName}>{plan.name}</ThemedText>
                <ThemedText type="title" style={[styles.planPrice, { color: isDark ? '#4a9eff' : '#0a7aff' }]}>
                  ${plan.price_cop.toLocaleString('es-CO')} COP
                </ThemedText>
              </View>
              
              {plan.description && (
                <ThemedText style={styles.planDescription}>{plan.description}</ThemedText>
              )}

              {plan.features && plan.features.length > 0 && (
                <View style={styles.featuresList}>
                  {plan.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <MaterialIcons name="check-circle" size={16} color={isDark ? '#4a9eff' : '#0a7aff'} />
                      <ThemedText style={styles.featureText}>{feature}</ThemedText>
                    </View>
                  ))}
                </View>
              )}

              <ThemedButton
                title={
                  plan.price_cop === 0
                    ? 'Plan actual'
                    : canAfford
                    ? isProcessing
                      ? 'Procesando...'
                      : 'Suscribirse'
                    : 'Saldo insuficiente'
                }
                onPress={() => plan.price_cop > 0 && handleSubscribe(plan.id, plan.name, plan.price_cop)}
                disabled={plan.price_cop === 0 || !canAfford || isProcessing}
                loading={isProcessing}
                highlight={plan.price_cop > 0 && canAfford}
                style={{ marginTop: 12 }}
              />
            </ThemedView>
          );
        })}
      </ScrollView>
      <FabChat />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  addMoneyCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  addMoneyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addMoneyTitle: {
    fontSize: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 48,
  },
  inputLight: {
    borderColor: '#d5d8e3',
    backgroundColor: '#ffffff',
    color: '#1c1c1c',
  },
  inputDark: {
    borderColor: '#2a2a3e',
    backgroundColor: '#0d0f1f',
    color: '#f4f4f4',
  },
  cardRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  plansTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  planCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  planDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
  },
  featuresList: {
    gap: 8,
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
});

