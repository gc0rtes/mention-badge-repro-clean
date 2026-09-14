import React, { useState, useEffect } from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Alert, TouchableOpacity, StyleSheet } from 'react-native';

import {
  OverlayProvider,
  Chat,
  ChannelList,
  Channel,
  MessageList,
  MessageInput,
} from 'stream-chat-react-native';
import { StreamChat } from 'stream-chat';
import type { Channel as StreamChannel } from 'stream-chat';
import {
  chatApiKey,
  chatUserId,
  chatUserName,
  chatUserToken,
} from './myChatConfig';

import { AppProvider, useAppContext } from './AppContext';

const Stack = createStackNavigator();
const navigationContainerRef = React.createRef<NavigationContainerRef<any>>();

const user = {
  id: chatUserId,
  name: chatUserName,
};

const ChannelScreen = (_props: any) => {
  const { channel } = useAppContext();

  if (!channel) {
    return (
      <SafeAreaView>
        <Text>Loading Chat screen ...</Text>
      </SafeAreaView>
    );
  }

  return (
    <Channel channel={channel}>
      <MessageList />
      <MessageInput />
    </Channel>
  );
};

// DEBUG REPRO: mirrors a customer's CustomChannelPreview that reads
// channel.countUnreadMentions() directly in render (per SDK docs) instead of
// using the `unread` prop ChannelPreview already computes. Logs every render
// plus every read-related client event so we can see exactly when/why the
// mention badge flips back to 0. Remove once the repro is confirmed/fixed.
const CustomChannelPreview = ({ channel }: { channel: StreamChannel }) => {
  const { setChannel } = useAppContext();
  const lastMessage = Array.isArray(channel?.state?.messages)
    ? channel.state.messages.reduce(
        (prev: any, curr: any) => (curr.type !== 'deleted' ? curr : prev),
        {} as any,
      )
    : ({} as any);

  const mentionCount = channel.countUnreadMentions();
  const unreadCount = channel.countUnread();
  const lastRead = channel.state.read[chatUserId]?.last_read;

  console.log(
    `[mention-debug] render cid=${channel.cid} mentionCount=${mentionCount} unreadCount=${unreadCount} lastRead=${lastRead} lastMessage=${lastMessage?.text} @ ${new Date().toISOString()}`,
  );

  return (
    <TouchableOpacity
      style={previewStyles.container}
      onPress={() => {
        setChannel(channel);
        navigationContainerRef.current?.navigate('ChannelScreen', {
          channelId: channel.id,
        });
      }}
    >
      <View style={previewStyles.row}>
        <Text style={previewStyles.title}>
          {channel.data?.name || channel.id}
        </Text>
        {mentionCount > 0 ? (
          <View style={previewStyles.badge}>
            <Text style={previewStyles.badgeText}>{mentionCount}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={previewStyles.subtitle}>
        {lastMessage?.text || ''}
      </Text>
    </TouchableOpacity>
  );
};

const previewStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  badge: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
});

const ChannelListScreen = (props: any) => {
  const { navigation } = props;
  const { setChannel } = useAppContext();

  const filters = {
    members: {
      $in: [chatUserId],
    },
  };

  const sort = {
    last_message_at: -1 as const,
  };

  const options = {
    presence: true,
    state: true,
    watch: true,
  };

  // DEBUG REPRO: log every read-related event for this user's channels, so we
  // can correlate a mention badge disappearing with the exact event that
  // caused channel.state.read to update.
  useEffect(() => {
    const client = StreamChat.getInstance(chatApiKey);
    const eventTypes = [
      'message.new',
      'message.read',
      'notification.mark_read',
      'notification.mark_unread',
    ] as const;
    const subscriptions = eventTypes.map(type =>
      client.on(type, event => {
        const channel = event.cid
          ? client.channel(
              event.cid.split(':')[0],
              event.cid.split(':')[1],
            )
          : undefined;
        console.log(
          `[mention-debug] event=${type} cid=${event.cid} fromUser=${event.user?.id} mentionCount=${channel?.countUnreadMentions?.()} lastRead=${channel?.state?.read?.[chatUserId]?.last_read} @ ${new Date().toISOString()}`,
        );
      }),
    );
    return () => subscriptions.forEach(s => s.unsubscribe());
  }, []);

  return (
    <ChannelList
      filters={filters}
      sort={sort}
      options={options}
      Preview={CustomChannelPreview}
      onSelect={channel => {
        setChannel(channel);
        navigation.navigate('ChannelScreen');
      }}
    />
  );
};

const NavigationStack = () => {
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const connectToStream = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      const client = StreamChat.getInstance(chatApiKey);
      await client.connectUser(user, chatUserToken);

      console.log('Successfully connected to Stream Chat');
      setChatClient(client);
      setRetryCount(0);
    } catch (error: any) {
      console.error('Failed to connect to Stream Chat:', error);

      let errorMessage = 'Failed to connect to chat service';

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.status) {
        errorMessage = `Connection failed with status: ${error.status}`;
      } else if (error?.code) {
        errorMessage = `Connection failed with code: ${error.code}`;
      }

      setConnectionError(errorMessage);
      Alert.alert('Connection Error', errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    connectToStream();
  };

  useEffect(() => {
    connectToStream();

    return () => {
      chatClient?.disconnectUser();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chatClient) {
    if (isConnecting) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.loadingText}>Connecting to chat service...</Text>
        </SafeAreaView>
      );
    }

    if (connectionError) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{connectionError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>
              Retry {retryCount > 0 && `(${retryCount})`}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Initializing chat client...</Text>
      </SafeAreaView>
    );
  }
  return (
    <OverlayProvider>
      <Chat client={chatClient}>
        <Stack.Navigator initialRouteName="ChannelListScreen">
          <Stack.Screen
            name="ChannelListScreen"
            component={ChannelListScreen}
          />
          <Stack.Screen name="ChannelScreen" component={ChannelScreen} />
        </Stack.Navigator>
      </Chat>
    </OverlayProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

const appStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default () => {
  return (
    <AppProvider>
      <SafeAreaView style={appStyles.container}>
        <NavigationContainer>
          <NavigationStack />
        </NavigationContainer>
      </SafeAreaView>
    </AppProvider>
  );
};
