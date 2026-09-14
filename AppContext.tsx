import React, { useState, type PropsWithChildren } from 'react';
import type { Channel } from 'stream-chat';

type AppContextValue = {
  channel: Channel | null;
  setChannel: (channel: Channel | null) => void;
  thread: unknown;
  setThread: (thread: unknown) => void;
};

export const AppContext = React.createContext<AppContextValue>({
  channel: null,
  setChannel: () => {},
  thread: null,
  setThread: () => {},
});

export const AppProvider = ({ children }: PropsWithChildren) => {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [thread, setThread] = useState<unknown>(null);

  return (
    <AppContext.Provider value={{ channel, setChannel, thread, setThread }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => React.useContext(AppContext);
