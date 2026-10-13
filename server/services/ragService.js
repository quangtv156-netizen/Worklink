import { query } from '../db.js';

/**
 * Remove Vietnamese accents/diacritics for ultra-flexible search matching
 */
export function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Stop words that should NOT be used as search criteria in SQL queries
 */
export const VIETNAMESE_STOP_WORDS = new Set([
  'toi', 'minh', 'em', 'anh', 'ban', 'chung toi', 'nguoi',
  'muon', 'can', 'tim', 'kiem', 'xem', 'co', 'nhung', 'cac',
  'viec', 'lam', 'cong viec', 'nghe', 'nganh', 'o', 'tai', 'khu vuc',
  'cho', 'voi', 'gi', 'nao', 'nhe', 'a', 'ha', 'oi', 'dum', 'giup',
  'duoc', 'khong', 'chua', 'di', 'ra', 'vao', 'den', 'tu', 'va', 'hoac',
  'thi', 'ma', 'la', 'nhu', 'de', 'rat', 'qua', 'lam sao', 'the nao'
]);

/**
 * Domain Category Definitions
 */
export const CATEGORY_DEFINITIONS = [
  {
    category: 'IT',
    label: 'Công nghệ thông tin (IT)',
    regex: /\b(it|cntt|cong nghe thong tin|lap trinh|developer|dev|frontend|backend|fullstack|react|reactjs|nextjs|node|nodejs|web|python|java|phan mem|tester|qa|qc|data|database)\b/i
  },
  {
    category: 'F&B',
    label: 'F&B (Nhà hàng / Quán cà phê)',
    regex: /\b(f&b|fnb|phuc vu|boi ban|chay ban|pha che|barista|ca phe|cafe|quan an|nha hang|tra sua|thu ngan quan|bep|phu bep)\b/i
  },
  {
    category: 'Bán hàng',
    label: 'Bán hàng & Thời trang',
    regex: /\b(ban hang|sales|tu van|shop|quan ao|thoi trang|cua hang|sieu thi|tap hoa|merchandiser|visual merchandiser)\b/i
  },
  {
    category: 'Marketing',
    label: 'Marketing & Truyền thông',
    regex: /\b(marketing|content|viet bai|fanpage|truyen thong|tiktok|seo|quang cao|copywriter|media)\b/i
  },
  {
    category: 'Gia sư',
    label: 'Gia sư & Giảng dạy',
    regex: /\b(gia su|day kem|tieng anh|day hoc|on thi|ielts|toan|tro giang)\b/i
  },
  {
    category: 'Kho vận',
    label: 'Kho vận & Đóng gói',
    regex: /\b(kho van|phu kho|dong goi|shopee|lazada|boc xep|giao nhan|van chuyen|logistics|thu kho|kho hang)\b/i
  },
  {
    category: 'Thiết kế',
    label: 'Thiết kế & Đồ họa',
    regex: /\b(thiet ke|designer|do hoa|photoshop|canva|figma|banner|logo)\b/i
  }
];

export const DISTRICT_DEFINITIONS = [
  { district: 'Cầu Giấy', regex: /\b(cau giay|dich vong|xuan thuy|tran thai tong|duy tan|trung hoa)\b/i },
  { district: 'Đống Đa', regex: /\b(dong da|hoang cau|chua boc|tay son|dang van ngu|thai ha|xa dan)\b/i },
  { district: 'Nam Từ Liêm', regex: /\b(nam tu liem|my dinh|keangnam|me tri)\b/i },
  { district: 'Bắc Từ Liêm', regex: /\b(bac tu liem|nhon|co nhue)\b/i },
  { district: 'Hai Bà Trưng', regex: /\b(hai ba trung|ba trieu|pho hue|bach mai|minh khai)\b/i },
  { district: 'Thanh Xuân', regex: /\b(thanh xuan|nguyen trai|khuat duy tien|le van luong)\b/i },
  { district: 'Hoàn Kiếm', regex: /\b(hoan kiem|pho co|trang tien|ho guom)\b/i },
  { district: 'Ba Đình', regex: /\b(ba dinh|kim ma|doi can|lieu giai)\b/i },
  { district: 'Hoàng Mai', regex: /\b(hoang mai|dinh cong|linh dam|giap bat)\b/i },
  { district: 'Hà Đông', regex: /\b(ha dong|quang trung|van quan)\b/i },
  { district: 'Tây Hồ', regex: /\b(tay ho|lac long quan|au co|xuan dieu)\b/i }
];

export const SHIFT_DEFINITIONS = [
  { 
    shift: 'Tối', 
    accentRegex: /\b(tối|ca tối|buổi tối|chiều tối|đêm|ca đêm)\b/i,
    normRegex: /\b(ca toi|buoi toi|chieu toi|lam toi|ca dem|lam dem|sau 18h|sau 17h|18h|19h|20h|21h|22h|23h)\b/i 
  },
  { 
    shift: 'Sáng', 
    accentRegex: /\b(sáng|ca sáng|buổi sáng)\b/i,
    normRegex: /\b(ca sang|buoi sang|lam sang|lam ca sang|vao buoi sang|7h|8h|9h|10h)\b/i 
  },
  { 
    shift: 'Chiều', 
    accentRegex: /\b(chiều|ca chiều|buổi chiều)\b/i,
    normRegex: /\b(ca chieu|buoi chieu|lam chieu|lam ca chieu|vao buoi chieu|13h|14h|15h|16h)\b/i 
  },
  { 
    shift: 'Linh hoạt', 
    accentRegex: /\b(linh hoạt|linh động|ca gãy|tùy chọn|tự do)\b/i,
    normRegex: /\b(linh hoat|linh dong|ca gay|tuy chon|tu do)\b/i 
  },
  { 
    shift: 'Hành chính', 
    accentRegex: /\b(hành chính|giờ hành chính|toàn thời gian)\b/i,
    normRegex: /\b(hanh chinh|gio hanh chinh|full time|toan thoi gian)\b/i 
  }
];

export const ROLE_DEFINITIONS = [
  { role: 'barista', regex: /\b(barista|pha che)\b/i },
  { role: 'phục vụ', regex: /\b(phuc vu|boi ban|chay ban)\b/i },
  { role: 'thu ngân', regex: /\b(thu ngan)\b/i },
  { role: 'frontend', regex: /\b(frontend|react|nextjs)\b/i },
  { role: 'backend', regex: /\b(backend|nodejs|express|database)\b/i },
  { role: 'lập trình', regex: /\b(lap trinh|developer|dev)\b/i },
  { role: 'bán hàng', regex: /\b(ban hang|sales|tu van)\b/i },
  { role: 'gia sư', regex: /\b(gia su|day kem|tro giang)\b/i },
  { role: 'content', regex: /\b(content|tiktok|viet bai)\b/i },
  { role: 'kho', regex: /\b(phu kho|nhan vien kho|dong goi|thu kho|kho van|kho hang|boc xep)\b/i }
];

/**
 * Known companies in the WorkLink database for precise RAG lookup
 */
const KNOWN_COMPANIES = [
  { key: 'the coffee lab', names: ['coffee lab', 'the coffee lab', 'bistro', 'quán cà phê trần thái tông'] },
  { key: 'nextgen tech', names: ['nextgen', 'nextgen tech', 'công nghệ nextgen'] },
  { key: 'vinafintech', names: ['vinafintech', 'vina fintech', 'fintech'] },
  { key: 'urban threads', names: ['urban threads', 'urban thread', 'thời trang urban'] },
  { key: 'media pulse', names: ['media pulse', 'pulse agency', 'mediapulse'] },
  { key: 'khởi sáng', names: ['khởi sáng', 'khoi sang', 'trung tâm gia sư', 'trung tam khoi sang'] },
  { key: 'fastlogistics', names: ['fastlogistics', 'fast logistics', 'kho shopee', 'kho vận'] }
];

/**
 * Analyze user message to determine primary intent & extract strict structured entities
 */
export function analyzeIntent(message) {
  const text = message.trim();
  const lower = text.toLowerCase();
  const norm = removeVietnameseTones(lower);

  // 1. Casual Greeting / Chit-chat (Check first to prevent false job search triggers)
  const isGreeting = (
    norm === 'chao' || norm === 'chao ban' || norm === 'xin chao' || norm === 'hello' ||
    norm === 'hi' || norm === 'hey' || norm === 'alo' || norm.startsWith('chao ban') ||
    norm.startsWith('xin chao') || norm === 'ban la ai' || norm === 'ban ten gi' ||
    norm === 'ai do' || norm === 'co ai o day khong' || norm === 'giup minh voi' ||
    norm === 'cam on' || norm === 'thank you' || norm === 'thanks' || norm === 'tam biet' ||
    norm === 'chuc mot ngay tot lanh'
  );

  // 2. Company-specific Query
  let matchedCompany = null;
  for (const comp of KNOWN_COMPANIES) {
    if (comp.names.some(n => norm.includes(removeVietnameseTones(n)))) {
      matchedCompany = comp.key;
      break;
    }
  }

  // 3. System Statistics / Market Benchmarks
  const isStatsQuery = (
    norm.includes('bao nhieu viec') || norm.includes('bao nhieu cong viec') ||
    norm.includes('co nhung nganh nao') || norm.includes('luong cao nhat') ||
    norm.includes('luong thap nhat') || norm.includes('thong ke') ||
    norm.includes('mat bang luong') || norm.includes('luong trung binh') ||
    norm.includes('ty le tuyen dung')
  );

  // 4. User's Applications Query
  const isUserAppsQuery = (
    norm.includes('don ung tuyen cua toi') || norm.includes('ho so cua toi') ||
    norm.includes('viec toi da nop') || norm.includes('toi da nop vao dau') ||
    norm.includes('trang thai ho so') || norm.includes('ho so da duyet chua')
  );

  // 5. Freelance or Gig Tasks Query
  const isFreelanceOrGig = (
    norm.includes('freelance') || norm.includes('du an') || norm.includes('proposal') ||
    norm.includes('gig') || norm.includes('viec vat') || norm.includes('giao hang') ||
    norm.includes('shipper') || norm.includes('don giao hang')
  );

  // 6. Career / CV / Interview Guidance
  const isCareerAdvice = (
    norm.includes('viet cv') || norm.includes('mau cv') || norm.includes('cham diem cv') ||
    norm.includes('phong van') || norm.includes('cau hoi phong van') || norm.includes('tra loi phong van') ||
    norm.includes('deal luong') || norm.includes('dam phan luong') || norm.includes('kinh nghiem di lam')
  );

  // 7. Extract Specific Domain Entities
  let extractedCategory = null;
  for (const cat of CATEGORY_DEFINITIONS) {
    if (cat.regex.test(norm)) {
      extractedCategory = cat.category;
      break;
    }
  }

  let extractedDistrict = null;
  for (const dist of DISTRICT_DEFINITIONS) {
    if (dist.regex.test(norm)) {
      extractedDistrict = dist.district;
      break;
    }
  }

  let extractedShift = null;
  for (const s of SHIFT_DEFINITIONS) {
    if ((s.accentRegex && s.accentRegex.test(lower)) || (s.normRegex && s.normRegex.test(norm))) {
      extractedShift = s.shift;
      break;
    }
  }

  let extractedRole = null;
  for (const r of ROLE_DEFINITIONS) {
    if (r.regex.test(norm)) {
      extractedRole = r.role;
      break;
    }
  }

  // 8. Meaningful Keywords (Filtered from Stop Words)
  const rawWords = norm.split(/\s+/);
  const meaningfulKeywords = rawWords.filter(w => w.length >= 2 && !VIETNAMESE_STOP_WORDS.has(w));

  // Determine if it's a job search intent
  const isJobSearch = Boolean(
    extractedCategory || extractedRole || extractedDistrict || extractedShift ||
    norm.includes('tim viec') || norm.includes('kiem viec') || norm.includes('goi y') ||
    norm.includes('part time') || norm.includes('full time') || norm.includes('luong')
  );

  return {
    isGreeting,
    matchedCompany,
    isStatsQuery,
    isUserAppsQuery,
    isFreelanceOrGig,
    isCareerAdvice,
    isJobSearch,
    extractedCategory,
    extractedDistrict,
    extractedShift,
    extractedRole,
    meaningfulKeywords,
    normText: norm,
    originalText: text
  };
}

/**
 * RAG Retriever: Fetch strictly relevant knowledge from PostgreSQL DB based on user query
 */
export async function retrieveDatabaseKnowledge(intent, userContext = null) {
  const contextData = {
    totalJobsCount: 0,
    relevantJobs: [],
    companyJobs: [],
    marketStats: null,
    userApplications: [],
    freelanceProjects: [],
    gigTasks: [],
    summaryText: ''
  };

  try {
    // 1. Total jobs count
    const totalRow = await query('SELECT COUNT(*) as count FROM jobs');
    contextData.totalJobsCount = totalRow?.[0]?.count || 0;

    // 2. Company-specific Query
    if (intent.matchedCompany) {
      const companyJobs = await query(
        `SELECT id, title, company, category, district, address, salary_display, salary_min, salary_max, 
                job_type, time_shift, time_hours, experience, description, requirements, benefits
         FROM jobs 
         WHERE company ILIKE ?`,
        [`%${intent.matchedCompany}%`]
      );
      contextData.companyJobs = companyJobs;
    }

    // 3. Stats query
    if (intent.isStatsQuery) {
      const salaryStats = await query(`
        SELECT 
          category,
          COUNT(*) as job_count,
          AVG(CASE WHEN salary_type = 'hourly' THEN salary_min END) as avg_hourly_min,
          AVG(CASE WHEN salary_type = 'hourly' THEN salary_max END) as avg_hourly_max,
          MAX(salary_max) as max_salary
        FROM jobs
        GROUP BY category
      `);

      const highestSalaryJob = await query(`
        SELECT id, title, company, salary_display, salary_max 
        FROM jobs 
        ORDER BY salary_max DESC 
        LIMIT 1
      `);

      contextData.marketStats = {
        byCategory: salaryStats,
        highestJob: highestSalaryJob?.[0] || null
      };
    }

    // 4. User applications query
    if (intent.isUserAppsQuery && (userContext?.userId || userContext?.email)) {
      const apps = await query(`
        SELECT a.id, a.status, a.created_at as applied_at, j.id as job_id, j.title, j.company, j.salary_display, j.district
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = ? OR a.email = ?
        ORDER BY a.created_at DESC
      `, [userContext.userId || '', userContext.email || '']);
      contextData.userApplications = apps;
    }

    // 5. Freelance or Gig query
    if (intent.isFreelanceOrGig) {
      contextData.freelanceProjects = await query(`
        SELECT id, title, client, budget, duration, category, skills, description
        FROM freelance_projects
        WHERE status = 'OPEN'
        LIMIT 3
      `);
      contextData.gigTasks = await query(`
        SELECT id, title, reward, cargo_type, pickup_name, dropoff_name, distance_km, status
        FROM gig_tasks
        WHERE status = 'AVAILABLE'
        LIMIT 3
      `);
    }

    // 6. Job Search / Discovery Retrieval with Strict Entity & Tone-Insensitive Filtering
    if (intent.isJobSearch || (!intent.isGreeting && !intent.isStatsQuery && !intent.isUserAppsQuery)) {
      const allJobs = await query(`
        SELECT id, title, company, category, district, address, salary_display, 
               salary_min, salary_max, salary_type, job_type, time_shift, 
               time_hours, experience, description, requirements, benefits, is_hot, is_pinned, views
        FROM jobs
        ORDER BY is_pinned DESC, is_hot DESC, views DESC
      `);

      let matchedJobs = allJobs;

      // 1. STRICT CATEGORY FILTER: If user asked for IT, F&B, etc., NEVER include unrelated categories!
      if (intent.extractedCategory) {
        matchedJobs = matchedJobs.filter(j => j.category === intent.extractedCategory);
      }

      // 2. STRICT ROLE FILTER (Normalized Vietnamese tone-insensitive)
      if (intent.extractedRole) {
        const normRole = removeVietnameseTones(intent.extractedRole);
        matchedJobs = matchedJobs.filter(j => {
          const searchable = removeVietnameseTones(`${j.title} ${j.description || ''} ${j.requirements || ''}`);
          return searchable.includes(normRole);
        });
      }

      // 3. DISTRICT FILTER (Normalized tone-insensitive)
      if (intent.extractedDistrict) {
        const normDist = removeVietnameseTones(intent.extractedDistrict);
        matchedJobs = matchedJobs.filter(j => {
          const searchable = removeVietnameseTones(`${j.district || ''} ${j.address || ''}`);
          return searchable.includes(normDist);
        });
      }

      // 4. TIME SHIFT FILTER (Normalized tone-insensitive)
      if (intent.extractedShift) {
        const normShift = removeVietnameseTones(intent.extractedShift);
        matchedJobs = matchedJobs.filter(j => {
          const searchable = removeVietnameseTones(j.time_shift || '');
          return searchable.includes(normShift);
        });
      }

      // 5. MEANINGFUL KEYWORDS FILTER (when neither category nor role was extracted)
      if (!intent.extractedCategory && !intent.extractedRole && intent.meaningfulKeywords?.length > 0) {
        const normKws = intent.meaningfulKeywords.slice(0, 3).map(kw => removeVietnameseTones(kw));
        matchedJobs = matchedJobs.filter(j => {
          const searchable = removeVietnameseTones(`${j.title} ${j.company} ${j.category} ${j.district} ${j.description || ''}`);
          return normKws.some(kw => searchable.includes(kw));
        });
      }

      contextData.relevantJobs = matchedJobs.slice(0, 6);
    }
  } catch (err) {
    console.error('[RAG Service] Error retrieving from PostgreSQL DB:', err);
  }

  // Synthesize human-readable RAG context for prompt grounding
  let doc = `=== THÔNG TIN DỮ LIỆU THỰC TẾ TRONG WORKLINK CSDL (POSTGRESQL) ===\n`;
  doc += `- Tổng số tin việc làm đang tuyển trên toàn hệ thống: ${contextData.totalJobsCount}\n`;

  if (contextData.companyJobs.length > 0) {
    doc += `\n[CÁC VIỆC LÀM ĐANG TUYỂN TẠI DOANH NGHIỆP TRUY VẤN]:\n`;
    contextData.companyJobs.forEach((j, i) => {
      doc += `${i + 1}. [JOB:${j.id}] ${j.title} tại ${j.company} | Địa chỉ: ${j.address || j.district} | Lương: ${j.salary_display} | Ca: ${j.time_shift} (${j.time_hours || ''}) | Kinh nghiệm: ${j.experience}\n`;
      if (j.description) doc += `   Mô tả: ${j.description.slice(0, 140)}...\n`;
    });
  }

  if (contextData.relevantJobs.length > 0) {
    doc += `\n[DANH SÁCH VIỆC LÀM PHÙ HỢP TRONG CSDL (THEO TIÊU CHÍ KHÁCH HÀNG)]:\n`;
    contextData.relevantJobs.forEach((j, i) => {
      doc += `${i + 1}. [JOB:${j.id}] ${j.title} - ${j.company} (Ngành: ${j.category}, ${j.district}, ${j.salary_display}, ca ${j.time_shift})\n`;
    });
  }

  if (contextData.marketStats) {
    doc += `\n[THỐNG KÊ THỊ TRƯỜNG HIỆN TẠI]:\n`;
    if (contextData.marketStats.highestJob) {
      doc += `- Việc lương cao nhất: ${contextData.marketStats.highestJob.title} tại ${contextData.marketStats.highestJob.company} (${contextData.marketStats.highestJob.salary_display})\n`;
    }
    contextData.marketStats.byCategory.forEach(cat => {
      doc += `- Ngành ${cat.category}: ${cat.job_count} việc đang tuyển, lương giờ TB: ${Math.round(cat.avg_hourly_min || 0).toLocaleString()}đ - ${Math.round(cat.avg_hourly_max || 0).toLocaleString()}đ/h\n`;
    });
  }

  if (contextData.userApplications.length > 0) {
    doc += `\n[DANH SÁCH HỒ SƠ ỨNG VIÊN ĐÃ NỘP]:\n`;
    contextData.userApplications.forEach((app, i) => {
      doc += `${i + 1}. Vị trí ${app.title} tại ${app.company} (Trạng thái: ${app.status}, Nộp ngày: ${app.applied_at})\n`;
    });
  }

  if (contextData.freelanceProjects.length > 0) {
    doc += `\n[DỰ ÁN FREELANCE]:\n`;
    contextData.freelanceProjects.forEach(p => {
      doc += `- ${p.title} (Khách hàng: ${p.client}, Ngân sách: ${p.budget}, Kỹ năng: ${p.skills})\n`;
    });
  }

  if (contextData.gigTasks.length > 0) {
    doc += `\n[ĐƠN VIỆC VẶT GIG]:\n`;
    contextData.gigTasks.forEach(g => {
      doc += `- ${g.title}: Thù lao ${g.reward} (${g.pickup_name} -> ${g.dropoff_name}, ${g.distance_km}km)\n`;
    });
  }

  contextData.summaryText = doc;
  return contextData;
}

/**
 * Call Google Gemini Flash with RAG Grounding & Multi-turn Chat
 */
async function generateWithGemini(prompt, ragContext, history = [], apiKey) {
  const systemInstruction = `Bạn là WorkLink AI Copilot - Trợ lý việc làm & nghề nghiệp thông minh bậc nhất trên nền tảng WorkLink.
Nhiệm vụ của bạn là giải đáp câu hỏi của người dùng bằng tiếng Việt tự nhiên, thân thiện, súc tích và ĐẶC BIỆT PHẢI CĂN CỨ VÀO DỮ LIỆU THỰC TẾ ĐƯỢC CUNG CẤP DƯỚI ĐÂY.

${ragContext.summaryText}

QUY TẮC PHẢN HỒI QUAN TRỌNG:
1. RÀNG BUỘC NGÀNH NGHỀ TUYỆT ĐỐI:
   - Nếu người dùng tìm việc một ngành nghề cụ thể (Ví dụ: IT, F&B, Bán hàng, Gia sư...), CHỈ gợi ý các công việc đúng ngành đó!
   - TUYỆT ĐỐI KHÔNG gợi ý công việc phục vụ F&B hay bán hàng khi người dùng đang hỏi tìm việc IT!
   - Nếu không có công việc nào khớp 100%, hãy trả lời trung thực là chưa có và đề xuất ngành gần nhất.
2. Khi người dùng CHÀO HỎI bình thường:
   - Hãy chào lại lịch sự, ấm áp và giới thiệu ngắn gọn khả năng của bạn.
   - TUYỆT ĐỐI KHÔNG chèn thẻ [JOB:id] khi chưa được hỏi.
3. Khi nhắc đến công việc trong CSDL:
   - Chèn cú pháp [JOB:id] ngay sau tên công việc (ví dụ: "[JOB:job-1]") để giao diện tự động hiển thị thẻ tương tác.
4. Trình bày đẹp mắt với định dạng Markdown.`;

  const contents = [];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-6);
    for (const turn of recentHistory) {
      if (turn.text && turn.sender) {
        contents.push({
          role: turn.sender === 'user' ? 'user' : 'model',
          parts: [{ text: turn.text }]
        });
      }
    }
  }

  contents.push({
    role: 'user',
    parts: [
      {
        text: `[SYSTEM INSTRUCTION & DATABASE CONTEXT]:\n${systemInstruction}\n\n[USER QUERY]:\n${prompt}`
      }
    ]
  });

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const modelsToTry = Array.from(new Set([
    preferredModel,
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash'
  ]));

  let textOutput = null;
  let modelUsed = preferredModel;
  let lastErr = null;

  for (const m of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (res.ok) {
        const data = await res.json();
        textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          modelUsed = m;
          break;
        }
      } else {
        const errText = await res.text();
        lastErr = new Error(`Gemini status ${res.status}: ${errText.slice(0, 100)}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }

  if (!textOutput) {
    throw lastErr || new Error('Không nhận được phản hồi từ Gemini API');
  }

  const jobIds = [];
  const regex = /\[JOB:([a-zA-Z0-9_-]+)\]/g;
  let match;
  while ((match = regex.exec(textOutput)) !== null) {
    jobIds.push(match[1]);
  }

  let jobCards = [];
  if (jobIds.length > 0) {
    const allRetrieved = [...ragContext.companyJobs, ...ragContext.relevantJobs];
    jobCards = allRetrieved.filter(j => jobIds.includes(j.id));
  }

  return {
    text: textOutput.replace(/\[JOB:[a-zA-Z0-9_-]+\]/g, '').trim(),
    jobs: jobCards,
    source: `Google Gemini (${modelUsed}) [RAG Grounded 🧠]`
  };
}

/**
 * Built-in WorkLink Neural Vietnamese RAG Engine
 * High-speed, context-aware, grounded in PostgreSQL data without external dependencies.
 */
function generateWithLocalRAGEngine(intent, ragContext, userContext = null) {
  // --- Case 1: Greeting & Chit-chat ---
  if (intent.isGreeting) {
    return {
      text: `Xin chào! Tôi là **WorkLink AI Copilot** ⚡ - Trợ lý nghề nghiệp & tuyển dụng thông minh được kết nối trực tiếp với Cơ sở dữ liệu WorkLink.

Hiện hệ thống đang có **${ragContext.totalJobsCount} việc làm đang tuyển**, cùng các dự án Freelance và việc vặt Gig sinh viên. Tôi có thể hỗ trợ bạn:
- 🔍 **Tìm việc nhanh:** Nhập yêu cầu cụ thể (ví dụ: *"Tìm việc IT React/Node.js"*, *"Tìm việc phục vụ Cầu Giấy ca tối"*).
- 🏢 **Hỏi về nhà tuyển dụng:** Tra cứu thông tin, ca làm, yêu cầu của từng quán/công ty.
- 💰 **Tham khảo thu nhập:** Kiểm tra mức lương thực tế theo từng ngành nghề.
- 📝 **Tối ưu CV & Phỏng vấn:** Nhận mẹo trả lời câu hỏi và tiêu chuẩn ATS.

Bạn cần tôi giúp tìm kiếm hoặc giải đáp điều gì hôm nay?`,
      jobs: [],
      source: 'WorkLink RAG Local Engine (Connected to DB ⚡)',
      suggestedPrompts: [
        'Tìm việc IT React/Node.js',
        'The Coffee Lab đang tuyển gì?',
        'Tìm việc F&B ca tối tại Cầu Giấy',
        'Mặt bằng lương sinh viên 2026'
      ]
    };
  }

  // --- Case 2: Specific Company Inquiry ---
  if (intent.matchedCompany && ragContext.companyJobs.length > 0) {
    const compName = ragContext.companyJobs[0].company;
    const count = ragContext.companyJobs.length;
    let reply = `🏢 **Thông tin tuyển dụng tại ${compName}** (Dữ liệu thực tế từ CSDL WorkLink):\n\n`;
    reply += `Hiện tại **${compName}** đang có **${count} vị trí** tuyển dụng đang mở:\n\n`;

    ragContext.companyJobs.forEach((job, idx) => {
      reply += `${idx + 1}. **${job.title}**\n`;
      reply += `   - 💵 **Mức lương:** ${job.salary_display}\n`;
      reply += `   - ⏰ **Ca làm:** ${job.time_shift} (${job.time_hours || 'Linh hoạt'})\n`;
      reply += `   - 📍 **Địa chỉ:** ${job.address || job.district}\n`;
      reply += `   - 🎓 **Kinh nghiệm:** ${job.experience === 'NO_EXPERIENCE' ? 'Không yêu cầu kinh nghiệm (Đào tạo từ đầu)' : 'Đã có kinh nghiệm cơ bản'}\n\n`;
    });

    reply += `👉 Bạn có thể bấm vào thẻ công việc bên dưới để xem chi tiết yêu cầu hoặc nộp đơn ứng tuyển ngay nhé!`;

    return {
      text: reply,
      jobs: ragContext.companyJobs,
      source: 'WorkLink RAG Local Engine (Connected to DB ⚡)',
      suggestedPrompts: [
        `Yêu cầu của ${ragContext.companyJobs[0].title}`,
        'Các công việc khác gần Cầu Giấy',
        'Mặt bằng lương F&B'
      ]
    };
  }

  // --- Case 3: Market Statistics / Salary Benchmarks ---
  if (intent.isStatsQuery && ragContext.marketStats) {
    const { byCategory, highestJob } = ragContext.marketStats;
    let reply = `📊 **Thống kê thị trường việc làm trên WorkLink (Số liệu thực từ DB 2026):**\n\n`;
    reply += `- **Tổng số tin tuyển dụng đang hoạt động:** ${ragContext.totalJobsCount} tin\n`;

    if (highestJob) {
      reply += `- 🏆 **Công việc có mức thù lao cao nhất:** **${highestJob.title}** tại **${highestJob.company}** (${highestJob.salary_display})\n\n`;
    }

    reply += `📈 **Chi tiết các nhóm ngành chính:**\n`;
    byCategory.forEach(cat => {
      const minHourly = cat.avg_hourly_min ? `${Math.round(cat.avg_hourly_min / 1000)}k` : 'Thoả thuận';
      const maxHourly = cat.avg_hourly_max ? `${Math.round(cat.avg_hourly_max / 1000)}k` : 'Thoả thuận';
      reply += `- **${cat.category}** (${cat.job_count} việc): Lương dao động khoảng **${minHourly} - ${maxHourly}/giờ**\n`;
    });

    reply += `\n💡 *Gợi ý:* Bạn có thể bấm vào mục **"AI Quét CV"** để hệ thống tự động so khớp hồ sơ của bạn với các mức lương trên!`;

    return {
      text: reply,
      jobs: highestJob ? [highestJob] : [],
      source: 'WorkLink RAG Local Engine (Connected to DB ⚡)',
      suggestedPrompts: [
        'Tìm việc lương trên 35k/giờ',
        'Việc IT thực tập sinh',
        'Dự án Freelance lương cao'
      ]
    };
  }

  // --- Case 4: User's Applications Query ---
  if (intent.isUserAppsQuery) {
    if (ragContext.userApplications.length > 0) {
      let reply = `📋 **Danh sách hồ sơ ứng tuyển của bạn trên hệ thống:**\n\n`;
      reply += `Bạn đã gửi tổng cộng **${ragContext.userApplications.length} hồ sơ**:\n\n`;

      ragContext.userApplications.forEach((app, idx) => {
        let statusText = 'Đang chờ xét duyệt ⏳';
        if (app.status === 'reviewed') statusText = 'NTD đã xem hồ sơ 👀';
        if (app.status === 'interview') statusText = 'Được hẹn phỏng vấn 🎉';
        if (app.status === 'rejected') statusText = 'Chưa phù hợp';

        reply += `${idx + 1}. **${app.title}** tại **${app.company}**\n`;
        reply += `   - 📌 Trạng thái: **${statusText}**\n`;
        reply += `   - 📅 Ngày nộp: ${app.applied_at}\n\n`;
      });

      reply += `💡 Bạn có thể mở tab **"Hồ sơ của tôi"** để quản lý chi tiết hoặc rút hồ sơ nếu cần.`;
      return {
        text: reply,
        jobs: [],
        source: 'WorkLink RAG Local Engine (Connected to DB ⚡)'
      };
    } else {
      return {
        text: `Bạn chưa nộp hồ sơ vào công việc nào trên hệ thống, hoặc bạn chưa đăng nhập tài khoản ứng viên.\n\nHãy tìm kiếm một công việc phù hợp bên dưới và bấm **"Ứng tuyển ngay"** để bắt đầu nhé! 🚀`,
        jobs: ragContext.relevantJobs.slice(0, 3),
        source: 'WorkLink RAG Local Engine (Connected to DB ⚡)'
      };
    }
  }

  // --- Case 5: Freelance & Gigs ---
  if (intent.isFreelanceOrGig) {
    let reply = `🚀 **Hệ sinh thái Dự án Freelance & Việc vặt Gig trên WorkLink:**\n\n`;
    if (ragContext.freelanceProjects.length > 0) {
      reply += `💼 **Dự án Freelance tiêu biểu đang mở:**\n`;
      ragContext.freelanceProjects.forEach(p => {
        reply += `- **${p.title}** | Ngân sách: **${p.budget}** | Kỹ năng: ${p.skills}\n`;
      });
      reply += `\n`;
    }

    if (ragContext.gigTasks.length > 0) {
      reply += `📦 **Đơn Gig việc vặt cấp tốc:**\n`;
      ragContext.gigTasks.forEach(g => {
        reply += `- **${g.title}**: Thù lao **${g.reward}** (${g.pickup_name} ➔ ${g.dropoff_name})\n`;
      });
    }

    reply += `\n👉 Mời bạn chuyển sang tab **"Freelance"** hoặc **"Việc vặt Gig"** trên thanh menu để nhận việc ngay!`;
    return {
      text: reply,
      jobs: [],
      source: 'WorkLink RAG Local Engine (Connected to DB ⚡)'
    };
  }

  // --- Case 6: Career & CV Advice ---
  if (intent.isCareerAdvice) {
    return {
      text: `📋 **Hướng dẫn tối ưu hồ sơ & phỏng vấn xin việc trên WorkLink:**

1. **Chuẩn hóa CV theo tiêu chuẩn ATS:**
   - Đưa các con số định lượng vào kinh nghiệm (VD: *"Phục vụ 80-120 lượt khách/ca, quản lý thanh toán POS"*).
   - Nêu rõ các ca rảnh trong tuần để Nhà tuyển dụng dễ xếp lịch.
2. **Khi phỏng vấn:**
   - Đúng giờ là yếu tố quyết định 50% ấn tượng đầu tiên.
   - Trả lời trung thực về lịch học tập và mức độ cam kết gắn bó.
3. **Mặt bằng lương thương lượng:**
   - F&B Part-time: 25k - 40k/giờ.
   - IT / Marketing Intern: 3 - 6 triệu/tháng.

💡 Bạn có thể bấm nút **"AI Quét CV"** trên thanh điều hướng để hệ thống chấm điểm và gợi ý việc làm chuẩn nhất!`,
      jobs: [],
      source: 'WorkLink RAG Local Engine (Connected to DB ⚡)',
      suggestedPrompts: [
        'Top câu hỏi phỏng vấn thường gặp',
        'The Coffee Lab đang tuyển gì?',
        'Tìm việc IT React/Node.js'
      ]
    };
  }

  // --- Case 7: Strict Job Search Matches ---
  if (ragContext.relevantJobs.length > 0) {
    const specifiers = [];
    if (intent.extractedCategory) specifiers.push(`ngành **${intent.extractedCategory}**`);
    if (intent.extractedRole) specifiers.push(`vị trí **${intent.extractedRole}**`);
    if (intent.extractedDistrict) specifiers.push(`tại khu vực **${intent.extractedDistrict}**`);
    if (intent.extractedShift) specifiers.push(`ca **${intent.extractedShift}**`);

    const specText = specifiers.length > 0 ? specifiers.join(', ') + ' ' : '';

    let reply = `✨ **Kết quả truy vấn CSDL WorkLink**: Tìm thấy **${ragContext.relevantJobs.length} công việc** ${specText}phù hợp chính xác với yêu cầu của bạn:\n\n`;

    ragContext.relevantJobs.forEach((job, idx) => {
      reply += `${idx + 1}. **${job.title}** - **${job.company}**\n`;
      reply += `   - 💵 ${job.salary_display} | 📍 ${job.district} | ⏰ Ca ${job.time_shift}\n`;
    });

    reply += `\n👇 Bạn có thể bấm nút **"Chi tiết"** để xem đầy đủ quyền lợi hoặc **"Ứng tuyển ngay"** ở danh thiếp dưới đây:`;

    const prompts = [];
    if (intent.extractedCategory === 'IT') {
      prompts.push('Thực tập sinh IT có lương', 'Việc IT khu vực Cầu Giấy', 'Bí quyết viết CV ngành IT');
    } else if (intent.extractedCategory === 'F&B') {
      prompts.push('Việc Barista ca sáng', 'Việc phục vụ ca tối Cầu Giấy', 'Mặt bằng lương F&B');
    } else {
      prompts.push('Việc làm không cần kinh nghiệm', 'Mặt bằng lương sinh viên 2026', 'Hướng dẫn viết CV');
    }

    return {
      text: reply,
      jobs: ragContext.relevantJobs,
      source: 'WorkLink RAG Local Engine (Connected to DB ⚡)',
      suggestedPrompts: prompts
    };
  }

  // If user searched for a specific category but none found in DB
  if (intent.extractedCategory) {
    return {
      text: `Hiện tại trong CSDL WorkLink chưa có công việc nào thuộc ngành **${intent.extractedCategory}** khớp với bộ lọc của bạn.\n\nCác ngành đang có nhiều tin tuyển dụng nhất gồm: **IT**, **F&B**, **Bán hàng**, **Marketing**, **Gia sư** và **Kho vận**. Bạn có muốn mở rộng tìm kiếm không?`,
      jobs: [],
      source: 'WorkLink RAG Local Engine (Connected to DB ⚡)',
      suggestedPrompts: [
        'Tìm việc IT',
        'The Coffee Lab đang tuyển gì?',
        'Tìm việc F&B ca tối'
      ]
    };
  }

  // Fallback default
  return {
    text: `Tôi đã kiểm tra hệ thống và hiện có **${ragContext.totalJobsCount} việc làm** đang mở. Bạn có thể mô tả cụ thể hơn về công việc mong muốn (ví dụ: *"Tìm việc IT"*, *"Tìm việc phục vụ Cầu Giấy ca tối"*, *"Việc làm lương trên 35k"*)...?`,
    jobs: [],
    source: 'WorkLink RAG Local Engine (Connected to DB ⚡)',
    suggestedPrompts: [
      'Tìm việc IT React/Node.js',
      'The Coffee Lab đang tuyển gì?',
      'Tìm việc phục vụ ca tối',
      'Mặt bằng lương sinh viên 2026'
    ]
  };
}

/**
 * Main Entry Point: Process user prompt with RAG Pipeline
 */
export async function processCopilotMessage(userPrompt, history = [], apiKey = null, userContext = null) {
  if (!userPrompt || !userPrompt.trim()) {
    return {
      text: 'Xin chào! Bạn có thể hỏi tôi bất cứ điều gì về tìm việc, mức lương, công ty tuyển dụng hoặc chuẩn bị hồ sơ CV.',
      jobs: [],
      source: 'WorkLink AI Copilot'
    };
  }

  // Step 1: Analyze user intent and extract strict entities
  const intent = analyzeIntent(userPrompt);

  // Step 2: Retrieve strictly relevant database records (RAG Grounding)
  const ragContext = await retrieveDatabaseKnowledge(intent, userContext);

  // Step 3: If Gemini key is provided and not a simple greeting, generate with Gemini Flash RAG
  const activeKey = process.env.GEMINI_API_KEY;
  let geminiFallbackError = null;

  if (activeKey && activeKey.trim() && !intent.isGreeting) {
    try {
      const geminiResult = await generateWithGemini(userPrompt, ragContext, history, activeKey.trim());
      if (geminiResult && geminiResult.text) {
        return geminiResult;
      }
    } catch (err) {
      const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      geminiFallbackError = `Không thể kết nối mô hình Gemini (${geminiModel}): ${err.message}. Đã tự động kích hoạt Động cơ Phân tích CSDL WorkLink.`;
      console.warn('[RAG Service] Gemini call error, falling back to Local RAG Engine:', err.message);
    }
  }

  // Step 4: Built-in high-performance Vietnamese RAG reasoning engine
  const localResult = generateWithLocalRAGEngine(intent, ragContext, userContext);
  if (geminiFallbackError) {
    localResult.fallbackNotice = geminiFallbackError;
  }
  return localResult;
}
