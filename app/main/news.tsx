import { useCustomAlert } from '@/components/CustomAlert';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { FabChat } from '@/components/FabChat';

type PriorityLevel = 'alta' | 'media' | 'baja';
type StatusFilter = 'all' | 'published' | 'draft' | 'expired';

const PRIORITY_OPTIONS: PriorityLevel[] = ['alta', 'media', 'baja'];
const STATUS_FILTERS: Array<{ key: StatusFilter; label: string; adminOnly?: boolean }> = [
  { key: 'all', label: 'Todas' },
  { key: 'published', label: 'Publicadas' },
  { key: 'draft', label: 'Borradores' },
  { key: 'expired', label: 'Caducadas', adminOnly: true },
];
const PRIORITY_BADGE_STYLES: Record<PriorityLevel, { backgroundColor: string; textColor: string }> = {
  alta: { backgroundColor: '#fee2e2', textColor: '#991b1b' },
  media: { backgroundColor: '#fef9c3', textColor: '#92400e' },
  baja: { backgroundColor: '#dcfce7', textColor: '#065f46' },
};
const EXPIRATION_PRESETS: Array<{ label: string; days: number | null }> = [
  { label: 'Sin caducidad', days: null },
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
];
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const isNewsExpired = (entry: { expires_at?: string | null }) => {
  if (!entry.expires_at) return false;
  const expires = new Date(entry.expires_at).getTime();
  if (Number.isNaN(expires)) return false;
  return expires <= Date.now();
};
const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sin caducidad';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 'Sin caducidad';
  return dt.toLocaleString();
};
const normalizeExpirationInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(' ', 'T');
  const dateValue = new Date(normalized);
  if (Number.isNaN(dateValue.getTime())) return null;
  return dateValue.toISOString();
};
const formatPresetDate = (days: number) => {
  const base = new Date();
  base.setDate(base.getDate() + days);
  // YYYY-MM-DD HH:mm (without seconds for easier editing)
  return base.toISOString().replace('T', ' ').slice(0, 16);
};

type NewsItem = {
  id: string;
  title: string;
  content: string;
  image_url?: string | null;
  category?: string | null;
  priority?: PriorityLevel | null;
  is_published: boolean;
  published_at?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

export default function NewsScreen() {
  const { profile, refreshProfile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';
  const alert = useCustomAlert();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');

  // form state for admin
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publish, setPublish] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [priority, setPriority] = useState<PriorityLevel>('media');
  const [expiresAtInput, setExpiresAtInput] = useState('');
  const [readStatus, setReadStatus] = useState<Record<string, string>>({});
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const unreadCount = useMemo(() => {
    return news.reduce((acc, item) => {
      if (!item.id) return acc;
      if (!item.is_published) return acc;
      if (isNewsExpired(item)) return acc;
      return readStatus[item.id] ? acc : acc + 1;
    }, 0);
  }, [news, readStatus]);

  useEffect(() => {
    fetchNews();
  }, [isAdmin, profile?.id]);

  useEffect(() => {
    if (!isAdmin && selectedStatus === 'expired') {
      setSelectedStatus('all');
    }
  }, [isAdmin, selectedStatus]);

  useEffect(() => {
    if (isAdmin && showOnlyUnread) {
      setShowOnlyUnread(false);
    }
  }, [isAdmin, showOnlyUnread]);

  const handleExpirationPreset = (days: number | null) => {
    if (days === null) {
      setExpiresAtInput('');
      return;
    }
    setExpiresAtInput(formatPresetDate(days));
  };

  async function fetchReadStatuses(ids: string[]) {
    if (!profile?.id || ids.length === 0) {
      setReadStatus({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('news_reads')
        .select('news_id, read_at')
        .eq('user_id', profile.id)
        .in('news_id', ids);
      if (error) {
        console.warn('fetchReadStatuses', error);
        return;
      }
      const next: Record<string, string> = {};
      (data ?? []).forEach((row: any) => {
        if (row.news_id) {
          next[row.news_id] = row.read_at ?? '';
        }
      });
      setReadStatus(next);
    } catch (error) {
      console.warn('fetchReadStatuses', error);
    }
  }

  async function fetchNews() {
    if (!refreshing) setLoading(true);
    try {
      let query = supabase.from('news').select('*').order('created_at', { ascending: false, nullsFirst: false });
      // si no es admin, solo mostrar noticias publicadas
      if (!isAdmin) {
        query = (query as any).eq('is_published', true);
      }
      const { data, error } = await (query as any);
      if (error) {
        console.warn('fetchNews error', error);
        setNews([]);
        setCategories([]);
      } else {
        const rows = (data as any) ?? [];
        setNews(rows);
        // collect categories present in the returned rows (as strings)
        const cats = Array.from(new Set((rows as any).map((r: any) => r.category).filter(Boolean))).map(String);
        setCategories(cats);
        const ids = rows.map((r: any) => r.id).filter(Boolean);
        await fetchReadStatuses(ids);
      }
    } catch (e) {
      console.warn('fetchNews', e);
      setNews([]);
      setReadStatus({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshProfile();
    await fetchNews();
  }, [refreshProfile]);

  async function handleCreate() {
    if (!isAdmin) return;
    if (!title.trim() || !content.trim()) {
      await alert.show({ title: 'Datos incompletos', message: 'Título y contenido son obligatorios', buttons: [{ text: 'OK' }] });
      return;
    }
    setSaving(true);
    try {
      const expiresAtIso = normalizeExpirationInput(expiresAtInput);
      if (expiresAtInput.trim() && !expiresAtIso) {
        await alert.show({ title: 'Fecha invalida', message: 'Usa el formato YYYY-MM-DD HH:mm para la caducidad.', buttons: [{ text: 'OK' }] });
        return;
      }
      if (expiresAtIso && new Date(expiresAtIso).getTime() <= Date.now()) {
        await alert.show({ title: 'Caducidad invalida', message: 'Configura una fecha futura o deja vacio para no caducar.', buttons: [{ text: 'OK' }] });
        return;
      }
      const row = {
        title: title.trim(),
        content: content.trim(),
        image_url: imageUrl.trim() || null,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
        created_by: profile?.id ?? null,
        priority,
        created_at: new Date().toISOString(),
        expires_at: expiresAtIso,
      };
      const { error } = await supabase.from('news').insert(row);
      if (error) {
        await alert.show({ title: 'Error', message: 'No se pudo crear la noticia.', buttons: [{ text: 'OK' }] });
        console.warn('create news error', error);
      } else {
        setTitle('');
        setContent('');
        setImageUrl('');
        setPublish(false);
        setPriority('media');
        setExpiresAtInput('');
        await fetchNews();
      }
    } catch (e) {
      console.warn('handleCreate', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: NewsItem) {
    if (!isAdmin) return;
    const idx = await alert.show({
      title: 'Eliminar noticia',
      message: '¿Seguro que quieres eliminar esta noticia?',
      buttons: [ { text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive' } ]
    });
    if (idx === 1) {
      const { error } = await supabase.from('news').delete().eq('id', item.id);
      if (error) {
        await alert.show({ title: 'Error', message: 'No se pudo eliminar', buttons: [{ text: 'OK' }] });
      } else {
        fetchNews();
      }
    }
  }

  async function toggleReadStatus(item: NewsItem, shouldMarkRead: boolean) {
    if (!profile?.id) return;
    setMarkingReadId(item.id);
    try {
      if (shouldMarkRead) {
        const payload = {
          user_id: profile.id,
          news_id: item.id,
          read_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('news_reads').upsert(payload, { onConflict: 'user_id,news_id' });
        if (error) {
          console.warn('toggleReadStatus', error);
        } else {
          setReadStatus((prev) => ({ ...prev, [item.id]: payload.read_at }));
        }
      } else {
        const { error } = await supabase.from('news_reads').delete().eq('user_id', profile.id).eq('news_id', item.id);
        if (error) {
          console.warn('toggleReadStatus', error);
        } else {
          setReadStatus((prev) => {
            const next = { ...prev };
            delete next[item.id];
            return next;
          });
        }
      }
    } catch (error) {
      console.warn('toggleReadStatus', error);
    } finally {
      setMarkingReadId(null);
    }
  }

  async function togglePublish(item: NewsItem) {
    if (!isAdmin) return;
    const { error } = await supabase.from('news').update({ is_published: !item.is_published, published_at: !item.is_published ? new Date().toISOString() : null }).eq('id', item.id);
    if (error) {
      await alert.show({ title: 'Error', message: 'No se pudo actualizar el estado', buttons: [{ text: 'OK' }] });
    } else {
      fetchNews();
    }
  }

  function renderItem({ item }: { item: NewsItem }) {
    const createdLabel = item.created_at ? new Date(item.created_at).toLocaleString() : 'Sin registro';
    const publishedLabel = item.is_published && item.published_at ? new Date(item.published_at).toLocaleString() : null;
    const expired = isNewsExpired(item);
    const expiresLabel = item.expires_at ? formatDateTime(item.expires_at) : 'Sin caducidad';
    const isRead = Boolean(readStatus[item.id]);
    const readAt = readStatus[item.id] ? new Date(readStatus[item.id]).toLocaleString() : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.cardBadges}>
            {item.priority ? (
              <View style={[styles.badge, { backgroundColor: PRIORITY_BADGE_STYLES[item.priority].backgroundColor }]}>
                <Text style={[styles.badgeText, { color: PRIORITY_BADGE_STYLES[item.priority].textColor }]}>
                  {`Prioridad ${capitalize(item.priority)}`}
                </Text>
              </View>
            ) : null}
            <View style={[styles.badge, item.is_published ? styles.badgePublished : styles.badgeDraft]}>
              <Text style={[styles.badgeText, item.is_published ? styles.badgePublishedText : styles.badgeDraftText]}>
                {item.is_published ? 'Publicada' : 'Borrador'}
              </Text>
            </View>
            {expired ? (
              <View style={[styles.badge, styles.badgeExpired]}>
                <Text style={[styles.badgeText, styles.badgeExpiredText]}>Caducada</Text>
              </View>
            ) : null}
            {!isAdmin && profile?.id ? (
              <View style={[styles.badge, isRead ? styles.badgeRead : styles.badgeUnread]}>
                <Text style={[styles.badgeText, isRead ? styles.badgeReadText : styles.badgeUnreadText]}>
                  {isRead ? 'Leida' : 'No leida'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text style={styles.cardMeta}>Creada: {createdLabel}</Text>
        <Text style={styles.cardMeta}>
          {item.is_published ? (publishedLabel ? `Publicada: ${publishedLabel}` : 'Publicada') : 'Aún no publicada'}
        </Text>
        <Text style={styles.cardMeta}>{expired ? `Caducada: ${expiresLabel}` : `Caduca: ${expiresLabel}`}</Text>
        {!isAdmin && isRead && readAt ? <Text style={styles.cardMeta}>Leida: {readAt}</Text> : null}
        <Text style={styles.cardContent}>{item.content}</Text>
        {isAdmin ? (
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.smallBtn} onPress={() => togglePublish(item)}>
              <Text style={styles.smallBtnTxt}>{item.is_published ? 'Despublicar' : 'Publicar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#f8d7da' }]} onPress={() => handleDelete(item)}>
              <Text style={[styles.smallBtnTxt, { color: '#721c24' }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        ) : profile?.id ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.smallBtn, isRead ? styles.unreadActionBtn : styles.readActionBtn]}
              onPress={() => toggleReadStatus(item, !isRead)}
              disabled={markingReadId === item.id}
            >
              {markingReadId === item.id ? (
                <ActivityIndicator color={isRead ? '#991b1b' : '#0C5C66'} />
              ) : (
                <Text style={[styles.smallBtnTxt, isRead ? styles.unreadActionText : styles.readActionText]}>
                  {isRead ? 'Marcar como no leida' : 'Marcar como leida'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {!isAdmin && (
          <View style={styles.userPanel}>
            <Text style={styles.userPanelTitle}>Tus noticias</Text>
            <Text style={styles.userPanelSubtitle}>
              {unreadCount > 0 ? `Tienes ${unreadCount} sin leer` : 'Estás al día con todas las noticias'}
            </Text>
            <TouchableOpacity style={[styles.userToggleBtn, showOnlyUnread && styles.userToggleBtnActive]} onPress={() => setShowOnlyUnread((prev) => !prev)}>
              <Text style={[styles.userToggleText, showOnlyUnread && styles.userToggleTextActive]}>
                {showOnlyUnread ? 'Ver todas' : 'Solo no leidas'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterHeading}>Categorías</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setSelectedCategory(null)} style={[styles.filterBtn, !selectedCategory && styles.filterBtnActive]}>
              <Text style={[styles.filterText, !selectedCategory && styles.filterTextActive]}>Todas</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity key={c} onPress={() => setSelectedCategory(prev => prev === c ? null : c)} style={[styles.filterBtn, selectedCategory === c && styles.filterBtnActive]}>
                <Text style={[styles.filterText, selectedCategory === c && styles.filterTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterHeading}>Estado</Text>
          <View style={styles.statusRow}>
            {STATUS_FILTERS.filter(({ adminOnly }) => !(adminOnly && !isAdmin)).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() =>
                  setSelectedStatus((prev) => {
                    if (key === 'all') return 'all';
                    return prev === key ? 'all' : key;
                  })
                }
                style={[styles.statusBtn, selectedStatus === key && styles.statusBtnActive]}
              >
                <Text style={[styles.statusText, selectedStatus === key && styles.statusTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterHeading}>Prioridad</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setSelectedPriority(null)} style={[styles.priorityBtn, !selectedPriority && styles.priorityBtnActive]}>
              <Text style={[styles.priorityText, !selectedPriority && styles.priorityTextActive]}>Todas</Text>
            </TouchableOpacity>
            {PRIORITY_OPTIONS.map((level) => (
              <TouchableOpacity key={level} onPress={() => setSelectedPriority(prev => prev === level ? null : level)} style={[styles.priorityBtn, selectedPriority === level && styles.priorityBtnActive]}>
                <Text style={[styles.priorityText, selectedPriority === level && styles.priorityTextActive]}>{capitalize(level)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {isAdmin ? (
          <View>
            {!showForm ? (
              <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(true)}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Crear noticia</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.form, isDark && styles.formDark]}>
                <Text style={[styles.label, isDark ? { color: '#fff' } : { color: '#000' }]}>Crear noticia</Text>
                <TextInput
                  placeholder="Título"
                  placeholderTextColor={isDark ? '#cbd5e1' : '#6b7280'}
                  selectionColor={isDark ? '#fff' : '#000'}
                  value={title}
                  onChangeText={setTitle}
                  style={[styles.input, isDark && styles.inputDark]}
                />
                <TextInput
                  placeholder="Contenido"
                  placeholderTextColor={isDark ? '#cbd5e1' : '#6b7280'}
                  selectionColor={isDark ? '#fff' : '#000'}
                  value={content}
                  onChangeText={setContent}
                  style={[styles.input, { height: 100 }, isDark && styles.inputDark]}
                  multiline
                />
                <TextInput
                  placeholder="URL de imagen (opcional)"
                  placeholderTextColor={isDark ? '#cbd5e1' : '#6b7280'}
                  selectionColor={isDark ? '#fff' : '#000'}
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  style={[styles.input, isDark && styles.inputDark]}
                />
                <TextInput
                  placeholder="Fecha de caducidad (YYYY-MM-DD HH:mm)"
                  placeholderTextColor={isDark ? '#cbd5e1' : '#6b7280'}
                  selectionColor={isDark ? '#fff' : '#000'}
                  value={expiresAtInput}
                  onChangeText={setExpiresAtInput}
                  style={[styles.input, isDark && styles.inputDark]}
                />
                <Text style={[styles.expirationHelper, isDark ? { color: '#94a3b8' } : { color: '#475569' }]}>
                  Deja vacio para mantener la noticia activa indefinidamente o usa un preset rapido.
                </Text>
                <View style={styles.presetRow}>
                  {EXPIRATION_PRESETS.map((preset) => (
                    <TouchableOpacity key={preset.label} style={styles.presetBtn} onPress={() => handleExpirationPreset(preset.days)}>
                      <Text style={styles.presetBtnText}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.priorityGroup}>
                  <Text style={[styles.label, isDark ? { color: '#fff' } : { color: '#000' }]}>Prioridad</Text>
                  <View style={styles.priorityOptions}>
                    {PRIORITY_OPTIONS.map((level) => (
                      <TouchableOpacity
                        key={level}
                        onPress={() => setPriority(level)}
                        style={[styles.prioritySelectBtn, priority === level && styles.prioritySelectBtnActive]}
                      >
                        <Text style={[styles.prioritySelectText, priority === level && styles.prioritySelectTextActive]}>
                          {capitalize(level)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <TouchableOpacity onPress={() => setPublish(!publish)} style={[styles.publishBtn, publish && styles.publishBtnActive, isDark && styles.publishBtnDark]}>
                    <Text style={{ color: publish ? '#fff' : (isDark ? '#fff' : '#000') }}>{publish ? 'Publicado' : 'Guardar como borrador'}</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={handleCreate} style={[styles.saveBtn, isDark && styles.saveBtnDark]}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Crear</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowForm(false)} style={[styles.publishBtn, { marginLeft: 8, backgroundColor: '#6c757d' }, isDark && { backgroundColor: '#374151' }]}> 
                      <Text style={{ color: '#fff' }}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : null}

        <ThemedText type="subtitle" style={{ fontSize: 18, marginVertical: 8 }}>Noticias</ThemedText>
        {loading ? (
          <ActivityIndicator />
        ) : (
          (() => {
            // apply client-side filters
            const filtered = news.filter(n => {
              const catOk = selectedCategory ? (n.category ?? null) === selectedCategory : true;
              const priorityValue = (n.priority || '').toString().toLowerCase();
              const priorityOk = selectedPriority ? priorityValue === selectedPriority : true;
              const expired = isNewsExpired(n);
              const statusOk =
                selectedStatus === 'published'
                  ? n.is_published && !expired
                  : selectedStatus === 'draft'
                    ? !n.is_published
                    : selectedStatus === 'expired'
                      ? expired
                      : true;
              const expirationOk = isAdmin ? true : !expired;
              const readOk = showOnlyUnread ? !readStatus[n.id] : true;
              return catOk && priorityOk && statusOk && expirationOk && readOk;
            });

            if (filtered.length === 0) {
              return (
                <ThemedView style={[styles.emptyCard, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}>
                  <ThemedText style={{ textAlign: 'center', opacity: 0.8 }}>No hay noticias por ahora.</ThemedText>
                </ThemedView>
              );
            }

            return <FlatList data={filtered} keyExtractor={(i) => i.id} renderItem={renderItem} />;
          })()
        )}
      </ScrollView>
      <FabChat />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { marginBottom: 12, backgroundColor: '#f7f7f7', padding: 8, borderRadius: 8 },
  label: { fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: '#fff', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 8 },
  publishBtn: { padding: 8, borderRadius: 6, backgroundColor: '#e9ecef' },
  publishBtnActive: { backgroundColor: '#1e90ff' },
  saveBtn: { padding: 8, borderRadius: 6, backgroundColor: '#28a745' },
  newBtn: { padding: 10, borderRadius: 6, backgroundColor: '#0C5C66', marginBottom: 12 },
  emptyCard: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  filterSection: { marginBottom: 12 },
  filterHeading: { fontWeight: '600', marginBottom: 6 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#eef2f6', marginRight: 8, marginBottom: 8 },
  filterBtnActive: { backgroundColor: '#0C5C66' },
  filterText: { color: '#0b1220' },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap' },
  statusBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#eef2f6', marginRight: 8, marginBottom: 8 },
  statusBtnActive: { backgroundColor: '#0C5C66' },
  statusText: { color: '#0b1220' },
  statusTextActive: { color: '#fff', fontWeight: '700' },
  priorityBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#e9ecef', marginRight: 8, marginBottom: 8 },
  priorityBtnActive: { backgroundColor: '#1e90ff' },
  priorityText: { color: '#000' },
  priorityTextActive: { color: '#fff', fontWeight: '700' },
  priorityGroup: { marginBottom: 8 },
  priorityOptions: { flexDirection: 'row', flexWrap: 'wrap' },
  prioritySelectBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', marginRight: 8, marginBottom: 8 },
  prioritySelectBtnActive: { backgroundColor: '#0C5C66', borderColor: '#0C5C66' },
  prioritySelectText: { color: '#0f172a' },
  prioritySelectTextActive: { color: '#fff', fontWeight: '600' },
  expirationHelper: { fontSize: 12, marginBottom: 6 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  presetBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#cbd5f5', backgroundColor: '#eef2ff', marginRight: 8, marginBottom: 8 },
  presetBtnText: { fontSize: 12, color: '#1e3a8a', fontWeight: '600' },
  /* dark mode variants for create form */
  formDark: { backgroundColor: '#0b1220' },
  inputDark: { backgroundColor: '#0b1220', color: '#fff', borderColor: '#2a2a3e' },
  publishBtnDark: { backgroundColor: '#374151' },
  saveBtnDark: { backgroundColor: '#065f46' },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 12, color: '#666', marginBottom: 6 },
  cardContent: { color: '#333' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, marginLeft: 6, marginBottom: 4, backgroundColor: '#eef2ff' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#1e3a8a' },
  badgePublished: { backgroundColor: '#d1fae5' },
  badgeDraft: { backgroundColor: '#fee2e2' },
  badgePublishedText: { color: '#065f46' },
  badgeDraftText: { color: '#991b1b' },
  badgeExpired: { backgroundColor: '#fef2f2' },
  badgeExpiredText: { color: '#b91c1c' },
  badgeRead: { backgroundColor: '#dbeafe' },
  badgeReadText: { color: '#1d4ed8' },
  badgeUnread: { backgroundColor: '#fef3c7' },
  badgeUnreadText: { color: '#b45309' },
  cardActions: { flexDirection: 'row', marginTop: 8 },
  smallBtn: { padding: 8, borderRadius: 6, backgroundColor: '#e6f0ff', marginRight: 8 },
  smallBtnTxt: { fontWeight: '600' },
  readActionBtn: { backgroundColor: '#d1fae5' },
  readActionText: { color: '#166534' },
  unreadActionBtn: { backgroundColor: '#fee2e2' },
  unreadActionText: { color: '#991b1b' },
  userPanel: { padding: 12, borderRadius: 8, backgroundColor: '#eff6ff', marginBottom: 12 },
  userPanelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, color: '#0f172a' },
  userPanelSubtitle: { color: '#475569', marginBottom: 8 },
  userToggleBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#fff' },
  userToggleBtnActive: { backgroundColor: '#0C5C66', borderColor: '#0C5C66' },
  userToggleText: { color: '#0C5C66', fontWeight: '600' },
  userToggleTextActive: { color: '#fff' },
});
