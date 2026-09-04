import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/sondar';

type EventMapProps = {
  events: any[];
  onSelect: (event: any) => void;
  style?: any;
};

export function EventMap({ events, onSelect, style }: EventMapProps) {
  return (
    <View style={[styles.mapFallback, style]}>
      <FlatList
        data={events}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          return (
            <Pressable style={styles.pinCard} onPress={() => onSelect(item)}>
              <Image source={require('../assets/images/icon.png')} style={styles.pinImage} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pinTitle} numberOfLines={1}>{item.titulo}</Text>
                <Text style={styles.pinMeta} numberOfLines={1}>{item.lugar || item.ubicacion}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapFallback: { backgroundColor: '#071113' },
  list: { padding: 14, gap: 10 },
  pinCard: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: '#080808E6', borderWidth: 1, borderColor: palette.border, borderRadius: 8 },
  pinImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#080808' },
  pinTitle: { color: palette.text, fontWeight: '900' },
  pinMeta: { color: palette.muted, marginTop: 3, fontSize: 12 },
});
