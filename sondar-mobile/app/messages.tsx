import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { Avatar, Empty, ErrorNotice, Header, IconButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';

type Contact = { id: string; nombre: string; usuario: string; avatar?: string };
type Message = { id: string; text: string; createdAt: string; mine: boolean };
type Conversation = {
  id: string;
  person: Contact;
  lastMessage: string;
  updatedAt: string;
  unread: number;
  messages?: Message[];
};

function contactFrom(value: any): Contact {
  const profile = value?.perfil || value || {};
  return {
    id: String(profile.id || profile.user_id || ''),
    nombre: profile.nombre || profile.name || profile.username || 'Usuario SONDAR',
    usuario: `@${String(profile.usuario || profile.username || 'usuario').replace(/^@/, '')}`,
    avatar: profile.avatar || profile.profile_img_url || '',
  };
}

function mergeConversation(current: Conversation[], incoming: Conversation) {
  return [incoming, ...current.filter(item => item.id !== incoming.id)]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export default function MessagesScreen() {
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ recipient?: string; name?: string; handle?: string; avatar?: string; conversation?: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatBusy, setChatBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [composer, setComposer] = useState('');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const openedRecipient = useRef('');

  const loadConversations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await api<Conversation[]>('/api/mensajes', { token });
      setConversations(current => data.map(item => ({
        ...item,
        messages: current.find(existing => existing.id === item.id)?.messages,
      })));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los mensajes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    loadConversations();
    const interval = setInterval(() => loadConversations(true), 15000);
    return () => clearInterval(interval);
  }, [loadConversations]));

  const openById = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    setSelectedId(conversationId);
    setChatBusy(true);
    try {
      const conversation = await api<Conversation>(`/api/mensajes/${conversationId}`, { token });
      setConversations(current => mergeConversation(current, { ...conversation, unread: 0 }));
      setError('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la conversación.');
    } finally {
      setChatBusy(false);
    }
  }, [token]);

  const openConversation = useCallback(async (person: Contact) => {
    if (!person.id) return;
    setSearchBusy(true);
    try {
      const conversation = await api<Conversation>('/api/mensajes', {
        method: 'POST',
        token,
        body: JSON.stringify({ recipientId: person.id }),
      });
      setConversations(current => mergeConversation(current, { ...conversation, messages: [] }));
      setSearching(false);
      setQuery('');
      setResults([]);
      setError('');
      await openById(conversation.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la conversación.');
    } finally {
      setSearchBusy(false);
    }
  }, [openById, token]);

  useEffect(() => {
    const recipient = String(params.recipient || '');
    if (!recipient || openedRecipient.current === recipient) return;
    openedRecipient.current = recipient;
    openConversation({
      id: recipient,
      nombre: String(params.name || params.handle || 'Usuario SONDAR'),
      usuario: `@${String(params.handle || params.name || 'usuario').replace(/^@/, '')}`,
      avatar: params.avatar ? String(params.avatar) : '',
    });
  }, [openConversation, params.avatar, params.handle, params.name, params.recipient]);

  useEffect(() => {
    const conversation = String(params.conversation || '');
    if (!conversation) return;

    const timeout = setTimeout(() => {
      void openById(conversation);
    }, 0);

    return () => clearTimeout(timeout);
  }, [openById, params.conversation]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setSearchBusy(true);
      try {
        const data = await api<any[]>(`/api/usuarios?query=${encodeURIComponent(term)}`, { token });
        if (cancelled) return;
        setResults(data.map(contactFrom).filter(item => item.id && item.id !== user?.id));
        setError('');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'No se pudieron buscar usuarios.');
      } finally {
        if (!cancelled) setSearchBusy(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, token, user?.id]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setSearchBusy(false);
    }
  }, []);

  const selected = useMemo(() => conversations.find(item => item.id === selectedId) || null, [conversations, selectedId]);

  async function send() {
    const text = composer.trim();
    if (!selected || !text || sending) return;
    setSending(true);
    try {
      const message = await api<Message>(`/api/mensajes/${selected.id}`, {
        method: 'POST',
        token,
        body: JSON.stringify({ text }),
      });
      setConversations(current => {
        const existing = current.find(item => item.id === selected.id);
        if (!existing) return current;
        return mergeConversation(current, {
          ...existing,
          messages: [...(existing.messages || []), message],
          lastMessage: message.text,
          updatedAt: message.createdAt,
          unread: 0,
        });
      });
      setComposer('');
      setError('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Screen><Header title="Mensajes" back /><Loading /></Screen>;

  const conversationList = (
    <View style={[styles.sidebar, wide && styles.sidebarWide]}>
      <View style={styles.sidebarTop}>
        <View style={{ flex: 1 }}><Text style={styles.kicker}>MENSAJES</Text><Text style={ui.h2}>Conversaciones</Text></View>
        <IconButton name="add" active onPress={() => setSearching(true)} />
      </View>
      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); loadConversations(true); }}
        contentContainerStyle={conversations.length ? styles.conversationList : styles.emptyList}
        ListEmptyComponent={<Empty icon="chatbubbles-outline" title="Todavía no hay mensajes" text="Buscá una persona para iniciar una conversación." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => openById(item.id)} style={[styles.conversation, item.id === selectedId && styles.conversationActive]}>
            <View>
              <Avatar uri={item.person.avatar} name={item.person.nombre} size={46} />
              {item.unread > 0 ? <View style={styles.unreadDot} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.personName} numberOfLines={1}>{item.person.nombre}</Text>
              <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>{item.lastMessage || 'Nueva conversación'}</Text>
            </View>
            <View style={styles.conversationMeta}>
              {item.updatedAt ? <Text style={styles.time}>{new Date(item.updatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</Text> : null}
              {item.unread > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{Math.min(item.unread, 99)}</Text></View> : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );

  const chat = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chat}>
      {selected ? <>
        <View style={styles.chatTop}>
          {!wide ? <IconButton name="arrow-back" onPress={() => setSelectedId(null)} /> : null}
          <Pressable style={styles.chatPerson} onPress={() => router.push({ pathname: '/profile/[id]', params: { id: selected.person.id } })}>
            <Avatar uri={selected.person.avatar} name={selected.person.nombre} size={42} />
            <View style={{ flex: 1 }}><Text style={styles.personName}>{selected.person.nombre}</Text><Text style={styles.handle}>{selected.person.usuario}</Text></View>
          </Pressable>
        </View>
        {chatBusy ? <Loading /> : <FlatList
          ref={listRef}
          data={selected.messages || []}
          keyExtractor={item => item.id}
          contentContainerStyle={selected.messages?.length ? styles.messages : styles.emptyMessages}
          ListEmptyComponent={<Empty icon="chatbubble-ellipses-outline" title={selected.person.nombre} text="Enviá un mensaje para iniciar la conversación." />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleOther]}><Text style={styles.messageText}>{item.text}</Text><Text style={styles.messageTime}>{new Date(item.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</Text></View>}
        />}
        <View style={styles.composer}>
          <TextInput
            value={composer}
            onChangeText={setComposer}
            onSubmitEditing={send}
            placeholder="Escribí un mensaje…"
            placeholderTextColor={palette.muted}
            style={styles.input}
            returnKeyType="send"
            maxLength={2000}
            editable={!sending}
          />
          <IconButton name={sending ? 'hourglass-outline' : 'send'} active onPress={send} />
        </View>
      </> : <Empty icon="mail-outline" title="Seleccioná una conversación" text="O creá una nueva para hablar." />}
    </KeyboardAvoidingView>
  );

  return (
    <Screen>
      <Header title="Mensajes" subtitle="Conversaciones de SONDAR" back actions={<IconButton name="add" active onPress={() => setSearching(true)} />} />
      <ErrorNotice message={error} />
      <View style={styles.layout}>{wide ? <>{conversationList}{chat}</> : selected ? chat : conversationList}</View>

      <Modal visible={searching} transparent animationType="fade" onRequestClose={() => setSearching(false)}>
        <View style={styles.searchBackdrop}>
          <View style={styles.searchCard}>
            <View style={styles.sidebarTop}><Text style={ui.h2}>Nuevo mensaje</Text><IconButton name="close" onPress={() => setSearching(false)} /></View>
            <View style={styles.searchBox}><Ionicons name="search" size={20} color={palette.muted} /><TextInput autoFocus value={query} onChangeText={updateQuery} placeholder="Buscar por nombre o @usuario" placeholderTextColor={palette.muted} style={styles.searchInput} /></View>
            {searchBusy ? <Loading /> : <FlatList data={results} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Empty icon="search-outline" title={query.trim().length < 2 ? 'Buscá una persona' : 'Sin resultados'} />} renderItem={({ item }) => <Pressable style={styles.result} onPress={() => openConversation(item)}><Avatar uri={item.avatar} name={item.nombre} /><View style={{ flex: 1 }}><Text style={styles.personName}>{item.nombre}</Text><Text style={styles.handle}>{item.usuario}</Text></View><Ionicons name="chevron-forward" size={20} color={palette.muted} /></Pressable>} />}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { flex: 1, flexDirection: 'row', backgroundColor: palette.bg },
  sidebar: { flex: 1, backgroundColor: '#0D0D0F' },
  sidebarWide: { flex: 0, width: 330, borderRightWidth: 1, borderRightColor: palette.border },
  sidebarTop: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderBottomWidth: 1, borderBottomColor: palette.border },
  kicker: { color: palette.orange, fontSize: 9, letterSpacing: 1.4, fontWeight: '900' },
  conversationList: { padding: 9, gap: 5 },
  emptyList: { flexGrow: 1 },
  conversation: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 9 },
  conversationActive: { backgroundColor: '#2D210F', borderWidth: 1, borderColor: '#6D4615' },
  personName: { color: palette.text, fontSize: 14, fontWeight: '800' },
  preview: { color: palette.muted, fontSize: 12, marginTop: 3 },
  previewUnread: { color: palette.text, fontWeight: '700' },
  time: { color: palette.muted, fontSize: 9 },
  handle: { color: palette.muted, fontSize: 11, marginTop: 2 },
  conversationMeta: { alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'center', gap: 7 },
  unreadDot: { position: 'absolute', right: -1, bottom: 0, width: 12, height: 12, borderRadius: 7, backgroundColor: palette.orange, borderWidth: 2, borderColor: '#0D0D0F' },
  unreadBadge: { minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.orange },
  unreadText: { color: '#0A0A0B', fontSize: 9, fontWeight: '900' },
  chat: { flex: 1, minWidth: 0, backgroundColor: '#0B0B0D' },
  chatTop: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: palette.border },
  chatPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  messages: { flexGrow: 1, justifyContent: 'flex-end', gap: 8, padding: 15 },
  emptyMessages: { flexGrow: 1, justifyContent: 'center' },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingTop: 10, paddingBottom: 7, borderRadius: 15, borderWidth: 1 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#E57B08', borderColor: palette.amber, borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: palette.surface2, borderColor: palette.border, borderBottomLeftRadius: 4 },
  messageText: { color: palette.text, fontSize: 14, lineHeight: 19 },
  messageTime: { color: '#FFFFFFA8', fontSize: 9, textAlign: 'right', marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: '#101012' },
  input: { flex: 1, minHeight: 44, color: palette.text, paddingHorizontal: 13, borderRadius: 9, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  searchBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#000C' },
  searchCard: { width: '100%', maxWidth: 520, height: '72%', alignSelf: 'center', backgroundColor: '#111214', borderRadius: 14, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' },
  searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 9, margin: 13, paddingHorizontal: 12, borderRadius: 9, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  searchInput: { flex: 1, color: palette.text },
  result: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
});
