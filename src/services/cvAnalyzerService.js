import { removeVietnameseTones } from "./aiSearchService";

/**
 * Service to parse and analyze user CV/Resume text
 * Computes ATS score, identifies key skills, and calculates compatibility with current jobs.
 */

const COMMON_SKILLS_DICTIONARY = [
  // Tech & Digital
  { name: "React", keywords: ["react", "reactjs", "redux", "frontend"] },
  { name: "Node.js", keywords: ["node", "nodejs", "express", "backend"] },
  {
    name: "JavaScript / TypeScript",
    keywords: ["javascript", "typescript", "js", "ts"],
  },
  {
    name: "HTML & CSS / Tailwind",
    keywords: ["html", "css", "tailwind", "bootstrap"],
  },
  {
    name: "UI/UX Design / Figma",
    keywords: ["figma", "photoshop", "illustrator", "ui", "ux", "thiet ke"],
  },
  {
    name: "SEO & Content Writing",
    keywords: ["content", "seo", "viet bai", "copywriter", "social"],
  },
  {
    name: "Digital Marketing",
    keywords: ["marketing", "ads", "facebook ads", "tiktok ads", "quang cao"],
  },

  // F&B & Services
  {
    name: "Pha chế (Barista / Bartender)",
    keywords: ["pha che", "barista", "bartender", "ca phe", "tra sua"],
  },
  {
    name: "Phục vụ bàn & Khách hàng",
    keywords: ["phuc vu", "order", "don ban", "chao khach", "nha hang"],
  },
  {
    name: "Thu ngân & Quản lý tiền",
    keywords: ["thu ngan", "tinh tien", "pos", "kiem kho", "hoa don"],
  },
  {
    name: "Giao tiếp & Tư vấn bán hàng",
    keywords: [
      "giao tiep",
      "tu van",
      "ban hang",
      "sales",
      "cham soc khach hang",
    ],
  },

  // Education & Office
  {
    name: "Gia sư & Giảng dạy",
    keywords: ["gia su", "day hoc", "tro giang", "toan", "tieng anh", "van"],
  },
  {
    name: "Tiếng Anh giao tiếp (IELTS / TOEIC)",
    keywords: ["tieng anh", "english", "ielts", "toeic", "giao tiep tieng anh"],
  },
  {
    name: "Tin học văn phòng (Word, Excel)",
    keywords: ["word", "excel", "powerpoint", "van phong", "nhap lieu"],
  },
  {
    name: "Làm việc nhóm & Quản lý thời gian",
    keywords: [
      "lam viec nhom",
      "teamwork",
      "dung gio",
      "trach nhiem",
      "nhanh nhen",
    ],
  },
];

export function analyzeCandidateCV(cvText, allJobs = []) {
  if (!cvText || cvText.trim().length < 20) {
    throw new Error(
      "Nội dung CV quá ngắn. Vui lòng nhập tối thiểu 20 ký tự để AI có thể phân tích.",
    );
  }

  const rawNorm = removeVietnameseTones(cvText.toLowerCase());

  // 1. Detect Skills
  const detectedSkills = [];
  for (const skill of COMMON_SKILLS_DICTIONARY) {
    const isMatched = skill.keywords.some((kw) =>
      rawNorm.includes(removeVietnameseTones(kw)),
    );
    if (isMatched) {
      detectedSkills.push(skill.name);
    }
  }

  // 2. Detect Experience Level
  let experienceLevel = "Sinh viên / Mới bắt đầu (Entry-level)";
  if (
    rawNorm.includes("3 nam") ||
    rawNorm.includes("4 nam") ||
    rawNorm.includes("5 nam") ||
    rawNorm.includes("senior")
  ) {
    experienceLevel = "Senior (3+ năm kinh nghiệm)";
  } else if (
    rawNorm.includes("1 nam") ||
    rawNorm.includes("2 nam") ||
    rawNorm.includes("junior") ||
    rawNorm.includes("da tung lam")
  ) {
    experienceLevel = "Junior (1-2 năm kinh nghiệm)";
  } else if (
    rawNorm.includes("thuc tap") ||
    rawNorm.includes("intern") ||
    rawNorm.includes("chua co kinh nghiem")
  ) {
    experienceLevel = "Thực tập sinh / Chưa có kinh nghiệm";
  }

  // 3. Compute ATS Quality Score (0 - 100)
  let atsScore = 50; // base score
  const checks = {
    hasContact: false,
    hasEducation: false,
    hasSkills: false,
    hasNumbers: false,
    hasExperience: false,
  };

  // Contact info check
  if (
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/.test(cvText) ||
    /(0[3|5|7|8|9])+([0-9]{8})\b/.test(cvText)
  ) {
    atsScore += 12;
    checks.hasContact = true;
  }

  // Education check
  if (
    rawNorm.includes("dai hoc") ||
    rawNorm.includes("cao dang") ||
    rawNorm.includes("hoc vien") ||
    rawNorm.includes("tot nghiep") ||
    rawNorm.includes("sinh vien")
  ) {
    atsScore += 10;
    checks.hasEducation = true;
  }

  // Skills check
  if (detectedSkills.length >= 3) {
    atsScore += 15;
    checks.hasSkills = true;
  } else if (detectedSkills.length > 0) {
    atsScore += 8;
  }

  // Quantifiable numbers / metrics check
  if (/\d+%|\d+\s*(khach|luot|trieu|tr|nguoi|du an|san pham)/.test(rawNorm)) {
    atsScore += 13;
    checks.hasNumbers = true;
  }

  atsScore = Math.min(Math.max(atsScore, 40), 98);

  // 4. Generate ATS Feedback & Recommendations
  const strengths = [];
  const improvements = [];

  if (checks.hasContact) {
    strengths.push(
      "Thông tin liên hệ rõ ràng (Email/Số điện thoại), tiện liên lạc.",
    );
  } else {
    improvements.push(
      "Bổ sung Số điện thoại & Email trực tiếp để nhà tuyển dụng có thể gọi điện ngay.",
    );
  }

  if (detectedSkills.length >= 3) {
    strengths.push(
      `Hồ sơ chứa nhiều từ khóa kỹ năng quan trọng (${detectedSkills.length} kỹ năng nổi bật).`,
    );
  } else {
    improvements.push(
      "Bổ sung thêm từ khóa chuyên môn (ví dụ: Pha chế, POS, React, Giao tiếp, Tiếng Anh).",
    );
  }

  if (checks.hasNumbers) {
    strengths.push(
      "Có số liệu định lượng thành tích trong kinh nghiệm làm việc.",
    );
  } else {
    improvements.push(
      'Nên thêm số liệu định lượng (ví dụ: "Phục vụ 100+ khách/ngày", "Tăng 20% tương tác").',
    );
  }

  if (
    !rawNorm.includes("ca toi") &&
    !rawNorm.includes("part-time") &&
    !rawNorm.includes("linh hoat") &&
    !rawNorm.includes("thu 2")
  ) {
    improvements.push(
      "Nếu ứng tuyển part-time, hãy ghi rõ các buổi/ca làm việc có thể nhận để tăng 40% tỷ lệ phản hồi.",
    );
  }

  // 5. Match with All Available Jobs in System (Realistic Heuristic: 60% Skills + 40% Experience)
  const matchedJobs = allJobs
    .map((job) => {
      // hashtags / requirements có thể là mảng hoặc chuỗi → [].concat luôn cho ra mảng
      const hashtagsText = [].concat(job.hashtags || []).join(" ");
      const requirementsText = [].concat(job.requirements || []).join(" ");
      const jobNorm = removeVietnameseTones(
        `${job.title || ""} ${job.company || ""} ${job.category || ""} ${job.description || ""} ${hashtagsText} ${requirementsText}`.toLowerCase(),
      );

      // 5.1 Skill Match Score (Trọng số 60% / tối đa 60 điểm)
      const matchedSkills = [];
      detectedSkills.forEach((skill) => {
        const skillKeywords = COMMON_SKILLS_DICTIONARY.find(
          (s) => s.name === skill,
        )?.keywords || [skill];
        const matchFound = skillKeywords.some((kw) =>
          jobNorm.includes(removeVietnameseTones(kw)),
        );
        if (matchFound) {
          matchedSkills.push(skill);
        }
      });

      const skillRatio =
        detectedSkills.length > 0
          ? Math.min(
              1,
              matchedSkills.length /
                Math.max(1, Math.min(4, detectedSkills.length)),
            )
          : 0;
      const skillScore = Math.round(skillRatio * 60);

      // 5.2 Experience Match Score (Trọng số 40% / tối đa 40 điểm)
      let candidateRank = 0;
      if (experienceLevel.includes("Senior") || experienceLevel.includes("3+"))
        candidateRank = 3;
      else if (
        experienceLevel.includes("Junior") ||
        experienceLevel.includes("1-2")
      )
        candidateRank = 2;
      else candidateRank = 0; // Entry-level / Sinh viên

      const jobExpStr = (job.experience || job.title || "").toLowerCase();
      let jobRequiredRank = 0;
      if (/senior|lead|3 nam|4 nam|5 nam/i.test(jobExpStr)) jobRequiredRank = 3;
      else if (/junior|1 nam|2 nam|1_year/i.test(jobExpStr))
        jobRequiredRank = 2;
      else jobRequiredRank = 0;

      let experienceScore = 0;
      if (jobRequiredRank === 0) {
        experienceScore = candidateRank <= 1 ? 40 : 30;
      } else if (jobRequiredRank === 2) {
        experienceScore =
          candidateRank === 2 ? 40 : candidateRank === 3 ? 38 : 15;
      } else {
        experienceScore =
          candidateRank === 3 ? 40 : candidateRank === 2 ? 18 : 6;
      }

      const matchPercentage = Math.min(
        100,
        Math.max(0, skillScore + experienceScore),
      );

      let matchedReason = "";
      if (matchedSkills.length > 0) {
        matchedReason = `Khớp ${matchedSkills.length} kỹ năng (${matchedSkills.slice(0, 2).join(", ")} - ${skillScore}/60đ) • Kinh nghiệm (${experienceScore}/40đ)`;
      } else {
        matchedReason = `Chưa khớp kỹ năng yêu cầu (${skillScore}/60đ) • Kinh nghiệm (${experienceScore}/40đ)`;
      }

      return {
        job,
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
        },
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage)
    .slice(0, 5);

  return {
    atsScore,
    experienceLevel,
    detectedSkills,
    strengths,
    improvements,
    matchedJobs,
  };
}
