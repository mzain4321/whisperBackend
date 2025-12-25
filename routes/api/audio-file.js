import { Router } from "express";
import { getAudioFile } from "../../controllers/liveTranscriptionController.js";

const router = Router();
import fs from "fs";
import path from "path";

// export async function GET(request) {
//   try {
//     const { searchParams } = new URL(request.url);
//     let fileName = searchParams.get("fileName");
//     const download = searchParams.get("download");
    
//     console.log("🔊 Audio file request:", { fileName, download });
    
//     if (!fileName) {
//       return new Response(JSON.stringify({ error: "File name required" }), {
//         status: 400,
//         headers: { "Content-Type": "application/json" },
//       });
//     }

//     // Security: Prevent directory traversal
//     const safeFileName = path.basename(fileName);
    
//     // Try multiple possible locations
//     const possiblePaths = [
//       path.join(process.cwd(), "src/app/uploads", safeFileName),
//       path.join(process.cwd(), "uploads", safeFileName),
//       path.join(process.cwd(), "public/uploads", safeFileName),
//       path.join(process.cwd(), safeFileName),
//     ];

//     let filePath = null;
//     let foundPath = null;

//     for (const possiblePath of possiblePaths) {
//       console.log("Checking path:", possiblePath);
//       if (fs.existsSync(possiblePath)) {
//         filePath = possiblePath;
//         foundPath = possiblePath;
//         break;
//       }
//     }

//     if (!filePath) {
//       // List all available files for debugging
//       const uploadDir = path.join(process.cwd(), "src/app/uploads");
//       let availableFiles = [];
//       if (fs.existsSync(uploadDir)) {
//         availableFiles = fs.readdirSync(uploadDir);
//       }
      
//       console.log("❌ File not found. Available files:", availableFiles);
      
//       return new Response(JSON.stringify({ 
//         error: "File not found",
//         requested: safeFileName,
//         available: availableFiles
//       }), {
//         status: 404,
//         headers: { "Content-Type": "application/json" },
//       });
//     }

//     console.log("✅ File found at:", foundPath);
    
//     const fileBuffer = fs.readFileSync(filePath);
//     const fileStats = fs.statSync(filePath);

//     // Determine content type based on file extension
//     const ext = path.extname(safeFileName).toLowerCase();
//     let contentType = "application/octet-stream";
    
//     if (ext === ".mp3") contentType = "audio/mpeg";
//     else if (ext === ".wav") contentType = "audio/wav";
//     else if (ext === ".ogg") contentType = "audio/ogg";
//     else if (ext === ".m4a") contentType = "audio/mp4";
//     else if (ext === ".webm") contentType = "audio/webm";

//     console.log("📦 Serving file:", {
//       name: safeFileName,
//       size: fileStats.size,
//       type: contentType,
//       path: foundPath
//     });

//     const headers = {
//       "Content-Type": contentType,
//       "Content-Length": fileStats.size.toString(),
//       "Cache-Control": "public, max-age=3600",
//       "Accept-Ranges": "bytes",
//     };

//     // Add download header if download parameter is present
//     if (download === "true") {
//       headers["Content-Disposition"] = `attachment; filename="${safeFileName}"`;
//     }

//     return new Response(fileBuffer, {
//       status: 200,
//       headers,
//     });
//   } catch (err) {
//     console.error("❌ Error serving audio file:", err);
//     return new Response(JSON.stringify({ 
//       error: "Internal server error",
//       details: err.message 
//     }), {
//       status: 500,
//       headers: { "Content-Type": "application/json" },
//     });
//   }
// }
router.get("/", getAudioFile);
export default router;