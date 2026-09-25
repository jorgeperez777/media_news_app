import {useEffect, useMemo, useState} from 'react';
import type {ImageSourcePropType} from 'react-native';

/**
 * Vista previa de la barra de duración, al estilo de YouTube: en vez de sacar
 * fotogramas del vídeo al vuelo (lento y caro), se descarga un *storyboard* —una
 * imagen-mosaico con una miniatura cada pocos segundos— y solo se recorta.
 */

/** Mosaico de rejilla uniforme, el que genera `scripts/storyboard.swift`. */
export type StoryboardIndex = {
  /** Segundos entre miniaturas. */
  interval: number;
  columns: number;
  rows: number;
  /** Tamaño de cada miniatura dentro del sprite, en píxeles. */
  width: number;
  height: number;
  count: number;
};

export type StoryboardSource =
  /** Sprite empaquetado con la app (`require`) más su índice. */
  | {image: ImageSourcePropType; index: StoryboardIndex}
  /** WebVTT de miniaturas, que es lo que sirven los empaquetadores. */
  | {vttUri: string};

/** Recorte que toca para un instante: qué imagen y qué trozo de ella. */
export type Tile = {
  image: ImageSourcePropType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Tamaño del sprite completo, para colocar el recorte. */
  sheetWidth: number;
  sheetHeight: number;
};

type Cue = Tile & {from: number; to: number};

/**
 * Resuelve la URL del sprite contra la del .vtt. A mano: el polyfill de `URL` de
 * React Native concatena base y ruta sin quitar el nombre de fichero de la base.
 */
function resolve(path: string, base: string) {
  if (/^[a-z]+:\/\//i.test(path)) {
    return path;
  }
  if (path.startsWith('/')) {
    return (base.match(/^[a-z]+:\/\/[^/]+/i)?.[0] ?? '') + path;
  }
  return base.slice(0, base.lastIndexOf('/') + 1) + path;
}

/** `sprite.jpg#xywh=160,0,160,92` → recorte; la URL se resuelve contra el .vtt. */
function parseVtt(text: string, vttUri: string): Cue[] {
  const cues: Cue[] = [];
  const lines = text.split(/\r?\n/);
  const sheets = new Map<string, {width: number; height: number}>();

  for (let i = 0; i < lines.length; i++) {
    const times = lines[i].match(
      /(\d+:)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d+:)?(\d{1,2}):(\d{2})[.,](\d{1,3})/,
    );
    if (!times) {
      continue;
    }
    const seconds = (h?: string, m?: string, s?: string, ms?: string) =>
      (parseInt(h ?? '0', 10) || 0) * 3600 +
      (parseInt(m ?? '0', 10) || 0) * 60 +
      (parseInt(s ?? '0', 10) || 0) +
      (parseInt(ms ?? '0', 10) || 0) / 1000;
    const from = seconds(times[1]?.replace(':', ''), times[2], times[3], times[4]);
    const to = seconds(times[5]?.replace(':', ''), times[6], times[7], times[8]);

    const payload = (lines[i + 1] ?? '').trim();
    if (!payload) {
      continue;
    }
    const [path, fragment] = payload.split('#xywh=');
    const [x, y, width, height] = (fragment ?? '')
      .split(',')
      .map(n => parseInt(n, 10) || 0);
    if (!width || !height) {
      continue;
    }
    const uri = resolve(path, vttUri);
    // El alto/ancho del sprite se deduce del recorte más lejano de cada imagen.
    const sheet = sheets.get(uri) ?? {width: 0, height: 0};
    sheet.width = Math.max(sheet.width, x + width);
    sheet.height = Math.max(sheet.height, y + height);
    sheets.set(uri, sheet);

    cues.push({
      from,
      to,
      image: {uri},
      x,
      y,
      width,
      height,
      sheetWidth: 0,
      sheetHeight: 0,
    });
  }

  return cues.map(cue => {
    const sheet = sheets.get((cue.image as {uri: string}).uri)!;
    return {...cue, sheetWidth: sheet.width, sheetHeight: sheet.height};
  });
}

/** Devuelve la función que da el recorte de un instante (o null si no hay storyboard). */
export default function useStoryboard(source?: StoryboardSource) {
  const [cues, setCues] = useState<Cue[] | null>(null);
  const vttUri = source && 'vttUri' in source ? source.vttUri : null;

  useEffect(() => {
    if (!vttUri) {
      setCues(null);
      return;
    }
    let cancelled = false;
    fetch(vttUri)
      .then(r => r.text())
      .then(text => {
        if (!cancelled) {
          setCues(parseVtt(text, vttUri));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCues([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vttUri]);

  return useMemo(() => {
    if (source && 'index' in source) {
      const {image, index} = source;
      return (time: number): Tile | null => {
        if (!index.interval) {
          return null;
        }
        const i = Math.max(
          0,
          Math.min(index.count - 1, Math.floor(time / index.interval)),
        );
        return {
          image,
          x: (i % index.columns) * index.width,
          y: Math.floor(i / index.columns) * index.height,
          width: index.width,
          height: index.height,
          sheetWidth: index.columns * index.width,
          sheetHeight: index.rows * index.height,
        };
      };
    }
    if (cues?.length) {
      return (time: number): Tile | null =>
        cues.find(cue => time >= cue.from && time < cue.to) ??
        (time >= cues[cues.length - 1].to ? cues[cues.length - 1] : null);
    }
    return () => null;
  }, [source, cues]);
}
