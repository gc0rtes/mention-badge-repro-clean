# mention-badge-repro

Minimal React Native app to reproduce a reported bug: **a channel list preview's unread-mention badge appears briefly then disappears**, even though the channel hasn't actually been read.

It uses `stream-chat-react-native@8.12.0` with a `CustomChannelPreview` that mirrors the pattern from the reporting customer's app: it reads `channel.countUnreadMentions()` directly in the render body (per the SDK docs) instead of the `unread` prop `ChannelPreview` already computes.

This is intentionally bare-bones — just Stream Chat, no push notifications/Firebase — since the bug is about the mention badge, not delivery.

## What's instrumented

- Every render of `CustomChannelPreview` logs: `mentionCount`, `unreadCount`, `lastRead`, and the last message text.
- A client-level listener logs every `message.new`, `message.read`, `notification.mark_read`, and `notification.mark_unread` event, along with the resulting `mentionCount`/`lastRead` right after.

Watch these `[mention-debug]` lines in your Metro/device logs while reproducing — they should show exactly what event (if any) causes the mention count to flip back to 0.

## Setup

```sh
npm install
```

### iOS

```sh
bundle install
bundle exec pod install
```

### Android

No extra native setup needed.

### Chat credentials

`myChatConfig.js` ships empty — fill it in with your own Stream app/test user before running:

```js
export const chatApiKey = '';     // your Stream app key
export const chatUserId = '';     // a test user id, e.g. 'ana'
export const chatUserName = '';   // display name for that user
export const chatUserToken = '';  // a token for that user (see below)
```

To generate `chatUserToken`, run:

```sh
STREAM_USER_ID=<same id as chatUserId> STREAM_APP_SECRET=<secret from Stream Dashboard> node generateToken.js
```

and paste the printed token into `chatUserToken`.

You'll also need a second user (in the same app) to send the `@mention` from during reproduction — any Stream client (this same repo run as a second instance, another Stream sample app, the dashboard's chat explorer, etc.) works.

## Running

```sh
npm start
# in another terminal
npm run ios      # or
npm run android
```

It boots straight to the channel list for whichever user you configured in `myChatConfig.js`.

## Reproducing

1. Launch the app and leave it on the channel list (or background it) — **don't open the channel**.
2. From another client/session, send a message that `@mentions` your configured user into one of their channels.
3. Watch the mention badge on that channel's preview row, and watch the `[mention-debug]` logs.
4. If the badge appears then disappears, check the logs for a `message.read` or `notification.mark_read` event firing shortly after the `message.new` event — that's the read event zeroing the count.
