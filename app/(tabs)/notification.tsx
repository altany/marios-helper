import { StyleSheet, Button} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { usePushNotifications, test} from '../services/notifications';

export default function Notification() {
    const {notification} = usePushNotifications();

  return (
    <>
      <ThemedView style={styles.stepContainer}>
        <ThemedText>Title: {notification && notification.request.content.title} </ThemedText>
        <ThemedText>Body: {notification && notification.request.content.body}</ThemedText>
        <ThemedText>Data: {notification && JSON.stringify(notification.request.content.data)}</ThemedText>
      </ThemedView>
       <Button
        title="Press to Send Notification"
        onPress={async () => {
          await test();
        }}
      /> 
    </>
  );
}
const styles = StyleSheet.create({
    wrapper: {
      paddingTop: 40,
      paddingLeft: 20,
      paddingRight: 20,
      paddingBottom: 20
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    stepContainer: {
      gap: 8,
      marginBottom: 8,
    },
    reactLogo: {
      height: 178,
      width: 290,
      bottom: 0,
      left: 0,
      position: 'absolute',
    },
  });