import express from "express";
import crypto from "crypto";
import { query, get, run } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { createNotification } from "./notificationRoutes.js";

const router = express.Router();

// GET /api/freelance - Lấy danh sách dự án (hỗ trợ phân trang và bộ lọc)
router.get("/", async (req, res) => {
  try {
    const { page, limit, status, category, keyword } = req.query;
    let sql = "SELECT * FROM freelance_projects WHERE 1=1";
    const params = [];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    sql += " ORDER BY created_at DESC";
    const rows = await query(sql, params);
    let formatted = rows.map((r) => ({
      id: r.id,
      employerId: r.employer_id,
      title: r.title,
      client: r.client,
      budget: r.budget,
      budgetNum: r.budget_num,
      duration: r.duration,
      category: r.category,
      skills: r.skills ? r.skills.split(",").map((s) => s.trim()) : [],
      description: r.description,
      deadline: r.deadline,
      hashtags: r.hashtags ? r.hashtags.split(" ").filter(Boolean) : [],
      proposalsCount: r.proposals_count || 0,
      status: r.status,
    }));

    if (keyword) {
      const kw = keyword.toLowerCase().trim();
      formatted = formatted.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.client.toLowerCase().includes(kw) ||
          p.description.toLowerCase().includes(kw) ||
          p.skills.some((s) => s.toLowerCase().includes(kw)) ||
          p.hashtags.some((h) => h.toLowerCase().includes(kw)),
      );
    }

    const total = formatted.length;
    let paginatedProjects = formatted;
    let pagination = null;

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const totalPages = Math.ceil(total / limitNum) || 1;
      const offset = (pageNum - 1) * limitNum;
      paginatedProjects = formatted.slice(offset, offset + limitNum);
      pagination = {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      };
    } else {
      const MAX_DEFAULT_LIMIT = 50;
      if (paginatedProjects.length > MAX_DEFAULT_LIMIT) {
        paginatedProjects = paginatedProjects.slice(0, MAX_DEFAULT_LIMIT);
      }
    }

    res.json({
      success: true,
      count: paginatedProjects.length,
      total,
      pagination,
      projects: paginatedProjects,
    });
  } catch (error) {
    console.error("Lỗi lấy dự án Freelance:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// POST /api/freelance - NTD đăng dự án Freelance mới (Chỉ employer hoặc admin)
router.post("/", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "employer" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Chỉ Nhà tuyển dụng hoặc Quản trị viên mới có quyền đăng dự án Freelance",
      });
    }

    const {
      title,
      budget,
      budgetNum,
      duration,
      category,
      skills = [],
      description,
      deadline,
      hashtags = [],
    } = req.body;

    if (!title?.trim() || !budget?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề và ngân sách dự án là bắt buộc",
      });
    }

    const projectId = `fl-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const clientName =
      req.user.company || req.user.name || "Doanh nghiệp tuyển dụng";
    const skillsStr = Array.isArray(skills) ? skills.join(", ") : skills || "";
    const hashtagsStr = Array.isArray(hashtags)
      ? hashtags.join(" ")
      : hashtags || "";

    await run(
      `
      INSERT INTO freelance_projects (
        id, employer_id, title, client, budget, budget_num, duration, category, skills, description, deadline, hashtags, proposals_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'OPEN')
    `,
      [
        projectId,
        req.user.id,
        title.trim(),
        clientName,
        budget.trim(),
        Number(budgetNum) || 0,
        duration || "Thỏa thuận",
        category || "Công nghệ",
        skillsStr,
        description || "",
        deadline || "Theo tiến độ",
        hashtagsStr,
      ],
    );

    const created = await get("SELECT * FROM freelance_projects WHERE id = ?", [
      projectId,
    ]);
    res.status(201).json({
      success: true,
      message: "Đăng dự án Freelance thành công!",
      project: {
        id: created.id,
        employerId: created.employer_id,
        title: created.title,
        client: created.client,
        budget: created.budget,
        budgetNum: created.budget_num,
        duration: created.duration,
        category: created.category,
        skills: created.skills
          ? created.skills.split(",").map((s) => s.trim())
          : [],
        description: created.description,
        deadline: created.deadline,
        hashtags: created.hashtags
          ? created.hashtags.split(" ").filter(Boolean)
          : [],
        proposalsCount: 0,
        status: created.status,
      },
    });
  } catch (error) {
    console.error("Lỗi tạo dự án freelance:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi đăng dự án" });
  }
});

// GET /api/freelance/proposals/mine - Danh sách đề xuất của chính người dùng đăng nhập
router.get("/proposals/mine", authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.id, p.project_id, p.bid, p.duration, p.cover, p.created_at,
              pr.title AS project_title, pr.client AS client, pr.budget AS budget,
              pr.status AS project_status, pr.deadline AS deadline
       FROM freelance_proposals p
       LEFT JOIN freelance_projects pr ON p.project_id = pr.id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id],
    );
    res.json({ success: true, count: rows.length, proposals: rows });
  } catch (error) {
    console.error("Lỗi lấy đề xuất của tôi:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// POST /api/freelance/:id/proposals (BẮT BUỘC ĐĂNG NHẬP, LƯU ĐỀ XUẤT THẬT, CHỐNG TRÙNG)
router.post("/:id/proposals", authenticateToken, async (req, res) => {
  try {
    const { bid, duration, cover } = req.body;
    if (!bid || !cover?.trim()) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Vui lòng cung cấp mức giá và thư giới thiệu (cover letter)",
        });
    }

    const projectId = req.params.id;
    const project = await get(
      "SELECT id, employer_id, title, status FROM freelance_projects WHERE id = ?",
      [projectId],
    );
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dự án Freelance" });
    }

    if (project.status !== "OPEN") {
      return res
        .status(400)
        .json({ success: false, message: "Dự án này đã đóng nhận đề xuất" });
    }

    // Không cho phép chủ sở hữu dự án tự nộp đề xuất cho chính dự án của mình
    if (project.employer_id && project.employer_id === req.user.id) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Bạn là chủ dự án này nên không thể tự gửi đề xuất",
        });
    }

    const userId = req.user.id;
    const applicantName = req.user.name || "Freelancer";

    // Chống gửi trùng đề xuất
    const existing = await get(
      "SELECT id FROM freelance_proposals WHERE project_id = ? AND user_id = ?",
      [projectId, userId],
    );
    if (existing) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Bạn đã gửi đề xuất cho dự án này rồi!",
        });
    }

    const proposalId = `prop-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const createdAt = new Date().toISOString();

    await run(
      `
      INSERT INTO freelance_proposals (id, project_id, user_id, applicant_name, bid, duration, cover, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        proposalId,
        projectId,
        userId,
        applicantName,
        String(bid).trim(),
        String(duration || "Linh hoạt").trim(),
        String(cover).trim(),
        createdAt,
      ],
    );

    // Tăng số lượng proposals_count của dự án
    await run(
      "UPDATE freelance_projects SET proposals_count = proposals_count + 1 WHERE id = ?",
      [projectId],
    );

    // Gửi thông báo cho chủ sở hữu dự án Freelance
    try {
      if (project.employer_id && project.employer_id !== userId) {
        await createNotification({
          userId: project.employer_id,
          type: "proposal",
          title: `Đề xuất mới cho dự án: ${project.title}`,
          body: `Freelancer ${applicantName} vừa gửi chào thầu: ${bid} (${duration || "Linh hoạt"})`,
          linkType: "freelance",
          linkId: projectId,
        });
      }
    } catch (notifErr) {
      console.warn("[Freelance] Lỗi tạo thông báo proposal:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Gửi đề xuất nhận dự án thành công!",
      proposal: {
        id: proposalId,
        projectId,
        userId,
        applicantName,
        bid,
        duration: duration || "Linh hoạt",
        cover,
        createdAt,
      },
    });
  } catch (error) {
    console.error("Lỗi gửi proposal:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi gửi đề xuất" });
  }
});

// GET /api/freelance/:id/proposals (Kiểm soát chặt chẽ quyền truy cập proposal)
router.get("/:id/proposals", authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await get(
      "SELECT id, employer_id, title FROM freelance_projects WHERE id = ?",
      [projectId],
    );
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dự án Freelance" });
    }

    const isOwner =
      req.user.role === "admin" ||
      (project.employer_id && req.user.id === project.employer_id);

    if (isOwner) {
      // Chủ dự án hoặc Admin: xem toàn bộ các đề xuất đã nộp
      const rows = await query(
        `SELECT id, project_id, user_id, applicant_name, bid, duration, cover, created_at 
         FROM freelance_proposals 
         WHERE project_id = ? 
         ORDER BY created_at DESC`,
        [projectId],
      );
      return res.json({
        success: true,
        count: rows.length,
        proposals: rows,
        isOwner: true,
      });
    }

    // Người dùng / Freelancer bình thường: CHỈ XEM ĐỀ XUẤT CỦA CHÍNH MÌNH
    const rows = await query(
      `SELECT id, project_id, user_id, applicant_name, bid, duration, cover, created_at 
       FROM freelance_proposals 
       WHERE project_id = ? AND user_id = ?
       ORDER BY created_at DESC`,
      [projectId, req.user.id],
    );

    return res.json({
      success: true,
      count: rows.length,
      proposals: rows,
      isOwner: false,
      notice:
        "Chỉ hiển thị đề xuất của bạn nhằm bảo vệ quyền riêng tư và cạnh tranh công bằng giữa các freelancer.",
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách proposals:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// PUT /api/freelance/:id - Chỉnh sửa dự án Freelance (Chỉ chủ sở hữu hoặc admin)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await get("SELECT * FROM freelance_projects WHERE id = ?", [
      projectId,
    ]);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dự án Freelance" });
    }

    const isOwner =
      req.user.role === "admin" ||
      (project.employer_id && req.user.id === project.employer_id);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message:
          "Từ chối quyền (403 Forbidden): Bạn không thể chỉnh sửa dự án của người khác!",
      });
    }

    const b = req.body;
    const VALID_FREELANCE_STATUSES = [
      "OPEN",
      "CLOSED",
      "IN_PROGRESS",
      "COMPLETED",
    ];
    if (
      b.status !== undefined &&
      !VALID_FREELANCE_STATUSES.includes(b.status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái dự án không hợp lệ. Chỉ chấp nhận: ${VALID_FREELANCE_STATUSES.join(", ")}`,
      });
    }
    const skillsStr = Array.isArray(b.skills)
      ? b.skills.join(", ")
      : (b.skills ?? project.skills);
    const hashtagsStr = Array.isArray(b.hashtags)
      ? b.hashtags.join(" ")
      : (b.hashtags ?? project.hashtags);

    await run(
      `
      UPDATE freelance_projects SET
        title = ?,
        budget = ?,
        budget_num = ?,
        duration = ?,
        category = ?,
        skills = ?,
        description = ?,
        deadline = ?,
        hashtags = ?,
        status = ?
      WHERE id = ?
    `,
      [
        b.title?.trim() ?? project.title,
        b.budget?.trim() ?? project.budget,
        b.budgetNum !== undefined ? Number(b.budgetNum) : project.budget_num,
        b.duration ?? project.duration,
        b.category ?? project.category,
        skillsStr,
        b.description ?? project.description,
        b.deadline ?? project.deadline,
        hashtagsStr,
        b.status ?? project.status,
        projectId,
      ],
    );

    const updated = await get("SELECT * FROM freelance_projects WHERE id = ?", [
      projectId,
    ]);
    res.json({
      success: true,
      message: "Cập nhật dự án Freelance thành công!",
      project: {
        id: updated.id,
        employerId: updated.employer_id,
        title: updated.title,
        client: updated.client,
        budget: updated.budget,
        budgetNum: updated.budget_num,
        duration: updated.duration,
        category: updated.category,
        skills: updated.skills
          ? updated.skills.split(",").map((s) => s.trim())
          : [],
        description: updated.description,
        deadline: updated.deadline,
        hashtags: updated.hashtags
          ? updated.hashtags.split(" ").filter(Boolean)
          : [],
        proposalsCount: updated.proposals_count,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật dự án freelance:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi cập nhật dự án" });
  }
});

// DELETE /api/freelance/:id - Xóa dự án Freelance (Chủ sở hữu hoặc admin)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await get("SELECT * FROM freelance_projects WHERE id = ?", [
      projectId,
    ]);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dự án Freelance" });
    }

    const isOwner =
      req.user.role === "admin" ||
      (project.employer_id && req.user.id === project.employer_id);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message:
          "Từ chối quyền (403 Forbidden): Bạn không thể xóa dự án của người khác!",
      });
    }

    await run("DELETE FROM freelance_proposals WHERE project_id = ?", [
      projectId,
    ]).catch(() => {});
    await run("DELETE FROM notifications WHERE link_type = ? AND link_id = ?", [
      "freelance",
      projectId,
    ]).catch(() => {});
    await run("DELETE FROM freelance_projects WHERE id = ?", [projectId]);

    res.json({
      success: true,
      message: "Đã xóa dự án Freelance và các đề xuất liên quan thành công!",
    });
  } catch (error) {
    console.error("Lỗi xóa dự án freelance:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi xóa dự án" });
  }
});

export default router;
