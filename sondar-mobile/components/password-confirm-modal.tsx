import { Modal, StyleSheet, Text, View } from 'react-native';

import { KeyboardArea } from '@/components/keyboard-layout';
import { palette } from '@/constants/sondar';
import { Button, Field, IconButton, ui } from '@/components/sondar-ui';

type Props = {
  visible: boolean;
  title: string;
  description: string;
  password: string;
  busy?: boolean;
  onPasswordChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PasswordConfirmModal({
  visible,
  title,
  description,
  password,
  busy = false,
  onPasswordChange,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardArea style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>CONFIRMAR ELIMINACIÓN</Text>
              <Text style={ui.h2}>{title}</Text>
            </View>
            <IconButton name="close" onPress={onCancel} />
          </View>
          <Text style={ui.muted}>{description}</Text>
          <Field
            label="Contraseña actual"
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <View style={styles.actions}>
            <View style={{ flex: 1 }}><Button kind="secondary" onPress={onCancel} disabled={busy}>Cancelar</Button></View>
            <View style={{ flex: 1.2 }}><Button kind="danger" icon="trash-outline" onPress={onConfirm} disabled={!password || busy}>{busy ? 'Eliminando…' : 'Eliminar'}</Button></View>
          </View>
        </View>
      </KeyboardArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#000D' },
  card: { width: '100%', maxWidth: 540, alignSelf: 'center', gap: 15, padding: 18, borderRadius: 14, backgroundColor: '#111214', borderWidth: 1, borderColor: '#7C252C' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kicker: { color: palette.danger, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 5 },
  actions: { flexDirection: 'row', gap: 9 },
});
