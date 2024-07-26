import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { StyleSheet} from 'react-native';
import { useGlobalSearchParams } from 'expo-router';

const Details = () => {
  const {title, body} = useGlobalSearchParams();

  return (
    <ThemedView style={styles.stepContainer}>
      <ThemedText>{title} {body}</ThemedText>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  }, 
});

export default Details;