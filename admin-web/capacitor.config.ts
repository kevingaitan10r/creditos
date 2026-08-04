import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenu.credits',
  appName: 'Zenu Credits',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
