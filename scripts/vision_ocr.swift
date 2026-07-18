import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count >= 2 else {
    fputs("usage: vision_ocr image...\n", stderr)
    exit(2)
}

for imagePath in CommandLine.arguments.dropFirst() {
    guard let image = NSImage(contentsOfFile: imagePath),
          let data = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: data),
          let cgImage = bitmap.cgImage else {
        fputs("image-open-failed: \(imagePath)\n", stderr)
        continue
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])
    let observations = (request.results ?? []).sorted {
        if abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.008 {
            return $0.boundingBox.midY > $1.boundingBox.midY
        }
        return $0.boundingBox.minX < $1.boundingBox.minX
    }
    let rows: [[String: Any]] = observations.compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        return [
            "text": candidate.string,
            "confidence": candidate.confidence,
            "x": observation.boundingBox.minX,
            "y": observation.boundingBox.minY,
            "w": observation.boundingBox.width,
            "h": observation.boundingBox.height
        ]
    }
    let payload: [String: Any] = ["image": imagePath, "rows": rows]
    let json = try JSONSerialization.data(withJSONObject: payload)
    print(String(data: json, encoding: .utf8)!)
}
