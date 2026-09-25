import {useEffect, useState} from 'react';
import NetInfo, {type NetInfoState} from '@react-native-community/netinfo';

/**
 * Ahorro de datos: 'auto' pone tope solo fuera del Wi-Fi, 'on' lo pone siempre y
 * 'off' nunca. No sustituye al ABR del reproductor (que ya baja la calidad cuando
 * el ancho de banda real no da), sino que limita cuánto se gasta.
 */
export type DataSaver = 'auto' | 'on' | 'off';

/** Topes de bitrate en bits/s. 0 = sin tope (ABR libre). */
const UNLIMITED = 0;
const CAP_HD = 2_500_000; // ~720p
const CAP_SD = 800_000; // ~360p
const CAP_LOW = 400_000; // ~240p

export type NetworkCap = {
  /** Valor para la prop `maxBitRate` de <Video>; 0 = sin tope. */
  bitrate: number;
  /** Red detectada, corta para caber en el menú: «Wi-Fi», «5G», «Cable»… */
  network: string;
  /** Efecto del tope, para el menú: «sin límite», «hasta 2,5 Mb/s». */
  limit: string;
};

/** «2,5 Mb/s» (una cifra decimal, formato español). */
export const mbps = (bits: number) =>
  `${(bits / 1_000_000).toLocaleString('es-ES', {
    maximumFractionDigits: 1,
  })} Mb/s`;

function networkName(state: NetInfoState | null) {
  if (!state) {
    return 'Red desconocida';
  }
  switch (state.type) {
    case 'wifi':
      return 'Wi-Fi';
    case 'ethernet':
      return 'Cable';
    case 'cellular': {
      const gen = state.details?.cellularGeneration;
      return gen ? gen.toUpperCase() : 'Datos móviles';
    }
    default:
      return 'Red desconocida';
  }
}

/** Tope que toca según el modo y la red. */
function capFor(mode: DataSaver, state: NetInfoState | null) {
  if (mode === 'off') {
    return UNLIMITED;
  }
  if (mode === 'on') {
    return CAP_SD;
  }
  if (!state || state.type === 'wifi' || state.type === 'ethernet') {
    return UNLIMITED;
  }
  if (state.type === 'cellular') {
    switch (state.details?.cellularGeneration) {
      case '2g':
        return CAP_LOW;
      case '3g':
        return CAP_SD;
      default:
        // 4g, 5g o desconocida: se gasta menos que en Wi-Fi, pero sin ahogar el vídeo.
        return CAP_HD;
    }
  }
  // Tipos raros (bluetooth, wimax, vpn…): si el sistema dice que la conexión
  // es cara, se trata como móvil.
  return state.details && 'isConnectionExpensive' in state.details &&
    state.details.isConnectionExpensive
    ? CAP_HD
    : UNLIMITED;
}

/**
 * Traduce el tipo de red a un tope de bitrate. El reproductor sigue eligiendo
 * calidad por su cuenta (ABR) por debajo de ese tope.
 */
export default function useNetworkCap(mode: DataSaver): NetworkCap {
  const [state, setState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    NetInfo.fetch().then(setState);
    return NetInfo.addEventListener(setState);
  }, []);

  const bitrate = capFor(mode, state);
  return {
    bitrate,
    network: networkName(state),
    limit: bitrate === UNLIMITED ? 'sin límite' : `hasta ${mbps(bitrate)}`,
  };
}
