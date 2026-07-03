import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Field, Header, Screen, ui } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';

const faqs = [
  ['¿Cómo publico música?', 'Entrá a Descubrir, tocá + y elegí una portada y un archivo de audio.'],
  ['¿Cómo creo un evento?', 'En Eventos tocá +, completá los datos, agregá coorganizadores y usá tu ubicación.'],
  ['¿Cómo denuncio contenido?', 'Abrí las opciones del evento, lanzamiento o perfil y seleccioná Denunciar.'],
  ['¿Dónde están mis guardados?', 'En tu Perfil, dentro de la pestaña Guardado.'],
];
export default function SupportScreen() {
  const [open, setOpen] = useState<number | null>(null); const [subject, setSubject] = useState(''); const [message, setMessage] = useState('');
  function send() { const body = encodeURIComponent(`${message}\n\nEnviado desde SONDAR Mobile`); Linking.openURL(`mailto:soporte@sondar.app?subject=${encodeURIComponent(subject || 'Consulta SONDAR')}&body=${body}`); }
  return <Screen scroll><Header title="Soporte" subtitle="Estamos para ayudarte" back /><View style={styles.hero}><Ionicons name="headset" size={42} color={palette.orange} /><Text style={ui.h1}>¿Cómo podemos ayudarte?</Text><Text style={[ui.muted, { textAlign: 'center' }]}>Revisá las respuestas rápidas o escribinos.</Text></View><Text style={ui.h2}>Preguntas frecuentes</Text>{faqs.map(([question, answer], index) => <Pressable key={question} style={styles.faq} onPress={() => setOpen(open === index ? null : index)}><View style={styles.faqTitle}><Text style={[ui.text, { flex: 1, fontWeight: '700' }]}>{question}</Text><Ionicons name={open === index ? 'chevron-up' : 'chevron-down'} color={palette.orange} size={20} /></View>{open === index ? <Text style={styles.answer}>{answer}</Text> : null}</Pressable>)}<View style={styles.form}><Text style={ui.h2}>Contactar soporte</Text><Field label="Asunto" value={subject} onChangeText={setSubject} placeholder="¿En qué te ayudamos?" /><Field label="Mensaje" value={message} onChangeText={setMessage} placeholder="Contanos qué pasó…" multiline /><Button icon="mail-outline" onPress={send} disabled={!message.trim()}>Abrir correo</Button></View><Text style={styles.version}>SONDAR Mobile · Expo 54</Text></Screen>;
}
const styles = StyleSheet.create({ hero: { alignItems: 'center', gap: 10, padding: 26, borderRadius: 20, backgroundColor: palette.surface }, faq: { padding: 15, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, faqTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 }, answer: { color: palette.muted, lineHeight: 21, paddingTop: 11 }, form: { gap: 13, padding: 16, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, version: { color: palette.muted, textAlign: 'center', marginTop: 5 } });

