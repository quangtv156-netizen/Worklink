import { filterAndRankJobs, removeVietnameseTones } from './aiSearchService';
import { API_BASE_URL } from './api';

/**
 * Service to power the WorkLink AI Copilot Career Assistant
 * Powered by Database RAG (Retrieval-Augmented Generation) & Dual AI Engines:
 * 1. Backend PostgreSQL RAG + Google Gemini 1.5/2.0 Flash
 * 2. High-speed Offline Vietnamese Reasoning RAG Engine
 */

export async function askWorkLinkCopilot(userPrompt, allJobs = [], _unusedKey = null, history = [], userContext = null) {
  const cleanPrompt = userPrompt.trim();
  if (!cleanPrompt) {
    return { 
      text: 'Xin chào! Bạn có thể hỏi tôi bất cứ điều gì về tìm việc, viết CV hoặc chuẩn bị phỏng vấn.',
      jobs: [],
      source: 'WorkLink AI Copilot'
    };
  }

  // 1. Primary Route: Call Backend Secure RAG AI Endpoint (PostgreSQL Database Grounding)
  try {
    const res = await fetch(`${API_BASE_URL}/ai/copilot`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: cleanPrompt,
        history
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        // Map jobs from backend to rich local job objects if matching
        let mappedJobs = [];
        if (Array.isArray(data.jobs) && data.jobs.length > 0) {
          mappedJobs = data.jobs.map(bj => {
            const found = allJobs.find(aj => aj.id === bj.id);
            return found || bj;
          });
        }

        return {
          text: data.text,
          jobs: mappedJobs,
          source: data.source || 'WorkLink RAG Database 🧠',
          suggestedPrompts: data.suggestedPrompts || [],
          fallbackNotice: data.fallbackNotice || null
        };
      }
    }
  } catch (backendErr) {
    console.warn('[AI Copilot] Backend RAG unavailable, using local client RAG:', backendErr.message);
  }

  // 2. Fallback: Intelligent Client-side RAG Engine (Zero latency, offline-ready)
  return localClientRAGEngine(cleanPrompt, allJobs, userContext);
}

/**
 * Intelligent Client-side Reasoning Engine
 * Gốc rễ: Phân biệt rõ ràng giữa Chào hỏi / Hỏi công ty / Hỏi lương / Lời khuyên / Tìm việc
 */
function localClientRAGEngine(prompt, allJobs = [], userContext = null) {
  const norm = removeVietnameseTones(prompt.toLowerCase());

  // 1. Chào hỏi thông thường -> TUYỆT ĐỐI KHÔNG XẢ VIỆC LÀM
  const isGreeting = (
    norm === 'chao' || norm === 'chao ban' || norm === 'xin chao' || norm === 'hello' ||
    norm === 'hi' || norm === 'hey' || norm.startsWith('chao ban') || norm.startsWith('xin chao') ||
    norm === 'ban la ai' || norm === 'ban ten gi' || norm === 'giup minh voi' || norm === 'cam on'
  );

  if (isGreeting) {
    return {
      text: `Xin chào! Tôi là **WorkLink AI Copilot** ⚡ - Trợ lý việc làm & nghề nghiệp thông minh được kết nối trực tiếp với Cơ sở dữ liệu WorkLink.

Hiện hệ thống đang có **${allJobs.length} việc làm đang tuyển**. Tôi có thể hỗ trợ bạn:
- 🔍 **Tìm việc nhanh:** Nhập yêu cầu cụ thể (ví dụ: *"Tìm việc phục vụ Cầu Giấy lương > 30k"*, *"Thực tập IT React"*).
- 🏢 **Hỏi về nhà tuyển dụng:** Tra cứu thông tin, ca làm, yêu cầu của từng quán/công ty.
- 💰 **Tham khảo thu nhập:** Kiểm tra mức lương thực tế theo từng ngành nghề.
- 📝 **Tối ưu CV & Phỏng vấn:** Nhận mẹo trả lời câu hỏi và tiêu chuẩn ATS.

Bạn muốn tôi hỗ trợ điều gì hôm nay?`,
      jobs: [],
      source: 'WorkLink Local AI Engine ⚡',
      suggestedPrompts: [
        'The Coffee Lab đang tuyển gì?',
        'Tìm việc F&B ca tối tại Cầu Giấy',
        'Mặt bằng lương sinh viên 2026',
        'Bí quyết viết CV ấn tượng'
      ]
    };
  }

  // 2. Tra cứu cụ thể về một quán / công ty
  const matchedCompanyJobs = allJobs.filter(j => 
    norm.includes(removeVietnameseTones(j.company.toLowerCase())) ||
    removeVietnameseTones(j.company.toLowerCase()).includes(norm)
  );

  if (matchedCompanyJobs.length > 0) {
    const comp = matchedCompanyJobs[0].company;
    return {
      text: `🏢 **Thông tin tuyển dụng tại ${comp}**:\n\nHiện tại ${comp} đang có **${matchedCompanyJobs.length} vị trí** đang mở trên hệ thống:\n` +
        matchedCompanyJobs.map((j, i) => `${i + 1}. **${j.title}** - Lương: ${j.salaryDisplay || j.salary_display || j.salary_text} (Ca ${j.timeShift || j.time_shift})`).join('\n') +
        `\n\n👉 Bạn có thể bấm vào thẻ công việc bên dưới để xem chi tiết hoặc ứng tuyển ngay!`,
      jobs: matchedCompanyJobs,
      source: 'WorkLink Local AI Engine ⚡',
      suggestedPrompts: [
        `Yêu cầu của ${matchedCompanyJobs[0].title}`,
        'Các việc làm khác tại Cầu Giấy'
      ]
    };
  }

  // 3. Tư vấn CV
  if (norm.includes('cv') || norm.includes('ho so') || norm.includes('resume')) {
    return {
      text: `📋 **Bí quyết viết CV ấn tượng khi ứng tuyển trên WorkLink:**

1. **Định lượng kinh nghiệm:** Nêu cụ thể số liệu (ví dụ: *"Phục vụ tại quán quy mô 80 bàn, phục vụ trung bình 120 lượt khách/ca"*).
2. **Kỹ năng cốt lõi:** Nêu bật kỹ năng mềm (giao tiếp, làm việc nhóm) và kỹ năng cứng (pha chế, POS, ngoại ngữ).
3. **Lịch làm việc rõ ràng:** Ghi rõ các ca rảnh trong tuần để Nhà tuyển dụng dễ sắp ca.
4. **Độ dài hợp lý:** Chỉ nên dài **1 trang A4**, thiết kế chỉn chu, không lỗi chính tả.

💡 *Mẹo:* Bạn có thể bấm nút **"AI Quét CV"** trên thanh điều hướng để hệ thống chấm điểm ATS tự động!`,
      jobs: [],
      source: 'WorkLink Local AI Engine ⚡',
      suggestedPrompts: [
        'Top câu hỏi phỏng vấn thường gặp',
        'Mặt bằng lương sinh viên 2026'
      ]
    };
  }

  // 4. Tư vấn Phỏng vấn
  if (norm.includes('phong van') || norm.includes('cau hoi') || norm.includes('deal luong')) {
    return {
      text: `🎯 **Top 4 câu hỏi phỏng vấn phổ biến & Cách trả lời thông minh:**

1. **"Giới thiệu ngắn gọn về bản thân?"**
   👉 *Công thức:* Tên + Trường/Ngành học + 1-2 thế mạnh liên quan trực tiếp đến công việc + Lý do chọn quán/công ty.
2. **"Nếu khách hàng phàn nàn, bạn xử lý thế nào?"**
   👉 Giữ bình tĩnh, lắng nghe, xin lỗi chân thành và nhanh chóng đưa giải pháp hoặc báo quản lý ca.
3. **"Mức lương mong muốn của bạn là bao nhiêu?"**
   👉 Nắm trước mặt bằng (25k-35k/giờ cho F&B, 3-6 triệu cho thực tập sinh) và đề xuất con số rõ ràng.`,
      jobs: [],
      source: 'WorkLink Local AI Engine ⚡'
    };
  }

  // 5. Thống kê thị trường lương
  if (norm.includes('mat bang luong') || norm.includes('luong bao nhieu') || norm.includes('luong sinh vien')) {
    return {
      text: `💰 **Mặt bằng thu nhập thị trường hiện nay (Cập nhật 2026):**

- ☕ **F&B (Barista, Phục vụ, Thu ngân):** **25.000đ - 38.000đ/giờ** + Thưởng doanh số.
- 📚 **Gia sư & Trợ giảng:** **150.000đ - 250.000đ/buổi** (2h) hoặc **40.000đ - 65.000đ/giờ**.
- 💻 **Thực tập sinh IT / Marketing:** **3.000.000đ - 6.000.000đ/tháng**.
- 📦 **Gig Shipper & Việc vặt:** **40.000đ - 120.000đ/cuốc** giao nhanh nội thành.`,
      jobs: [],
      source: 'WorkLink Local AI Engine ⚡'
    };
  }

  // 6. Tìm kiếm công việc (chỉ khi có ý định tìm kiếm thực sự)
  const isSearchQuery = (
    norm.includes('tim viec') || norm.includes('kiem viec') || norm.includes('goi y') ||
    norm.includes('part time') || norm.includes('full time') || norm.includes('phuc vu') ||
    norm.includes('barista') || norm.includes('thu ngan') || norm.includes('ban hang') ||
    norm.includes('it') || norm.includes('gia su') || norm.includes('cau giay') ||
    norm.includes('ca toi') || norm.includes('ca sang')
  );

  if (isSearchQuery) {
    const { rankedJobs } = filterAndRankJobs(allJobs, prompt, {});
    const topMatches = rankedJobs.slice(0, 3);

    if (topMatches.length > 0) {
      return {
        text: `✨ Tôi đã quét hệ thống và tìm thấy các công việc phù hợp với yêu cầu của bạn:\n\nDưới đây là các vị trí có điểm tương thích cao nhất. Bạn có thể bấm vào thẻ bên dưới để xem chi tiết hoặc ứng tuyển ngay nhé! 👇`,
        jobs: topMatches,
        source: 'WorkLink Local AI Engine ⚡'
      };
    }
  }

  // Default Fallback
  return {
    text: `Tôi có thể hỗ trợ bạn tìm việc làm, tra cứu công ty tuyển dụng, giải đáp mặt bằng lương hoặc hướng dẫn viết CV. Bạn có thể nói rõ hơn về yêu cầu của mình không?`,
    jobs: [],
    source: 'WorkLink Local AI Engine ⚡',
    suggestedPrompts: [
      'Tìm việc phục vụ Cầu Giấy ca tối',
      'The Coffee Lab đang tuyển gì?',
      'Mặt bằng lương sinh viên 2026'
    ]
  };
}
