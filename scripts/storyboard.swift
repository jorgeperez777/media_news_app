#!/usr/bin/env swift
//
// Genera el storyboard (sprite + índice) que usa la vista previa de la barra de
// duración, al estilo de YouTube: una imagen-mosaico con una miniatura cada N
// segundos y un JSON que dice qué recorte toca en cada instante.
//
//   swift scripts/storyboard.swift <url o fichero> <salida sin extensión> [intervalo] [ancho]
//
// Ejemplo:
//   swift scripts/storyboard.swift \
//     https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8 \
//     assets/storyboards/big-buck-bunny 5 160
//
// Usa AVFoundation (macOS), así que funciona igual con HLS remoto y con MP4.
// El equivalente con ffmpeg, para Linux/CI, está en el README.
//
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Args {
    let input: String
    let output: String
    let interval: Double
    let tileWidth: Int
}

func parseArgs() -> Args {
    let a = CommandLine.arguments
    guard a.count >= 3 else {
        FileHandle.standardError.write(
            "uso: storyboard.swift <url|fichero> <salida sin extensión> [intervalo=5] [ancho=160]\n"
                .data(using: .utf8)!)
        exit(2)
    }
    return Args(
        input: a[1],
        output: a[2],
        interval: a.count > 3 ? Double(a[3]) ?? 5 : 5,
        tileWidth: a.count > 4 ? Int(a[4]) ?? 160 : 160)
}

let args = parseArgs()
var url =
    args.input.hasPrefix("http")
    ? URL(string: args.input)! : URL(fileURLWithPath: args.input)

/// Descarga sincrónica sencilla (el script es de un solo uso, no hace falta más).
func fetch(_ url: URL) -> Data? {
    var result: Data?
    let done = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: url) { data, _, _ in
        result = data
        done.signal()
    }.resume()
    done.wait()
    return result
}

/// AVFoundation no saca fotogramas de un HLS remoto ("The operation could not be
/// completed"), pero sí lee un MPEG-TS local. Así que para un .m3u8 bajamos la
/// variante más ligera —para miniaturas sobra— y la pegamos en un fichero temporal.
func downloadHLS(_ master: URL) -> URL? {
    guard let text = fetch(master).flatMap({ String(data: $0, encoding: .utf8) }) else {
        return nil
    }
    let lines = text.components(separatedBy: .newlines).map {
        $0.trimmingCharacters(in: .whitespaces)
    }

    var mediaURL = master
    var lowest = Int.max
    for (i, line) in lines.enumerated() where line.hasPrefix("#EXT-X-STREAM-INF") {
        let bandwidth =
            line.components(separatedBy: "BANDWIDTH=").last
            .flatMap { Int($0.prefix(while: { $0.isNumber })) } ?? 0
        guard i + 1 < lines.count, !lines[i + 1].isEmpty else { continue }
        if bandwidth < lowest {
            lowest = bandwidth
            mediaURL = URL(string: lines[i + 1], relativeTo: master) ?? master
        }
    }

    guard let mediaText = fetch(mediaURL).flatMap({ String(data: $0, encoding: .utf8) }) else {
        return nil
    }
    let mediaLines = mediaText.components(separatedBy: .newlines).map {
        $0.trimmingCharacters(in: .whitespaces)
    }

    // fMP4: el segmento de inicialización va primero o no hay nada que decodificar.
    var parts: [URL] = []
    var isFragmentedMP4 = false
    for line in mediaLines {
        if line.hasPrefix("#EXT-X-MAP") {
            isFragmentedMP4 = true
            if let uri = line.components(separatedBy: "URI=\"").last?.components(separatedBy: "\"").first,
                let initURL = URL(string: uri, relativeTo: mediaURL)
            {
                parts.append(initURL)
            }
        } else if !line.hasPrefix("#"), !line.isEmpty,
            let segment = URL(string: line, relativeTo: mediaURL)
        {
            parts.append(segment)
        }
    }
    guard !parts.isEmpty else { return nil }

    let temp = FileManager.default.temporaryDirectory
        .appendingPathComponent("storyboard-\(UUID().uuidString)")
        .appendingPathExtension(isFragmentedMP4 ? "mp4" : "ts")
    FileManager.default.createFile(atPath: temp.path, contents: nil)
    guard let handle = try? FileHandle(forWritingTo: temp) else { return nil }
    print("bajando \(parts.count) segmentos de la variante más ligera (\(lowest / 1000) kb/s)…")
    for (i, part) in parts.enumerated() {
        guard let data = fetch(part) else {
            FileHandle.standardError.write("aviso: falló el segmento \(i)\n".data(using: .utf8)!)
            continue
        }
        handle.write(data)
    }
    try? handle.close()
    return temp
}

var temporaryCopy: URL?
if url.pathExtension == "m3u8" {
    guard let local = downloadHLS(url) else {
        FileHandle.standardError.write("no se pudo bajar el HLS\n".data(using: .utf8)!)
        exit(1)
    }
    temporaryCopy = local
    url = local
}

let asset = AVURLAsset(url: url)
let semaphore = DispatchSemaphore(value: 0)
var duration: Double = 0
var naturalSize = CGSize(width: 16, height: 9)

Task {
    duration = try await CMTimeGetSeconds(asset.load(.duration))
    if let track = try await asset.loadTracks(withMediaType: .video).first {
        let size = try await track.load(.naturalSize)
        if size.width > 0, size.height > 0 {
            naturalSize = size
        }
    }
    semaphore.signal()
}
semaphore.wait()

guard duration.isFinite, duration > 0 else {
    FileHandle.standardError.write("no se pudo leer la duración (¿es un directo?)\n".data(using: .utf8)!)
    exit(1)
}

let tileWidth = args.tileWidth
let tileHeight = Int((Double(tileWidth) * naturalSize.height / naturalSize.width).rounded())
let count = max(1, Int(ceil(duration / args.interval)))
// Rejilla lo más cuadrada posible: menos filas altísimas y sprites más manejables.
let columns = max(1, Int(ceil(Double(count).squareRoot())))
let rows = Int(ceil(Double(count) / Double(columns)))

print("duración \(Int(duration))s · \(count) miniaturas de \(tileWidth)x\(tileHeight) · rejilla \(columns)x\(rows)")

let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = CMTime(seconds: args.interval / 2, preferredTimescale: 600)
generator.requestedTimeToleranceAfter = CMTime(seconds: args.interval / 2, preferredTimescale: 600)
generator.maximumSize = CGSize(width: tileWidth * 2, height: tileHeight * 2)

let width = columns * tileWidth
let height = rows * tileHeight
guard
    let context = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
else {
    FileHandle.standardError.write("no se pudo crear el lienzo\n".data(using: .utf8)!)
    exit(1)
}
context.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: width, height: height))

for i in 0..<count {
    let time = CMTime(seconds: Double(i) * args.interval, preferredTimescale: 600)
    let frame: CGImage
    do {
        frame = try generator.copyCGImage(at: time, actualTime: nil)
    } catch {
        FileHandle.standardError.write(
            "aviso: sin fotograma en \(Int(Double(i) * args.interval))s: \(error.localizedDescription)\n"
                .data(using: .utf8)!)
        continue
    }
    let column = i % columns
    let row = i / columns
    // CoreGraphics dibuja con el origen abajo; el índice cuenta las filas desde arriba.
    let rect = CGRect(
        x: column * tileWidth, y: (rows - row - 1) * tileHeight,
        width: tileWidth, height: tileHeight)
    context.draw(frame, in: rect)
    if i % 10 == 0 {
        print("  \(i)/\(count)")
    }
}

guard let sprite = context.makeImage() else {
    FileHandle.standardError.write("no se pudo componer el sprite\n".data(using: .utf8)!)
    exit(1)
}

let jpegURL = URL(fileURLWithPath: args.output + ".jpg")
try? FileManager.default.createDirectory(
    at: jpegURL.deletingLastPathComponent(), withIntermediateDirectories: true)
guard
    let destination = CGImageDestinationCreateWithURL(
        jpegURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
else {
    FileHandle.standardError.write("no se pudo escribir \(jpegURL.path)\n".data(using: .utf8)!)
    exit(1)
}
CGImageDestinationAddImage(destination, sprite, [kCGImageDestinationLossyCompressionQuality: 0.6] as CFDictionary)
CGImageDestinationFinalize(destination)

// Índice: rejilla uniforme, así que basta con el tamaño de la miniatura y el
// intervalo; la app calcula el recorte (ver components/storyboard.ts).
let index: [String: Any] = [
    "interval": args.interval,
    "columns": columns,
    "rows": rows,
    "width": tileWidth,
    "height": tileHeight,
    "count": count,
]
let jsonURL = URL(fileURLWithPath: args.output + ".json")
let data = try JSONSerialization.data(withJSONObject: index, options: [.prettyPrinted, .sortedKeys])
try data.write(to: jsonURL)

// También el WebVTT equivalente, que es lo que sirven los empaquetadores.
var vtt = "WEBVTT\n\n"
let sprintName = jpegURL.lastPathComponent
func stamp(_ seconds: Double) -> String {
    let h = Int(seconds) / 3600, m = (Int(seconds) % 3600) / 60, s = Int(seconds) % 60
    let ms = Int((seconds - seconds.rounded(.down)) * 1000)
    return String(format: "%02d:%02d:%02d.%03d", h, m, s, ms)
}
for i in 0..<count {
    let from = Double(i) * args.interval
    let to = min(duration, from + args.interval)
    let x = (i % columns) * tileWidth
    let y = (i / columns) * tileHeight
    vtt += "\(stamp(from)) --> \(stamp(to))\n"
    vtt += "\(sprintName)#xywh=\(x),\(y),\(tileWidth),\(tileHeight)\n\n"
}
try vtt.write(to: URL(fileURLWithPath: args.output + ".vtt"), atomically: true, encoding: .utf8)

if let temporaryCopy {
    try? FileManager.default.removeItem(at: temporaryCopy)
}

print("escrito \(jpegURL.path), \(jsonURL.path) y \(args.output).vtt")
