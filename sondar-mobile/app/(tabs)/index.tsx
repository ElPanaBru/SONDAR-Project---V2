import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SONDAR</Text>

      <Text style={styles.subtitle}>
        Descubrí eventos cerca tuyo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 18,
    color: '#bdbdbd',
    textAlign: 'center',
  },
});