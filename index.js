import { Buffer } from 'buffer';
import 'react-native-get-random-values';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

import 'expo-router/entry';
