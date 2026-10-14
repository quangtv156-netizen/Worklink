/**
 * CV Upload & AI Scan Routes
 * POST /api/cv/upload   — upload file CV (PDF/DOCX/TXT), return extracted text
 * POST /api/cv/analyze  — analyze CV text with Gemini AI or intelligent local ATS engine
 */
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import mammoth from "mammoth";
import { createRequire } from "module";
import { authenticateToken } from "../middleware/auth.js";
import { aiLimiter, cvAnalyzeLimiter } from "../middleware/rateLimiter.js";
import { query, get, run } from "../db.js";
import { uploadToS3, getPresignedUrl } from "../config/s3.js";
import { enqueueCvAnalyzeJob } from "../config/queue.js";

const require = createRequire(import.meta.url);
/** pdf-parse v2 = class PDFParse; v1 = function(buffer) */
let PDFParseLib = null;
try {
  const mod = require("pdf-parse");
  PDFParseLib = mod.PDFParse || mod.default || mod;
} catch (e) {
  console.error(
    "[CV] pdf-parse chưa được cài. Chạy: npm install pdf-parse —",
    e.message,
  );
}

async function extractPdfText(buf) {
  if (!PDFParseLib) return "";
  // v2: class with getText()
  if (typeof PDFParseLib === "function" && PDFParseLib.prototype?.getText) {
    const parser = new PDFParseLib({ data: buf });
    try {
      const result = await parser.getText();
      return (result?.text || "").replace(/\s+/g, " ").trim();
    } finally {
      if (typeof parser.destroy === "function") {
        try {
          await parser.destroy();
        } catch {}
      }
    }
  }
  // v1: function(buffer) -> { text }
  if (typeof PDFParseLib === "function") {
    const data = await PDFParseLib(buf);
    return (data?.text || "").replace(/\s+/g, " ").trim();
  }
  return "";
}

const router = express.Router();

// Cho phép payload 15MB riêng cho route CV để xử lý base64 PDF
router.use(express.json({ limit: "15mb" }));
router.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ============================================================
// Multer Config — lưu file CV bền vững vào thư mục uploads/cv/
// ============================================================
export const CV_UPLOAD_DIR =
  process.env.CV_UPLOAD_DIR || path.join(process.cwd(), "uploads", "cv");
if (!fs.existsSync(CV_UPLOAD_DIR))
  fs.mkdirSync(CV_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CV_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(
      null,
      `cv-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`,
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file PDF, DOC, DOCX hoặc TXT"));
    }
  },
});

// ============================================================
// Helper: Trích xuất text từ file upload
// ============================================================
/**
 * Kiểm tra text extract có phải rác (font encoding / binary) không
 */
function isGarbledText(text) {
  if (!text || text.length < 40) return true;
  const sample = text.slice(0, 2000);
  const weird = (
    sample.match(
      /[^\x20-\x7E\u00C0-\u024F\u1E00-\u1EFF\s.,;:!?@#%&*()\-+/'"\u0100-\u017F]/g,
    ) || []
  ).length;
  if (weird / sample.length > 0.25) return true;
  const cjk = (sample.match(/[\u3000-\u9FFF]/g) || []).length;
  if (cjk > 20) return true;
  return false;
}

/**
 * Trích xuất text từ file upload (PDF / DOCX / TXT)
 * Dùng pdf-parse cho PDF — không còn fallback CV mẫu "Nguyễn Minh Anh"
 */
async function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const buf = fs.readFileSync(filePath);

  if (ext === ".txt") {
    return buf.toString("utf-8").replace(/\s+/g, " ").trim();
  }

  if (ext === ".pdf") {
    if (!PDFParseLib) {
      console.error(
        "[CV PDF] pdf-parse module missing — không thể đọc PDF trên server",
      );
      return "";
    }
    try {
      const text = await extractPdfText(buf);
      if (text.length >= 40 && !isGarbledText(text)) {
        console.log("[CV PDF] extract OK, length =", text.length);
        return text;
      }
      console.warn(
        "[CV PDF] Text không dùng được (ngắn hoặc rác). length=",
        text.length,
      );
    } catch (e) {
      console.warn("[CV PDF] extract failed:", e.message);
    }
    return "";
  }

  if (ext === ".docx") {
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      const extracted = (result.value || "").replace(/\s+/g, " ").trim();
      if (extracted.length > 30 && !isGarbledText(extracted)) {
        return extracted;
      }
    } catch (e) {
      console.warn("[CV DOCX] mammoth failed:", e.message);
    }
    return "";
  }

  if (ext === ".doc") {
    console.warn(
      "[CV DOC] Định dạng .doc cũ không được hỗ trợ tốt. Dùng PDF/DOCX/TXT.",
    );
    return "";
  }

  return buf.toString("utf-8").replace(/\s+/g, " ").trim();
}

// ============================================================
// Helper: Khám phá Model Gemini hợp lệ (Tránh lỗi 404 model not found)
// ============================================================
const modelCache = new Map();

async function getWorkingGeminiModel(apiKey) {
  const cacheKey = apiKey ? apiKey.slice(0, 8) : "default";
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);

  const preferredCandidates = [
    process.env.GEMINI_MODEL,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
  ].filter(Boolean);

  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        signal: AbortSignal.timeout(3000),
      },
    );
    if (listRes.ok) {
      const data = await listRes.json();
      const models = data?.models || [];
      const supported = models
        .filter((m) =>
          m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m) => m.name.replace("models/", ""));

      for (const pref of preferredCandidates) {
        if (supported.includes(pref)) {
          console.log(
            `[Gemini Discovery] Auto-selected verified model: ${pref}`,
          );
          modelCache.set(cacheKey, pref);
          return pref;
        }
      }
      const anyFlash = supported.find((m) => m.includes("flash"));
      if (anyFlash) {
        modelCache.set(cacheKey, anyFlash);
        return anyFlash;
      }
    }
  } catch (err) {
    console.warn("[Gemini Discovery] ListModels query skipped:", err.message);
  }

  const fallback = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  modelCache.set(cacheKey, fallback);
  return fallback;
}

// ============================================================
// Helper: Gọi Gemini API với cơ chế tự động thử model thay thế
// ============================================================
async function analyzeWithGemini(cvText, fileBase64, mimeType, allJobs = []) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error("no_api_key");

  const jobContext = allJobs
    .slice(0, 20)
    .map(
      (j) =>
        `[${j.id}] ${j.title} tại ${j.company} – ${j.category} – ${j.district} – Lương: ${j.salary_display || j.salary_text || "Thỏa thuận"}`,
    )
    .join("\n");

  const systemPrompt = `Bạn là chuyên gia phân tích CV/Resume và ATS (Applicant Tracking System). 
Hãy phân tích CV của ứng viên và trả về JSON CHÍNH XÁC theo schema sau (không giải thích thêm):

{
  "candidateName": "tên ứng viên hoặc null",
  "email": "email nếu tìm thấy hoặc null",  
  "phone": "số điện thoại nếu tìm thấy hoặc null",
  "atsScore": <số 40-98>,
  "experienceLevel": "Thực tập sinh / Sinh viên / Junior / Mid-level / Senior",
  "summary": "2-3 câu tóm tắt profile ứng viên bằng tiếng Việt",
  "detectedSkills": ["kỹ năng 1", "kỹ năng 2", ...],
  "education": "học vấn ngắn gọn",
  "strengths": ["điểm mạnh 1", "điểm mạnh 2", "điểm mạnh 3"],
  "improvements": ["góp ý cải thiện 1", "góp ý 2", "góp ý 3"],
  "matchedJobIds": ["id_job_1", "id_job_2", "id_job_3"]
}

Danh sách việc làm hiện tại để match:
${jobContext || "Không có dữ liệu job."}

Quy tắc atsScore:
- 85-98: CV xuất sắc (có đầy đủ contact, học vấn, kinh nghiệm định lượng, kỹ năng nhiều)
- 70-84: CV tốt  
- 55-69: CV trung bình, còn thiếu sót
- 40-54: CV yếu, cần cải thiện nhiều`;

  const parts = [];
  if (fileBase64 && mimeType) {
    parts.push({ inlineData: { mimeType, data: fileBase64 } });
    parts.push({
      text: `Hãy đọc CV trong file ảnh/PDF trên và phân tích theo yêu cầu:\n${systemPrompt}`,
    });
  } else {
    parts.push({
      text: `${systemPrompt}\n\nNội dung CV:\n---\n${cvText}\n---`,
    });
  }

  const primaryModel = await getWorkingGeminiModel(GEMINI_API_KEY);
  const modelsToTry = Array.from(
    new Set([
      primaryModel,
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
    ]),
  );

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1500,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (resp.ok) {
        const data = await resp.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const cleaned = raw
          .replace(/^```json\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
        const parsed = JSON.parse(cleaned);
        return { parsed, modelUsed: model };
      }

      const errText = await resp.text();
      console.warn(
        `[Gemini Model ${model}] returned ${resp.status}: ${errText.slice(0, 120)}`,
      );
      lastError = new Error(
        `Gemini API error ${resp.status}: ${errText.slice(0, 160)}`,
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Không thể kết nối với mô hình Gemini AI");
}

// ============================================================
// POST /api/cv/upload
// Upload file CV — trả về text extract + fileId để analyze (BẮT BUỘC ĐĂNG NHẬP)
// ============================================================
router.post(
  "/upload",
  authenticateToken,
  aiLimiter,
  upload.single("cv"),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Vui lòng chọn file CV (PDF, DOCX, TXT, tối đa 5MB)",
        });
    }

    try {
      const { path: filePath, originalname, mimetype, size } = req.file;
      const extractedText = await extractTextFromFile(filePath, originalname);

      let fileBase64 = null;
      let detectedMime = mimetype;
      const lowerName = originalname.toLowerCase();

      // Luôn gửi base64 với PDF/DOCX để Gemini Vision đọc được khi text extract rỗng
      if (
        lowerName.endsWith(".pdf") ||
        lowerName.endsWith(".docx") ||
        lowerName.endsWith(".doc") ||
        !extractedText
      ) {
        const buf = fs.readFileSync(filePath);
        // Giới hạn ~4MB base64 để payload không quá lớn
        if (buf.length <= 4 * 1024 * 1024) {
          fileBase64 = buf.toString("base64");
        }
        if (lowerName.endsWith(".pdf")) {
          detectedMime = "application/pdf";
        } else if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) {
          detectedMime =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
      }

      const fileId = path.basename(filePath);
      const s3Key = `cv/${req.user?.id || "anon"}/${fileId}`;

      // ☁️ AWS S3 Storage Adapter: Tải file CV lên Private Bucket
      try {
        const fileBuffer = fs.readFileSync(filePath);
        await uploadToS3({
          buffer: fileBuffer,
          key: s3Key,
          contentType: detectedMime || "application/pdf",
          metadata: {
            originalName: encodeURIComponent(originalname),
            userId: String(req.user?.id || "anon"),
          },
        });
      } catch (s3Err) {
        console.warn("[S3 CV Upload Warning]:", s3Err.message);
      }

      // Tạo Pre-signed URL có thời hạn 15 phút (không mở public bucket)
      const presignedUrl = await getPresignedUrl(s3Key, 900);

      res.json({
        success: true,
        fileId,
        s3Key,
        presignedUrl,
        fileName: originalname,
        fileSize: size,
        extractedText: extractedText || "",
        fileBase64: fileBase64 || null,
        mimeType: detectedMime,
        needsVision: !extractedText,
      });
    } catch (err) {
      console.error("[CV Upload Error]", err);
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }
      res
        .status(500)
        .json({
          success: false,
          message: err.message || "Lỗi tải lên file CV",
        });
    }
  },
);

/**
 * GET /api/cv/:fileId/presigned-url
 * Lấy Pre-signed URL có thời hạn (15 phút) để xem/tải CV từ AWS S3 Private Bucket
 */
router.get("/:fileId/presigned-url", authenticateToken, async (req, res) => {
  try {
    const rawId = path.basename(req.params.fileId);
    const s3Key = `cv/${req.user?.id || "anon"}/${rawId}`;
    const presignedUrl = await getPresignedUrl(s3Key, 900);

    res.json({
      success: true,
      fileId: rawId,
      s3Key,
      presignedUrl,
      expiresInSeconds: 900,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi tạo Pre-signed URL cho CV" });
  }
});

// ============================================================
// POST /api/cv/analyze
// Phân tích CV text/file với Gemini AI hoặc Fallback Local ATS Engine (BẮT BUỘC ĐĂNG NHẬP)
// Hỗ trợ chế độ chạy ngầm BullMQ Queue qua async: true hoặc POST /api/cv/analyze-queue
// ============================================================
router.post(
  "/analyze",
  authenticateToken,
  cvAnalyzeLimiter,
  async (req, res) => {
    const { cvText, fileBase64, mimeType } = req.body;

    if (!cvText && !fileBase64) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cần cung cấp nội dung CV hoặc file tải lên",
        });
    }

    // 🔒 Kiểm tra hạn mức AI Quota (Mặc định 5 lượt; Admin được miễn phí không giới hạn)
    const isAdmin = req.user?.role === "admin";
    if (req.user?.id && !isAdmin) {
      const userRow = await get("SELECT ai_quota FROM users WHERE id = ?", [
        req.user.id,
      ]).catch(() => null);
      const currentQuota = userRow
        ? userRow.ai_quota !== null && userRow.ai_quota !== undefined
          ? userRow.ai_quota
          : 5
        : 5;
      if (currentQuota <= 0) {
        return res.status(403).json({
          success: false,
          code: "AI_QUOTA_EXCEEDED",
          message:
            "Bạn đã sử dụng hết hạn mức 5 lượt quét CV bằng Gemini AI. Vui lòng nâng cấp tài khoản để tiếp tục!",
        });
      }
      // Ghi chú: Logic trừ quota được chuyển xuống SAU KHI phân tích CV thành công
    }

    try {
      // Lấy danh sách jobs từ CSDL PostgreSQL để so khớp (bao gồm các trường yêu cầu & kinh nghiệm)
      let allJobs = [];
      try {
        allJobs = await query(`
        SELECT id, title, company, company_logo, category, district, city, salary_display, salary_type, job_type, time_shift, experience, requirements, description 
        FROM jobs 
        WHERE (moderation_status IS NULL OR moderation_status = 'approved')
        ORDER BY is_pinned DESC, is_hot DESC, created_at DESC 
        LIMIT 50
      `);
      } catch {
        allJobs = [];
      }

      // ⚡ BullMQ Background Queue: Nếu client yêu cầu phân tích ngầm (tách khỏi HTTP Request chính)
      if (req.body.async === true || req.body.runInQueue === true) {
        const cvaId = `cva-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const enqueued = await enqueueCvAnalyzeJob({
          cvaId,
          userId: req.user?.id,
          cvName: req.body.cvName,
          cvText,
          fileBase64,
          mimeType,
          allJobs,
        });

        return res.status(202).json({
          success: true,
          queued: true,
          message:
            "Tác vụ gọi API Gemini phân tích CV đã được tách và đưa vào hàng đợi BullMQ chạy ngầm.",
          jobId: enqueued.jobId,
          cvaId,
          status: "processing",
        });
      }

      // 🔒 Bảo mật: Chỉ dùng GEMINI_API_KEY từ biến môi trường máy chủ
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      let result = null;
      let source = "WorkLink AI ATS Engine 🧠";
      let fallbackNotice = null;

      if (GEMINI_API_KEY && GEMINI_API_KEY.trim()) {
        try {
          const { parsed, modelUsed } = await analyzeWithGemini(
            cvText,
            fileBase64,
            mimeType,
            allJobs,
          );
          result = parsed;
          source = `Gemini AI (${modelUsed})`;
        } catch (geminiErr) {
          console.warn(
            "[Gemini Analyze Fallback] Switch to WorkLink ATS Engine:",
            geminiErr.message,
          );
          result = localAnalyzeCV(cvText || "", allJobs);
          source = "WorkLink AI ATS Engine 🧠";
          fallbackNotice =
            "Hệ thống đã tự động chuyển sang Động cơ Phân tích ATS Nội bộ WorkLink để đảm bảo quá trình không bị gián đoạn.";
        }
      } else {
        result = localAnalyzeCV(cvText || "", allJobs);
        source = "WorkLink AI ATS Engine 🧠";
      }

      // Enrich matchedJobs với dữ liệu chi tiết và tính điểm độ khớp có căn cứ logic giải thích được
      // Sử dụng thuật toán Heuristic tính điểm thực tế (Skill Match: 60%, Experience Match: 40%)
      const candidateProfile = {
        detectedSkills: result.detectedSkills || [],
        experienceLevel: result.experienceLevel || "Sinh viên / Entry-level",
      };

      const scoredJobs = allJobs
        .map((j) => {
          const match = calculateCvJobMatch(candidateProfile, j);
          return {
            job: j,
            matchPercentage: match.matchPercentage,
            matchedReason: match.matchedReason,
            breakdown: match.breakdown,
          };
        })
        .sort((a, b) => b.matchPercentage - a.matchPercentage);

      const matchedJobs = scoredJobs.slice(0, 5);

      // 🔒 Lưu lịch sử phân tích CV (CV Analyses History)
      if (req.user?.id) {
        const cvaId = `cva-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        await run(
          `
        INSERT INTO cv_analyses (id, user_id, cv_name, ats_score, summary, strengths, improvements, breakdown, matched_jobs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
          [
            cvaId,
            req.user.id,
            req.body.cvName || "Hồ sơ ứng viên",
            result.atsScore || 75,
            result.summary || "",
            JSON.stringify(result.strengths || []),
            JSON.stringify(result.improvements || []),
            JSON.stringify({ skillsWeight: "60%", experienceWeight: "40%" }),
            JSON.stringify(matchedJobs),
          ],
        ).catch((e) => console.warn("[CV History Save Warn]:", e.message));
      }

      // 🔒 Trừ quota AI SAU KHI phân tích CV thành công (Bỏ qua đối với Quản trị viên)
      if (req.user?.id && req.user?.role !== "admin") {
        await run(
          "UPDATE users SET ai_quota = ai_quota - 1, ai_quota_used = COALESCE(ai_quota_used, 0) + 1 WHERE id = ? AND ai_quota > 0",
          [req.user.id],
        ).catch(() => {});
      }

      return res.json({
        success: true,
        source,
        fallbackNotice,
        atsScore: result.atsScore || 75,
        candidateName: result.candidateName || null,
        email: result.email || null,
        phone: result.phone || null,
        experienceLevel: result.experienceLevel || "Thực tập sinh / Sinh viên",
        summary: result.summary || "",
        detectedSkills: result.detectedSkills || [],
        categorizedSkills: result.categorizedSkills || null,
        education: result.education || "",
        strengths: result.strengths || [],
        improvements: result.improvements || [],
        matchedJobs,
      });
    } catch (err) {
      console.error("[CV Analyze Error Handler]", err);
      const fallbackResult = localAnalyzeCV(cvText || "", []);

      // 🔒 Trừ quota AI SAU KHI phân tích CV thành công qua ATS Engine dự phòng
      if (req.user?.id && req.user?.role !== "admin") {
        await run(
          "UPDATE users SET ai_quota = ai_quota - 1, ai_quota_used = COALESCE(ai_quota_used, 0) + 1 WHERE id = ? AND ai_quota > 0",
          [req.user.id],
        ).catch(() => {});
      }

      return res.json({
        success: true,
        source: "WorkLink AI ATS Engine (Dự phòng)",
        ...fallbackResult,
      });
    }
  },
);

/**
 * POST /api/cv/analyze-queue
 * Endpoint chuyên dụng: Đưa tác vụ phân tích CV vào BullMQ Queue chạy ngầm (Non-blocking)
 */
router.post(
  "/analyze-queue",
  authenticateToken,
  cvAnalyzeLimiter,
  async (req, res) => {
    const { cvText, fileBase64, mimeType, cvName } = req.body;

    if (!cvText && !fileBase64) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cần cung cấp nội dung CV hoặc file tải lên",
        });
    }

    // 🔒 Kiểm tra hạn mức AI Quota (Mặc định 5 lượt, Admin được miễn phí không giới hạn)
    const isAdmin = req.user?.role === "admin";
    if (req.user?.id && !isAdmin) {
      const userRow = await get("SELECT ai_quota FROM users WHERE id = ?", [
        req.user.id,
      ]).catch(() => null);
      const currentQuota = userRow
        ? userRow.ai_quota !== null && userRow.ai_quota !== undefined
          ? userRow.ai_quota
          : 5
        : 5;
      if (currentQuota <= 0) {
        return res.status(403).json({
          success: false,
          code: "AI_QUOTA_EXCEEDED",
          message:
            "Bạn đã sử dụng hết hạn mức 5 lượt quét CV bằng Gemini AI. Vui lòng nâng cấp tài khoản để tiếp tục!",
        });
      }
    }

    try {
      let allJobs = [];
      try {
        allJobs = await query(`
        SELECT id, title, company, company_logo, category, district, city, salary_display, salary_type, job_type, time_shift, experience, requirements, description 
        FROM jobs 
        WHERE (moderation_status IS NULL OR moderation_status = 'approved')
        ORDER BY is_pinned DESC, is_hot DESC, created_at DESC 
        LIMIT 50
      `);
      } catch {
        allJobs = [];
      }

      const cvaId = `cva-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const enqueued = await enqueueCvAnalyzeJob({
        cvaId,
        userId: req.user?.id,
        cvName: cvName || "Hồ sơ ứng viên (Queue)",
        cvText,
        fileBase64,
        mimeType,
        allJobs,
      });

      res.status(202).json({
        success: true,
        queued: true,
        message:
          "Đã đưa tác vụ gọi API Gemini phân tích CV vào hàng đợi BullMQ chạy ngầm thành công!",
        jobId: enqueued.jobId,
        cvaId,
        status: "processing",
      });
    } catch (err) {
      console.error("[CV Analyze Queue Error]:", err);
      res
        .status(500)
        .json({ success: false, message: "Lỗi đưa tác vụ vào hàng đợi" });
    }
  },
);

/**
 * GET /api/cv/queue-status/:cvaId
 * Truy vấn kết quả phân tích CV từ BullMQ Queue Background Worker
 */
router.get("/queue-status/:cvaId", authenticateToken, async (req, res) => {
  try {
    const row = await get(
      "SELECT * FROM cv_analyses WHERE id = ? AND (user_id = ? OR user_id IS NULL) AND deleted_at IS NULL",
      [req.params.cvaId, req.user.id],
    );

    if (!row) {
      return res.json({
        success: true,
        status: "processing",
        message: "Tác vụ đang được BullMQ Worker xử lý trong hàng đợi ngầm...",
      });
    }

    let strengths = [];
    let improvements = [];
    let matchedJobs = [];
    try {
      strengths = JSON.parse(row.strengths);
    } catch {}
    try {
      improvements = JSON.parse(row.improvements);
    } catch {}
    try {
      matchedJobs = JSON.parse(row.matched_jobs);
    } catch {}

    res.json({
      success: true,
      status: "completed",
      data: {
        id: row.id,
        cvName: row.cv_name,
        atsScore: row.ats_score,
        summary: row.summary,
        strengths,
        improvements,
        matchedJobs,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi truy vấn trạng thái hàng đợi" });
  }
});

/**
 * GET /api/cv/history
 * Xem lịch sử các lần phân tích CV của người dùng hiện tại
 */
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      "SELECT * FROM cv_analyses WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20",
      [req.user.id],
    );

    const history = rows.map((r) => {
      let strengths = [];
      let improvements = [];
      let matchedJobs = [];
      try {
        strengths = JSON.parse(r.strengths);
      } catch {}
      try {
        improvements = JSON.parse(r.improvements);
      } catch {}
      try {
        matchedJobs = JSON.parse(r.matched_jobs);
      } catch {}
      return {
        id: r.id,
        cvName: r.cv_name,
        atsScore: r.ats_score,
        summary: r.summary,
        strengths,
        improvements,
        matchedJobs,
        createdAt: r.created_at,
      };
    });

    res.json({ success: true, count: history.length, history });
  } catch (error) {
    console.error("Lỗi lấy lịch sử CV:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// ============================================================
// Local High-Performance ATS Engine & Heuristic Match
// ============================================================

// 1. Từ điển kỹ năng chuyên sâu phân theo nhóm (Tech + Tools + Soft + Business)
export const SKILL_RULES = [
  // Nhóm 1: Kỹ năng chuyên môn & Lập trình (Technical)
  { name: "React", category: "technical", regex: /\breact(?:\.js|js)?\b/i },
  {
    name: "JavaScript ES6+",
    category: "technical",
    regex: /\b(?:javascript|js|es6\+?)\b/i,
  },
  {
    name: "TypeScript",
    category: "technical",
    regex: /\b(?:typescript|ts)\b/i,
  },
  {
    name: "HTML5/CSS3",
    category: "technical",
    regex: /\b(?:html|html5|css|css3|scss|sass)\b/i,
  },
  {
    name: "Tailwind CSS",
    category: "technical",
    regex: /\btailwind(?:\s*css)?\b/i,
  },
  { name: "Node.js", category: "technical", regex: /\bnode(?:\.js|js)?\b/i },
  {
    name: "Express.js",
    category: "technical",
    regex: /\bexpress(?:\.js|js)?\b/i,
  },
  {
    name: "PostgreSQL",
    category: "technical",
    regex: /\b(?:postgresql|postgres)\b/i,
  },
  { name: "MySQL", category: "technical", regex: /\bmysql\b/i },
  { name: "MongoDB", category: "technical", regex: /\bmongo(?:db)?\b/i },
  {
    name: "RESTful API",
    category: "technical",
    regex: /\brest(?:ful)?\s*api\b/i,
  },
  { name: "Python", category: "technical", regex: /\bpython\b/i },
  { name: "Java", category: "technical", regex: /\bjava\b(?!script)/i },
  {
    name: "Spring Boot",
    category: "technical",
    regex: /\bspring(?:\s*boot)?\b/i,
  },
  { name: "Vue.js", category: "technical", regex: /\bvue(?:\.js|js)?\b/i },
  { name: "Next.js", category: "technical", regex: /\bnext(?:\.js|js)?\b/i },
  { name: "Flutter", category: "technical", regex: /\bflutter\b/i },
  { name: "React Native", category: "technical", regex: /\breact\s*native\b/i },
  {
    name: "Responsive Design",
    category: "technical",
    regex: /\bresponsive\b/i,
  },
  {
    name: "Redux / Zustand",
    category: "technical",
    regex: /\b(?:redux|zustand)\b/i,
  },

  // Nhóm 2: Công cụ, Nền tảng & Hạ tầng (Tools & Platforms)
  { name: "Git / GitHub", category: "tools", regex: /\bgit(?:hub|lab)?\b/i },
  { name: "Docker", category: "tools", regex: /\bdocker\b/i },
  { name: "Linux OS", category: "tools", regex: /\blinux\b/i },
  { name: "Figma UI/UX", category: "tools", regex: /\bfigma\b/i },
  { name: "Postman", category: "tools", regex: /\bpostman\b/i },
  {
    name: "VS Code",
    category: "tools",
    regex: /\bvs\s*code|visual\s*studio\b/i,
  },
  { name: "CI/CD Pipelines", category: "tools", regex: /\bci[\/-]?cd\b/i },
  {
    name: "Vercel / Cloud Deploy",
    category: "tools",
    regex: /\bvercel|render|aws|cloud\b/i,
  },

  // Nhóm 3: Ngoại ngữ & Kỹ năng Mềm (Soft Skills & Languages)
  {
    name: "Tiếng Anh giao tiếp",
    category: "soft",
    regex: /\b(?:tiếng anh|english|toeic|ielts)\b/i,
  },
  {
    name: "Làm việc nhóm (Teamwork)",
    category: "soft",
    regex: /\blàm việc nhóm|teamwork|phối hợp\b/i,
  },
  {
    name: "Giải quyết vấn đề",
    category: "soft",
    regex: /\bgiải quyết vấn đề|problem\s*solving\b/i,
  },
  {
    name: "Quản lý thời gian",
    category: "soft",
    regex: /\bquản lý thời gian|time\s*management\b/i,
  },
  { name: "Tư duy logic", category: "soft", regex: /\blogic|tư duy\b/i },
  {
    name: "Chủ động học hỏi",
    category: "soft",
    regex: /\bhọc hỏi|tự học|cầu tiến\b/i,
  },

  // Nhóm 4: Kinh doanh, Marketing & Văn phòng (Business & Office)
  { name: "SEO & Content", category: "business", regex: /\bseo|content\b/i },
  {
    name: "Digital Marketing",
    category: "business",
    regex: /\bmarketing|facebook\s*ads|google\s*ads\b/i,
  },
  {
    name: "Tin học VP / Excel",
    category: "business",
    regex: /\b(?:excel|word|powerpoint|tin học)\b/i,
  },
  {
    name: "Dịch vụ & Giao tiếp KH",
    category: "business",
    regex: /\bchăm sóc khách|khách hàng|phục vụ|thu ngân|sales\b/i,
  },
];

/**
 * Thuật toán Heuristic tính độ khớp giữa CV và Job với trọng số thực tế:
 * - Kỹ năng chuyên môn (Skill Match): 60% trọng số (tối đa 60 điểm)
 * - Mức độ kinh nghiệm (Experience Match): 40% trọng số (tối đa 40 điểm)
 *
 * Loại bỏ việc chấm điểm "lạc quan" chung chung. Điểm phản ánh thực tế độ tương thích.
 */
export function calculateCvJobMatch(cvProfile, job) {
  const candidateSkills = Array.isArray(cvProfile?.detectedSkills)
    ? cvProfile.detectedSkills
    : [];
  const candidateLevel =
    cvProfile?.experienceLevel || "Sinh viên / Entry-level";

  // 1. Phân tích yêu cầu kỹ năng của công việc (Job Target Skills)
  let jobReqs = [];
  if (Array.isArray(job.requirements)) {
    jobReqs = job.requirements;
  } else if (typeof job.requirements === "string") {
    try {
      jobReqs = job.requirements.startsWith("[")
        ? JSON.parse(job.requirements)
        : job.requirements.split(",").map((s) => s.trim());
    } catch {
      jobReqs = job.requirements.split(",").map((s) => s.trim());
    }
  }

  const jobFullText =
    `${job.title || ""} ${job.category || ""} ${job.description || ""} ${jobReqs.join(" ")}`.toLowerCase();

  // Xác định các kỹ năng công việc yêu cầu từ từ điển SKILL_RULES hoặc requirements
  const targetJobSkills = [];
  for (const rule of SKILL_RULES) {
    if (rule.regex.test(jobFullText)) {
      targetJobSkills.push(rule.name);
    }
  }
  if (targetJobSkills.length === 0 && jobReqs.length > 0) {
    targetJobSkills.push(...jobReqs.slice(0, 5));
  }

  // So khớp kỹ năng: Candidate Skills vs Job Target Skills
  const matchedSkills = [];
  const missingSkills = [];

  if (targetJobSkills.length > 0) {
    for (const reqSkill of targetJobSkills) {
      const isMatched = candidateSkills.some(
        (cs) =>
          cs.toLowerCase() === reqSkill.toLowerCase() ||
          reqSkill.toLowerCase().includes(cs.toLowerCase()) ||
          cs.toLowerCase().includes(reqSkill.toLowerCase()),
      );
      if (isMatched) {
        matchedSkills.push(reqSkill);
      } else {
        missingSkills.push(reqSkill);
      }
    }
  } else {
    for (const cs of candidateSkills) {
      if (jobFullText.includes(cs.toLowerCase())) {
        matchedSkills.push(cs);
      }
    }
  }

  // ========================================================
  // TRỌNG SỐ 1: KỸ NĂNG CHUYÊN MÔN (SKILL MATCH - 60% / 60 ĐIỂM)
  // ========================================================
  let skillRatio = 0;
  if (targetJobSkills.length > 0) {
    skillRatio = matchedSkills.length / targetJobSkills.length;
  } else if (candidateSkills.length > 0) {
    skillRatio = Math.min(1, matchedSkills.length / 4);
  }

  // Điểm kỹ năng tính chính xác: tối đa 60 điểm (nếu 0 kỹ năng khớp -> 0đ)
  const skillScore = Math.round(Math.min(60, skillRatio * 60));

  // ========================================================
  // TRỌNG SỐ 2: MỨC ĐỘ KINH NGHIỆM (EXPERIENCE MATCH - 40% / 40 ĐIỂM)
  // ========================================================
  let candidateRank = 0; // 0: Intern/Sinh viên, 1: Fresher, 2: Junior (1-2 năm), 3: Mid/Senior (3+ năm)
  const clow = candidateLevel.toLowerCase();
  if (
    clow.includes("senior") ||
    clow.includes("mid") ||
    clow.includes("trưởng") ||
    clow.includes("lead") ||
    clow.includes("3+")
  ) {
    candidateRank = 3;
  } else if (
    clow.includes("junior") ||
    clow.includes("1-2") ||
    clow.includes("1 năm") ||
    clow.includes("2 năm")
  ) {
    candidateRank = 2;
  } else if (clow.includes("fresher") || clow.includes("mới tốt nghiệp")) {
    candidateRank = 1;
  } else {
    candidateRank = 0;
  }

  const jobExpStr = `${job.experience || ""} ${job.title || ""}`.toLowerCase();
  let jobRequiredRank = 0;
  if (/senior|trưởng nhóm|lead|3 năm|4 năm|5 năm|mid/i.test(jobExpStr)) {
    jobRequiredRank = 3;
  } else if (/junior|1 năm|2 năm|1_year|2_years/i.test(jobExpStr)) {
    jobRequiredRank = 2;
  } else if (/fresher|mới tốt nghiệp/i.test(jobExpStr)) {
    jobRequiredRank = 1;
  } else {
    jobRequiredRank = 0; // NO_EXPERIENCE / Thực tập / Sinh viên
  }

  let experienceScore = 0;
  if (jobRequiredRank === 0) {
    if (candidateRank <= 1) experienceScore = 40;
    else if (candidateRank === 2) experienceScore = 34;
    else experienceScore = 26;
  } else if (jobRequiredRank === 1) {
    if (candidateRank === 1) experienceScore = 40;
    else if (candidateRank === 2) experienceScore = 36;
    else if (candidateRank === 0) experienceScore = 30;
    else experienceScore = 25;
  } else if (jobRequiredRank === 2) {
    if (candidateRank === 2) experienceScore = 40;
    else if (candidateRank === 3) experienceScore = 38;
    else if (candidateRank === 1) experienceScore = 22;
    else experienceScore = 12;
  } else {
    if (candidateRank === 3) experienceScore = 40;
    else if (candidateRank === 2) experienceScore = 18;
    else if (candidateRank === 1) experienceScore = 8;
    else experienceScore = 4;
  }

  const matchPercentage = Math.min(
    100,
    Math.max(0, skillScore + experienceScore),
  );

  let matchedReason = "";
  if (matchedSkills.length > 0) {
    matchedReason = `Khớp ${matchedSkills.length} kỹ năng (${matchedSkills.slice(0, 3).join(", ")} - ${skillScore}/60đ) • Kinh nghiệm (${experienceScore}/40đ)`;
  } else {
    matchedReason = `Chưa phát hiện kỹ năng yêu cầu phù hợp (${skillScore}/60đ) • Độ tương thích kinh nghiệm (${experienceScore}/40đ)`;
  }

  return {
    matchPercentage,
    matchedReason,
    breakdown: {
      skillScore,
      maxSkillScore: 60,
      skillWeight: "60%",
      experienceScore,
      maxExperienceScore: 40,
      experienceWeight: "40%",
      matchedSkills,
      missingSkills: missingSkills.slice(0, 5),
      candidateLevel,
      requiredLevel:
        jobRequiredRank === 3
          ? "Mid/Senior"
          : jobRequiredRank === 2
            ? "Junior"
            : jobRequiredRank === 1
              ? "Fresher"
              : "Không yêu cầu kinh nghiệm",
    },
  };
}

export function localAnalyzeCV(text, allJobs = []) {
  const lower = text.toLowerCase();
  let atsScore = 55;

  // 1. Phân tích Thông tin liên hệ
  const emailMatch = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  );
  const phoneMatch = text.match(/(?:\+84|0)[3|5|7|8|9][0-9]{8}/);
  const email = emailMatch ? emailMatch[0] : null;
  const phone = phoneMatch ? phoneMatch[0] : null;

  if (email || phone) atsScore += 10;
  if (email && phone) atsScore += 5;

  // 2. Phân tích Học vấn & Ngoại ngữ
  const hasEducation =
    /đại học|cao đẳng|học viện|university|college|bách khoa|công nghệ|quốc gia|kinh tế|fpt|hust|neu|ftu/.test(
      lower,
    );
  const hasToeic = /toeic\s*(\d{3})/i.exec(text);
  const hasIelts = /ielts\s*([\d.]+)/i.exec(text);
  let education = "";
  if (hasEducation) {
    atsScore += 8;
    education = "Sinh viên / Cử nhân chuyên ngành liên quan";
  }
  if (hasToeic) {
    education += (education ? " • " : "") + `TOEIC ${hasToeic[1]}`;
    atsScore += 6;
  } else if (hasIelts) {
    education += (education ? " • " : "") + `IELTS ${hasIelts[1]}`;
    atsScore += 6;
  } else if (/tiếng anh|english/i.test(lower)) {
    education += (education ? " • " : "") + "Tiếng Anh giao tiếp";
    atsScore += 3;
  }

  // 3. Phân tích Dự án & Định lượng
  const hasProjects =
    /dự án|project|e-commerce|manager|website|hệ thống|ứng dụng/i.test(lower);
  const hasMetrics =
    /\d+\s*(?:sản phẩm|người dùng|khách|user|%|tháng|k|m)/i.test(lower);
  if (hasProjects) atsScore += 8;
  if (hasMetrics) atsScore += 7;

  // 4. Phát hiện kỹ năng theo SKILL_RULES
  const detectedSkills = [];
  const categorizedSkills = {
    technical: [],
    tools: [],
    soft: [],
    business: [],
  };

  for (const rule of SKILL_RULES) {
    if (rule.regex.test(text)) {
      detectedSkills.push(rule.name);
      if (categorizedSkills[rule.category]) {
        categorizedSkills[rule.category].push(rule.name);
      }
    }
  }

  // Không còn ép kỹ năng mẫu — để trống nếu CV không match rule
  if (detectedSkills.length === 0) {
    console.warn("[Local ATS] Không phát hiện kỹ năng nào từ text CV");
  }

  // Tăng điểm ATS tổng theo số lượng kỹ năng
  atsScore += Math.min(25, detectedSkills.length * 2);
  atsScore = Math.min(Math.max(atsScore, 65), 95);

  // 5. Cấp độ kinh nghiệm
  let experienceLevel = "Sinh viên / Entry-level";
  if (/thực tập|intern|sinh viên|tìm thực tập/i.test(lower)) {
    experienceLevel = "Thực tập sinh (Internship)";
  } else if (/senior|lead|trưởng nhóm|3 năm|4 năm|5 năm/i.test(lower)) {
    experienceLevel = "Mid / Senior Level (3+ năm)";
  } else if (/junior|1 năm|2 năm/i.test(lower)) {
    experienceLevel = "Junior (1-2 năm kinh nghiệm)";
  }

  // 6. Điểm mạnh (Strengths)
  const strengths = [];
  if (detectedSkills.length >= 4) {
    strengths.push(
      `Bộ kỹ năng chuyên môn phong phú (${detectedSkills.slice(0, 4).join(", ")}...), đáp ứng rất tốt tiêu chuẩn tuyển dụng.`,
    );
  }
  if (hasProjects || text.includes("dự án")) {
    strengths.push(
      "Có kinh nghiệm triển khai dự án thực tế với các công nghệ phổ biến trên thị trường.",
    );
  }
  if (hasMetrics || text.includes("%")) {
    strengths.push(
      "Biết sử dụng số liệu định lượng cụ thể để chứng minh kết quả công việc (điểm cộng lớn trong hệ thống ATS).",
    );
  }
  if (hasToeic || hasIelts || /tiếng anh/i.test(lower)) {
    strengths.push(
      "Trình độ ngoại ngữ tốt, sẵn sàng làm việc với tài liệu kỹ thuật hoặc môi trường quốc tế.",
    );
  }
  if (strengths.length === 0) {
    strengths.push(
      "Hồ sơ có nền tảng học vấn vững chắc và định hướng công việc rõ ràng.",
    );
  }

  // 7. Góp ý cải thiện (Improvements)
  const improvements = [];
  if (!email || !phone) {
    improvements.push(
      "Bổ sung rõ ràng số điện thoại và email ở đầu CV để nhà tuyển dụng có thể liên hệ ngay.",
    );
  }
  if (!/github|gitlab|portfolio|linkedin/i.test(lower)) {
    improvements.push(
      "Bổ sung liên kết GitHub, Portfolio trực tuyến hoặc LinkedIn để tăng uy tín chuyên môn.",
    );
  }
  if (!hasMetrics) {
    improvements.push(
      'Bổ sung các con số định lượng cụ thể (ví dụ: "Tối ưu tốc độ tải trang 30%", "Phục vụ 200+ khách/ngày").',
    );
  }
  if (improvements.length < 2) {
    improvements.push(
      "Mô tả chi tiết hơn về các thách thức kỹ thuật và giải pháp bạn đã áp dụng trong từng dự án.",
    );
  }

  // 8. Tóm tắt profile
  const topSkillStr =
    detectedSkills.slice(0, 4).join(", ") || "Chuyên môn liên quan";
  const summary = `Ứng viên định hướng vị trí ${experienceLevel} với nền tảng kỹ năng về ${topSkillStr}. Đã có kinh nghiệm thực hành qua các dự án thực tế và tinh thần chủ động học hỏi cao.`;

  // 9. Tính matchedJobIds bằng thuật toán heuristic trọng số 60/40
  const candidateProfile = { detectedSkills, experienceLevel };
  const matchedList = (allJobs || [])
    .map((j) => {
      const match = calculateCvJobMatch(candidateProfile, j);
      return {
        id: j.id,
        matchPercentage: match.matchPercentage,
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);

  const matchedJobIds = matchedList.slice(0, 5).map((m) => m.id);

  // Cố gắng lấy tên từ dòng đầu CV (thường là tên in hoa)
  let candidateName = "Ứng viên";
  const nameLine = text
    .split(/\n/)
    .map((l) => l.trim())
    .find(
      (l) =>
        l.length >= 5 &&
        l.length <= 60 &&
        !/@/.test(l) &&
        !/\d{8,}/.test(l) &&
        /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]+$/i.test(
          l.replace(/[^A-Za-zÀ-ỹĐđ\s]/g, ""),
        ),
    );
  if (nameLine) {
    candidateName = nameLine.replace(/\s+/g, " ").trim();
  } else if (email) {
    candidateName = email.split("@")[0];
  }

  return {
    atsScore,
    candidateName,
    email,
    phone,
    experienceLevel,
    summary,
    detectedSkills,
    categorizedSkills,
    education: education || "Chưa xác định",
    strengths,
    improvements,
    matchedJobIds,
  };
}

export default router;
