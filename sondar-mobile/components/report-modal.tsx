import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/sondar';
import { Button, Field, IconButton, ui } from './sondar-ui';

export type ReportPayload = {
  reason: string;
  detail: string;
};

const reasons = [
  ['sexual', 'Contenido sexual o explícito'],
  ['violencia', 'Violencia o contenido peligroso'],
  ['odio', 'Odio, discriminación o acoso'],
  ['spam', 'Spam, engaño o estafa'],
  ['copyright', 'Infracción de derechos de autor'],
  ['informacion_falsa', 'Información falsa'],
  ['otro', 'Otro motivo'],
] as const;

export function ReportModal({
  visible,
  subject,
  busy = false,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  subject?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (payload: ReportPayload) => Promise<void> | void;
}) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');

  function resetForm() {
    setReason('');
    setDetail('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={resetForm}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar denuncia" />
        <View style={styles.card}>
          <View style={styles.top}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>DENUNCIAR</Text>
              <Text style={ui.h2}>¿Qué problema tiene este contenido?</Text>
              {subject ? <Text style={styles.subject} numberOfLines={1}>{subject}</Text> : null}
            </View>
            <IconButton name="close" onPress={onClose} />
          </View>

          <View style={styles.reasons}>
            {reasons.map(([id, label]) => {
              const selected = reason === id;
              return (
                <Pressable key={id} onPress={() => setReason(id)} style={[styles.reason, selected && styles.reasonSelected]}>
                  <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View>
            <Field
              label="Detalle adicional (opcional)"
              value={detail}
              onChangeText={setDetail}
              placeholder="Contanos brevemente qué sucede…"
              multiline
              maxLength={500}
            />
            <Text style={styles.counter}>{detail.length}/500</Text>
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}><Button kind="secondary" onPress={onClose}>Cancelar</Button></View>
            <View style={{ flex: 1.25 }}>
              <Button icon="flag-outline" onPress={() => onSubmit({ reason, detail: detail.trim() })} disabled={!reason || busy}>
                {busy ? 'Enviando…' : 'Enviar denuncia'}
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#000000C7' },
  card: { width: '100%', maxWidth: 540, alignSelf: 'center', gap: 16, padding: 17, borderRadius: 14, backgroundColor: '#111214', borderWidth: 1, borderColor: '#5A3212' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kicker: { color: palette.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 4 },
  subject: { color: palette.muted, fontSize: 12, marginTop: 5 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reason: { width: '48.5%', minHeight: 52, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 9, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  reasonSelected: { borderColor: palette.orange, backgroundColor: '#2B180B' },
  radio: { width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.muted },
  radioSelected: { borderColor: palette.orange },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.orange },
  reasonText: { flex: 1, color: '#E0E1E4', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  reasonTextSelected: { color: palette.text },
  counter: { alignSelf: 'flex-end', color: palette.muted, fontSize: 10, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 9 },
});
